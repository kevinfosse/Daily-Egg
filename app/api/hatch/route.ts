import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { eggSpinningWheel } from "@/app/lib/gacha/config";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";

const MAX_POKEDEX_ID = 1025; // National Dex (Gen 9). Ajuste si besoin.

function classifyRarity(p: NonNullable<Awaited<ReturnType<typeof fetchPokemon>>>): string {
  // Source de vérité: `pokemon-species` (legendary/mythical/baby) + BST (base stat total)
  if (p.isLegendary || p.isMythical) return "legendary";
  if (p.isBaby) return "common";

  const bst = p.baseStatTotal || 0;

  // Règle stable (simple, explicable) :
  // - >= 540 : epic (pseudo-légendaires / très forts)
  // - >= 480 : rare
  // - >= 380 : uncommon
  // - sinon : common
  if (bst >= 540) return "epic";
  if (bst >= 480) return "rare";
  if (bst >= 380) return "uncommon";
  return "common";
}

async function rollPokemonForEgg() {
  // Gacha: tirage du tier (chance) puis sélection d'un Pokémon qui correspond
  const pick = eggSpinningWheel();
  const targetRarity = pick.selectedTier.rarity;
  const isShiny = pick.isShiny;

  let pokemonId: number | null = null;
  let fetchedPokemon: Awaited<ReturnType<typeof fetchPokemon>> | null = null;
  let rarity: string | null = null;

  const maxAttempts = 80;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidateId = 1 + Math.floor(Math.random() * MAX_POKEDEX_ID);
    const candidate = await fetchPokemon(candidateId);
    if (!candidate) continue;

    const candidateRarity = classifyRarity(candidate);
    if (candidateRarity !== targetRarity) continue;

    pokemonId = candidateId;
    fetchedPokemon = candidate;
    rarity = candidateRarity;
    break;
  }

  if (!fetchedPokemon || pokemonId == null || !rarity) {
    return { error: "Failed to roll a Pokémon for this rarity (try again)" as const };
  }

  const sprite = isShiny ? fetchedPokemon.spriteShiny : fetchedPokemon.spriteDefault;

  return {
    pokemonId,
    fetchedPokemon,
    rarity,
    isShiny,
    sprite,
  };
}

export async function POST() {
  try {
    // 1. Retrieve the session
    const session = await auth();
    const isGuest = !session || !session.user || !session.user.id;

    // Mode invité: pas de DB, pas de limite serveur, stockage côté client
    if (isGuest) {
      const rolled = await rollPokemonForEgg();
      if ("error" in rolled) {
        return NextResponse.json({ error: rolled.error }, { status: 500 });
      }

      const hatchedPokemon = {
        pokedexId: rolled.pokemonId,
        name: rolled.fetchedPokemon.name,
        types: rolled.fetchedPokemon.types,
        sprite: rolled.sprite,
        isShiny: rolled.isShiny,
        rarity: rolled.rarity,
        count: 1,
        hatchedAt: new Date(),
      };

      return NextResponse.json(
        {
          isGuest: true,
          hatchedPokemon,
        },
        { status: 200 }
      );
    }

    // 2. Connect to the database
    await connectToDb();

    // 3. Retrieve the user
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4. Check if the egg has already been hatched today (unless bypass is enabled)
    const now = new Date();
    const lastHatchDate = user.lastHatchDate as Date | null;

    if (lastHatchDate) {
      const sameDay =
        lastHatchDate.getFullYear() === now.getFullYear() &&
        lastHatchDate.getMonth() === now.getMonth() &&
        lastHatchDate.getDate() === now.getDate();

      if (sameDay) {
        return NextResponse.json(
          { error: "Egg already hatched today" },
          { status: 429 }
        );
      }
    }

    // 5. Gacha: tirage du tier (chance) puis sélection d'un Pokémon qui correspond
    const rolled = await rollPokemonForEgg();
    if ("error" in rolled) {
      return NextResponse.json({ error: rolled.error }, { status: 500 });
    }

    const pokemonId = rolled.pokemonId;
    const fetchedPokemon = rolled.fetchedPokemon;
    const rarity = rolled.rarity;
    const isShiny = rolled.isShiny;
    const sprite = rolled.sprite;

    // 6. Update streak based on lastHatchDate (yesterday => +1, otherwise reset to 1)
    let streak = 1;
    if (lastHatchDate) {
      const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      );

      const wasYesterday =
        lastHatchDate.getFullYear() === yesterday.getFullYear() &&
        lastHatchDate.getMonth() === yesterday.getMonth() &&
        lastHatchDate.getDate() === yesterday.getDate();

      streak = wasYesterday ? (user.streak || 0) + 1 : 1;
    }

    user.streak = streak;
    user.bestStreak = Math.max(user.bestStreak || 0, streak);
    user.lastHatchDate = now;

    // 7. Update totals
    user.totalHatchedPokemons = (user.totalHatchedPokemons || 0) + 1;
    if (isShiny) {
      user.totalShinyHatchedPokemons =
        (user.totalShinyHatchedPokemons || 0) + 1;
    }

    // 8. Handle duplicate Pokémon or create a new entry
    const existingPokemon = user.pokemons.find(
      (p: any) =>
        p.pokedexId === pokemonId && p.isShiny === isShiny
    );

    const hatchedAt = now;
    let hatchedPokemon;

    if (existingPokemon) {
      existingPokemon.count = (existingPokemon.count || 0) + 1;
      existingPokemon.hatchedAt = hatchedAt;
      hatchedPokemon = existingPokemon;
    } else {
      const newPokemon = {
        pokedexId: pokemonId,
        name: fetchedPokemon.name,
        types: fetchedPokemon.types,
        sprite,
        isShiny,
        rarity,
        count: 1,
        hatchedAt,
      };
      user.pokemons.push(newPokemon as any);
      hatchedPokemon = newPokemon;
    }

    // 8bis. S'assurer que tous les pokémons ont bien un sprite / types
    user.pokemons.forEach((p: any) => {
      if (!p.sprite) {
        p.sprite = "https://example.com/mock-sprite.png";
      }
      if (!p.types) {
        p.types = [];
      }
    });

    await user.save();

    // 9. Return the result
    return NextResponse.json(
      {
        hatchedPokemon,
        streak: user.streak,
        bestStreak: user.bestStreak,
        totalHatchedPokemons: user.totalHatchedPokemons,
        totalShinyHatchedPokemons: user.totalShinyHatchedPokemons,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during hatching:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
