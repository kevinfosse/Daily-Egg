import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";
import { secureRandom } from "@/app/lib/gacha/config";
import { getMoveset, calcStats } from "@/app/lib/battle/config";

const MAX_DAILY_BATTLES = 3;
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const MAX_POKEDEX_ID = 1025;
const BATTLE_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24h

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Roll an enemy pokemon of a given target rarity (up to 80 attempts)
async function rollEnemyByRarity(targetRarity: string) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const id = 1 + Math.floor(secureRandom() * MAX_POKEDEX_ID);
    const pokemon = await fetchPokemon(id);
    if (!pokemon) continue;
    if (classifyRarity(pokemon) === targetRarity) {
      return { id, pokemon };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { pokedexId?: number; isShiny?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { pokedexId, isShiny = false } = body;
  if (!pokedexId || isNaN(pokedexId)) {
    return NextResponse.json({ error: "Invalid pokedexId" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();

    // Reset daily battles if new day
    const lastBattleDate: Date | null = (user as any).lastBattleDate ?? null;
    if (!lastBattleDate || !isSameDay(lastBattleDate, now)) {
      (user as any).dailyBattles = 0;
    }

    const dailyBattles = (user as any).dailyBattles ?? 0;
    if (dailyBattles >= MAX_DAILY_BATTLES) {
      return NextResponse.json({ error: "Limite de 3 combats par jour atteinte" }, { status: 429 });
    }

    // Check no active battle already running
    const currentBattle = (user as any).currentBattle;
    if (currentBattle && currentBattle.status === "active" && new Date(currentBattle.expiresAt) > now) {
      return NextResponse.json({ error: "Un combat est déjà en cours" }, { status: 400 });
    }

    // Check player owns the pokemon and it's not on expedition
    const pokemons: any[] = (user as any).pokemons ?? [];
    const activeExpeditions: any[] = (user as any).activeExpeditions ?? [];

    const playerPokemon = pokemons.find(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );
    if (!playerPokemon) {
      return NextResponse.json({ error: "Pokémon non possédé" }, { status: 400 });
    }

    const onExpedition = activeExpeditions.some(
      (e: any) => e.pokedexId === pokedexId && e.isShiny === isShiny
    );
    if (onExpedition) {
      return NextResponse.json({ error: "Ce Pokémon est en expédition" }, { status: 400 });
    }

    // Fetch player pokemon from PokeAPI for stats
    const playerData = await fetchPokemon(pokedexId);
    if (!playerData) {
      return NextResponse.json({ error: "Impossible de récupérer les données du Pokémon" }, { status: 500 });
    }

    const playerRarity = playerPokemon.rarity ?? classifyRarity(playerData);
    const playerRarityIdx = RARITY_ORDER.indexOf(playerRarity);

    // Determine enemy rarity: ±1 with 30% chance
    let enemyRarityIdx = playerRarityIdx;
    const rarityRoll = secureRandom();
    if (rarityRoll < 0.15 && playerRarityIdx > 0) {
      enemyRarityIdx = playerRarityIdx - 1;
    } else if (rarityRoll < 0.30 && playerRarityIdx < RARITY_ORDER.length - 1) {
      enemyRarityIdx = playerRarityIdx + 1;
    }
    const enemyRarity = RARITY_ORDER[enemyRarityIdx];

    // Roll enemy pokemon
    const enemyResult = await rollEnemyByRarity(enemyRarity);
    if (!enemyResult) {
      return NextResponse.json({ error: "Impossible de générer un ennemi" }, { status: 500 });
    }
    const { id: enemyId, pokemon: enemyData } = enemyResult;

    // Compute stats
    const playerStats = calcStats(
      playerData.stats.hp,
      playerData.stats.attack,
      playerData.stats.defense
    );
    const enemyStats = calcStats(
      enemyData.stats.hp,
      enemyData.stats.attack,
      enemyData.stats.defense
    );

    // Build movesets
    const playerMoves = getMoveset(playerData.types);
    const enemyMoves = getMoveset(enemyData.types);

    // Player sprite
    const playerSprite = isShiny ? playerData.spriteShiny : playerData.spriteDefault;

    // Create battle
    const expiresAt = new Date(now.getTime() + BATTLE_EXPIRES_MS);

    (user as any).currentBattle = {
      playerPokedexId: pokedexId,
      playerIsShiny: isShiny,
      playerName: playerPokemon.name ?? playerData.name,
      playerSprite,
      playerTypes: playerData.types,
      playerHP: playerStats.maxHP,
      playerMaxHP: playerStats.maxHP,
      playerATK: playerStats.atk,
      playerDEF: playerStats.def,
      playerMoves,
      enemyPokedexId: enemyId,
      enemyName: enemyData.name,
      enemySprite: enemyData.spriteDefault,
      enemyTypes: enemyData.types,
      enemyRarity,
      enemyHP: enemyStats.maxHP,
      enemyMaxHP: enemyStats.maxHP,
      enemyATK: enemyStats.atk,
      enemyDEF: enemyStats.def,
      enemyMoves,
      turn: 1,
      log: [`Combat commencé ! ${playerPokemon.name ?? playerData.name} VS ${enemyData.name} !`],
      status: "active",
      rewards: null,
      expiresAt,
    };

    (user as any).dailyBattles = dailyBattles + 1;
    (user as any).lastBattleDate = now;

    user.markModified("currentBattle");
    await user.save();

    return NextResponse.json({
      battle: (user as any).currentBattle,
      dailyBattles: (user as any).dailyBattles,
    });
  } catch (error) {
    console.error("Battle start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
