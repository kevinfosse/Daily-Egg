import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { secureRandom } from "@/app/lib/gacha/config";
import { ALL_ITEM_IDS } from "@/app/lib/items/config";
import {
  getTypeMultiplier,
  calcDamage,
  BATTLE_CANDY_REWARDS,
  canApplyStatus,
  rollCritical,
} from "@/app/lib/battle/config";
import { getDailyPokemonId } from "@/app/lib/daily-pokemon";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { moveIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { moveIndex } = body;
  if (moveIndex === undefined || moveIndex < 0 || moveIndex > 3 || !Number.isInteger(moveIndex)) {
    return NextResponse.json({ error: "moveIndex must be 0-3" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const battle = (user as any).currentBattle;
    if (!battle) {
      return NextResponse.json({ error: "Aucun combat en cours" }, { status: 400 });
    }
    if (battle.status !== "active") {
      return NextResponse.json({ error: "Le combat est terminé" }, { status: 400 });
    }
    if (new Date(battle.expiresAt) <= new Date()) {
      return NextResponse.json({ error: "Combat expiré" }, { status: 400 });
    }

    const playerMove = battle.playerMoves[moveIndex];
    if (!playerMove) {
      return NextResponse.json({ error: "Move invalide" }, { status: 400 });
    }

    // Ensure status fields exist (backwards compatibility)
    if (!battle.playerStatus) battle.playerStatus = "none";
    if (!battle.enemyStatus) battle.enemyStatus = "none";

    // --- Paralysis check for player ---
    if (battle.playerStatus === "paralyzed" && secureRandom() < 0.25) {
      battle.log.push(`${battle.playerName} est paralysé et ne peut pas agir !`);
    } else {
      // --- Player attacks enemy ---
      const playerMultiplier = getTypeMultiplier(playerMove.type, battle.enemyTypes);
      const isCrit = rollCritical(battle.playerIsShiny);
      let playerDamage = calcDamage(battle.playerATK, battle.enemyDEF, playerMove.power, playerMultiplier);

      // Apply burn debuff to physical moves (-50% damage)
      if (battle.playerStatus === "burned" && playerMove.category === "physical") {
        playerDamage = Math.max(1, Math.floor(playerDamage * 0.5));
      }
      if (isCrit) playerDamage = Math.floor(playerDamage * 1.5);

      battle.enemyHP = Math.max(0, battle.enemyHP - playerDamage);

      let effectivenessMsg = "";
      if (playerMultiplier >= 2) effectivenessMsg = " C'est super efficace !";
      else if (playerMultiplier <= 0.5 && playerMultiplier > 0) effectivenessMsg = " Pas très efficace...";
      else if (playerMultiplier === 0) effectivenessMsg = " Ça n'a aucun effet !";

      const critMsg = isCrit ? " ⭐ Coup critique !" : "";

      battle.log.push(
        `${battle.playerName} utilise ${playerMove.name} → ${playerDamage} dégâts !${effectivenessMsg}${critMsg}`
      );

      // --- Try to inflict status on enemy ---
      if (
        playerMove.statusEffect &&
        playerMove.statusChance &&
        battle.enemyStatus === "none" &&
        secureRandom() < playerMove.statusChance &&
        canApplyStatus(playerMove.statusEffect, battle.enemyTypes)
      ) {
        battle.enemyStatus = playerMove.statusEffect;
        const statusEmoji = playerMove.statusEffect === "burned" ? "🔥" : "⚡";
        const statusName = playerMove.statusEffect === "burned" ? "brûlé" : "paralysé";
        battle.log.push(`${battle.enemyName} est ${statusName} ${statusEmoji} !`);
      }
    }

    // --- Check if enemy is KO ---
    if (battle.enemyHP <= 0) {
      const candyReward = BATTLE_CANDY_REWARDS[battle.enemyRarity] ?? 5;

      // 20% chance to drop an item
      let itemDropped: string | undefined;
      if (secureRandom() < 0.2) {
        itemDropped = ALL_ITEM_IDS[Math.floor(secureRandom() * ALL_ITEM_IDS.length)];
      }

      // Bonus expedition slot (max 1 total stored)
      const currentSlots = (user as any).bonusExpeditionSlots ?? 0;
      const newSlots = Math.min(currentSlots + 1, 1);
      const bonusExpedition = newSlots > currentSlots;

      // Apply rewards
      (user as any).candy = ((user as any).candy ?? 0) + candyReward;
      (user as any).bonusExpeditionSlots = newSlots;

      if (itemDropped) {
        const inventory: any[] = (user as any).inventory ?? [];
        const existing = inventory.find((i: any) => i.itemId === itemDropped);
        if (existing) {
          existing.quantity = (existing.quantity ?? 1) + 1;
        } else {
          inventory.push({ itemId: itemDropped, quantity: 1 });
        }
        (user as any).inventory = inventory;
        user.markModified("inventory");
      }

      // --- Daily challenge check ---
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      let dailyBonus = 0;

      const lastChallengeDate = (user as any).lastChallengeDateStr ?? "";
      if (lastChallengeDate !== todayStr) {
        (user as any).dailyChallengeWon = false;
      }

      if (!(user as any).dailyChallengeWon) {
        try {
          const dailyId = getDailyPokemonId();
          const daily = await fetchPokemon(dailyId);
          if (daily?.types.some((t: string) => battle.enemyTypes.includes(t))) {
            dailyBonus = 50;
            (user as any).candy = ((user as any).candy ?? 0) + dailyBonus;
            (user as any).dailyChallengeWon = true;
            (user as any).lastChallengeDateStr = todayStr;
            battle.log.push(`🌟 Défi Quotidien accompli ! +${dailyBonus} Candy bonus !`);
          }
        } catch {
          // Silently ignore PokeAPI errors for daily challenge
        }
      }

      battle.status = "won";
      battle.rewards = {
        candy: candyReward,
        itemDropped: itemDropped ?? null,
        bonusExpedition,
        dailyBonus,
      };
      battle.log.push(`${battle.enemyName} est KO ! Victoire !`);

      user.markModified("currentBattle");
      await user.save();

      return NextResponse.json({ battle });
    }

    // --- Enemy attacks player ---
    // Paralysis check for enemy
    const enemyMoveIndex = Math.floor(secureRandom() * battle.enemyMoves.length);
    const enemyMove = battle.enemyMoves[enemyMoveIndex];

    if (battle.enemyStatus === "paralyzed" && secureRandom() < 0.25) {
      battle.log.push(`${battle.enemyName} est paralysé et ne peut pas agir !`);
    } else {
      const enemyMultiplier = getTypeMultiplier(enemyMove.type, battle.playerTypes);
      const enemyCrit = rollCritical(false); // enemies can't be shiny
      let enemyDamage = calcDamage(battle.enemyATK, battle.playerDEF, enemyMove.power, enemyMultiplier);

      // Apply burn debuff to physical moves
      if (battle.enemyStatus === "burned" && enemyMove.category === "physical") {
        enemyDamage = Math.max(1, Math.floor(enemyDamage * 0.5));
      }
      if (enemyCrit) enemyDamage = Math.floor(enemyDamage * 1.5);

      battle.playerHP = Math.max(0, battle.playerHP - enemyDamage);

      let enemyEffectivenessMsg = "";
      if (enemyMultiplier >= 2) enemyEffectivenessMsg = " C'est super efficace !";
      else if (enemyMultiplier <= 0.5 && enemyMultiplier > 0) enemyEffectivenessMsg = " Pas très efficace...";
      else if (enemyMultiplier === 0) enemyEffectivenessMsg = " Ça n'a aucun effet !";

      const enemyCritMsg = enemyCrit ? " ⭐ Coup critique !" : "";

      battle.log.push(
        `${battle.enemyName} utilise ${enemyMove.name} → ${enemyDamage} dégâts !${enemyEffectivenessMsg}${enemyCritMsg}`
      );

      // --- Try to inflict status on player ---
      if (
        enemyMove.statusEffect &&
        enemyMove.statusChance &&
        battle.playerStatus === "none" &&
        secureRandom() < enemyMove.statusChance &&
        canApplyStatus(enemyMove.statusEffect, battle.playerTypes)
      ) {
        battle.playerStatus = enemyMove.statusEffect;
        const statusEmoji = enemyMove.statusEffect === "burned" ? "🔥" : "⚡";
        const statusName = enemyMove.statusEffect === "burned" ? "brûlé" : "paralysé";
        battle.log.push(`${battle.playerName} est ${statusName} ${statusEmoji} !`);
      }
    }

    // --- End of turn: apply burn damage ---
    if (battle.playerStatus === "burned") {
      const burnDmg = Math.max(1, Math.floor(battle.playerMaxHP * 0.1));
      battle.playerHP = Math.max(0, battle.playerHP - burnDmg);
      battle.log.push(`🔥 ${battle.playerName} souffre de la brûlure (-${burnDmg} HP) !`);
    }
    if (battle.enemyStatus === "burned") {
      const burnDmg = Math.max(1, Math.floor(battle.enemyMaxHP * 0.1));
      battle.enemyHP = Math.max(0, battle.enemyHP - burnDmg);
      battle.log.push(`🔥 ${battle.enemyName} souffre de la brûlure (-${burnDmg} HP) !`);
    }

    // --- Check KO after burn ---
    if (battle.enemyHP <= 0) {
      const candyReward = BATTLE_CANDY_REWARDS[battle.enemyRarity] ?? 5;
      const currentSlots = (user as any).bonusExpeditionSlots ?? 0;
      const newSlots = Math.min(currentSlots + 1, 1);
      const bonusExpedition = newSlots > currentSlots;
      (user as any).candy = ((user as any).candy ?? 0) + candyReward;
      (user as any).bonusExpeditionSlots = newSlots;

      // Daily challenge check
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      let dailyBonus = 0;
      const lastChallengeDate = (user as any).lastChallengeDateStr ?? "";
      if (lastChallengeDate !== todayStr) (user as any).dailyChallengeWon = false;
      if (!(user as any).dailyChallengeWon) {
        try {
          const dailyId = getDailyPokemonId();
          const daily = await fetchPokemon(dailyId);
          if (daily?.types.some((t: string) => battle.enemyTypes.includes(t))) {
            dailyBonus = 50;
            (user as any).candy = ((user as any).candy ?? 0) + dailyBonus;
            (user as any).dailyChallengeWon = true;
            (user as any).lastChallengeDateStr = todayStr;
            battle.log.push(`🌟 Défi Quotidien accompli ! +${dailyBonus} Candy bonus !`);
          }
        } catch {}
      }

      battle.status = "won";
      battle.rewards = { candy: candyReward, itemDropped: null, bonusExpedition, dailyBonus };
      battle.log.push(`${battle.enemyName} est KO par la brûlure ! Victoire !`);
      user.markModified("currentBattle");
      await user.save();
      return NextResponse.json({ battle });
    }

    if (battle.playerHP <= 0) {
      battle.status = "lost";
      battle.log.push(`${battle.playerName} est KO ! Défaite...`);
      user.markModified("currentBattle");
      await user.save();
      return NextResponse.json({ battle });
    }

    // --- Continue battle ---
    battle.turn = (battle.turn ?? 1) + 1;
    user.markModified("currentBattle");
    await user.save();

    return NextResponse.json({ battle });
  } catch (error) {
    console.error("Battle move error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
