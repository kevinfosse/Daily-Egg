import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import PvpChallenge from "@/app/lib/models/PvpChallenge";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";
import {
  calcStats,
  calcDamage,
  getTypeMultiplier,
  getMoveset,
  BATTLE_CANDY_REWARDS,
} from "@/app/lib/battle/config";
import { secureRandom } from "@/app/lib/gacha/config";
import { calcElo } from "@/app/lib/pvp/elo";
import mongoose from "mongoose";

interface PvpFighter {
  name: string;
  sprite: string;
  rarity: string;
  types: string[];
  hp: number;
  maxHP: number;
  atk: number;
  def: number;
}

function simulatePvpBattle(
  attacker: PvpFighter,
  defenders: PvpFighter[]
): { result: "challenger" | "defender"; log: string[]; candyChallenger: number; candyDefender: number } {
  const log: string[] = [];
  let attackerHP = attacker.hp;
  let attackerMaxHP = attacker.maxHP;
  let defendersDefeated = 0;

  for (const defender of defenders) {
    let defHP = defender.hp;
    const attackerMoves = getMoveset(attacker.types);
    const defMoves = getMoveset(defender.types);

    log.push(`⚔️ ${attacker.name} vs ${defender.name} !`);

    let turn = 0;
    while (attackerHP > 0 && defHP > 0 && turn < 40) {
      turn++;

      // Attacker attacks
      const atkMove = attackerMoves[Math.floor(secureRandom() * attackerMoves.length)];
      const atkMult = getTypeMultiplier(atkMove.type, defender.types);
      const atkDmg = calcDamage(attacker.atk, defender.def, atkMove.power, atkMult);
      defHP = Math.max(0, defHP - atkDmg);
      log.push(`${attacker.name} → ${atkDmg} dégâts sur ${defender.name}`);

      if (defHP <= 0) break;

      // Defender attacks back
      const defMove = defMoves[Math.floor(secureRandom() * defMoves.length)];
      const defMult = getTypeMultiplier(defMove.type, attacker.types);
      const defDmg = calcDamage(defender.def, attacker.def, defMove.power, defMult);
      attackerHP = Math.max(0, attackerHP - defDmg);
      log.push(`${defender.name} → ${defDmg} dégâts sur ${attacker.name}`);
    }

    if (defHP <= 0) {
      // Attacker wins this round
      defendersDefeated++;
      log.push(`${defender.name} est KO !`);
    } else if (attackerHP <= 0) {
      // Attacker is KO — defender wins overall
      log.push(`${attacker.name} est KO ! Défense victorieuse.`);
      break;
    } else {
      // 40 turns reached — compare HP percentages for this duel
      const atkPct = attackerHP / attackerMaxHP;
      const defPct = defHP / defender.hp;
      if (atkPct >= defPct) {
        defendersDefeated++;
        log.push(`Égalité — ${attacker.name} a plus de HP (${Math.floor(atkPct * 100)}% vs ${Math.floor(defPct * 100)}%)`);
      } else {
        log.push(`Égalité — ${defender.name} résiste (${Math.floor(defPct * 100)}% vs ${Math.floor(atkPct * 100)}%)`);
        attackerHP = 0;
        break;
      }
    }
  }

  const result: "challenger" | "defender" = attackerHP > 0 ? "challenger" : "defender";
  const winnerRarity = result === "challenger" ? attacker.rarity : defenders[0]?.rarity ?? "common";
  const candy = BATTLE_CANDY_REWARDS[winnerRarity] ?? 5;

  log.push(result === "challenger" ? `🏆 ${attacker.name} remporte le défi PvP !` : `🛡️ La défense tient bon !`);

  return {
    result,
    log,
    candyChallenger: result === "challenger" ? candy : 0,
    candyDefender: result === "defender" ? candy : 0,
  };
}

// POST — initiate a PvP challenge
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { defenderId: string; attackerPokedexId: number; attackerIsShiny: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { defenderId, attackerPokedexId, attackerIsShiny } = body;
  if (!defenderId || !attackerPokedexId) {
    return NextResponse.json({ error: "defenderId and attackerPokedexId required" }, { status: 400 });
  }
  if (defenderId === session.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous défier vous-même" }, { status: 400 });
  }

  try {
    await connectToDb();

    // Load challenger
    const challenger = await User.findById(session.user.id).lean() as any;
    if (!challenger) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check daily PvP limit (5/day)
    const now = new Date();
    const lastPvpDate: Date | null = challenger.lastPvpDate ?? null;
    let dailyPvpChallenges = challenger.dailyPvpChallenges ?? 0;
    if (lastPvpDate) {
      const lp = new Date(lastPvpDate);
      const sameDay =
        lp.getFullYear() === now.getFullYear() &&
        lp.getMonth() === now.getMonth() &&
        lp.getDate() === now.getDate();
      if (!sameDay) dailyPvpChallenges = 0;
    }

    if (dailyPvpChallenges >= 5) {
      return NextResponse.json({ error: "Limite de 5 défis PvP par jour atteinte" }, { status: 429 });
    }

    // Load defender
    const defender = await User.findById(defenderId).lean() as any;
    if (!defender) return NextResponse.json({ error: "Adversaire introuvable" }, { status: 404 });

    const defenseTeam: any[] = defender.pvpDefenseTeam ?? [];
    if (defenseTeam.length === 0) {
      return NextResponse.json({ error: "L'adversaire n'a pas d'équipe de défense" }, { status: 400 });
    }

    // Validate attacker is in challenger's collection
    const ownedPokemon = (challenger.pokemons ?? []).find(
      (p: any) => p.pokedexId === attackerPokedexId && p.isShiny === attackerIsShiny
    );
    if (!ownedPokemon) {
      return NextResponse.json({ error: "Pokémon attaquant introuvable dans votre collection" }, { status: 400 });
    }

    // Fetch attacker stats from PokeAPI
    const atkData = await fetchPokemon(attackerPokedexId);
    if (!atkData) {
      return NextResponse.json({ error: "Impossible de charger les stats de l'attaquant" }, { status: 500 });
    }

    const atkStats = calcStats(atkData.stats.hp, atkData.stats.attack, atkData.stats.defense);
    const atkRarity = classifyRarity(atkData);
    const atkSprite = attackerIsShiny ? atkData.spriteShiny : atkData.spriteDefault;

    const attacker: PvpFighter = {
      name: ownedPokemon.name,
      sprite: atkSprite,
      rarity: atkRarity,
      types: atkData.types,
      hp: atkStats.maxHP,
      maxHP: atkStats.maxHP,
      atk: atkStats.atk,
      def: atkStats.def,
    };

    // Build defender fighters
    const defFighters: PvpFighter[] = defenseTeam.map((d: any) => {
      const ds = calcStats(d.baseHP, d.baseATK, d.baseDEF);
      return {
        name: d.name,
        sprite: d.sprite,
        rarity: d.rarity,
        types: d.types,
        hp: ds.maxHP,
        maxHP: ds.maxHP,
        atk: ds.atk,
        def: ds.def,
      };
    });

    // Simulate battle
    const { result, log, candyChallenger, candyDefender } = simulatePvpBattle(attacker, defFighters);

    // Save challenge record
    const challengeDoc = await PvpChallenge.create({
      challengerId: challenger._id,
      challengerName: challenger.username,
      challengerPokemon: { name: ownedPokemon.name, sprite: atkSprite, rarity: atkRarity },
      defenderId: defender._id,
      defenderName: defender.username,
      defenseTeam: defenseTeam.map((d: any) => ({ name: d.name, sprite: d.sprite, rarity: d.rarity })),
      result,
      log,
      candyChallenger,
      candyDefender,
    });

    // Calculate ELO changes
    const challengerElo = challenger.pvpElo ?? 1000;
    const defenderElo = defender.pvpElo ?? 1000;
    const newChallengerElo = calcElo(challengerElo, defenderElo, result === "challenger");
    const newDefenderElo = calcElo(defenderElo, challengerElo, result === "defender");

    // Update challenger stats
    const challengerUpdate: any = {
      $inc: {
        dailyPvpChallenges: 1,
        pvpWins: result === "challenger" ? 1 : 0,
        pvpLosses: result === "defender" ? 1 : 0,
        candy: candyChallenger,
      },
      $set: { lastPvpDate: now, pvpElo: newChallengerElo },
    };
    await User.findByIdAndUpdate(session.user.id, challengerUpdate, { strict: false });

    // Update defender stats
    const defenderUpdate: any = {
      $inc: {
        pvpWins: result === "defender" ? 1 : 0,
        pvpLosses: result === "challenger" ? 1 : 0,
        candy: candyDefender,
      },
      $set: { pvpElo: newDefenderElo },
    };
    await User.findByIdAndUpdate(defenderId, defenderUpdate, { strict: false });

    // Post activity
    const resultText = result === "challenger"
      ? `${challenger.username} a battu ${defender.username} en PvP !`
      : `${defender.username} a repoussé le défi de ${challenger.username} !`;

    fetch(`${process.env.NEXTAUTH_URL ?? ""}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: resultText }),
    }).catch(() => {});

    return NextResponse.json({
      result,
      log,
      candyEarned: result === "challenger" ? candyChallenger : 0,
      eloChange: newChallengerElo - challengerElo,
      newElo: newChallengerElo,
      challenge: {
        id: challengeDoc._id,
        challengerName: challenger.username,
        defenderName: defender.username,
        result,
      },
    });
  } catch (error) {
    console.error("pvp/challenge POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — return last 10 challenges (sent + received)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await connectToDb();
    const userId = new mongoose.Types.ObjectId(session.user.id);

    const challenges = await PvpChallenge.find({
      $or: [{ challengerId: userId }, { defenderId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("pvp/challenge GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
