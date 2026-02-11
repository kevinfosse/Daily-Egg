import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { eggSpinningWheel } from "@/app/lib/gacha/config";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";

export async function POST() {
  try {
    const bypassDailyLimit =
      process.env.BYPASS_HATCH_DAILY_LIMIT === "true";
    // 1. Retrieve the session
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
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

    if (!bypassDailyLimit && lastHatchDate) {
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

    // 5. Gacha: determine which Pokémon is hatched
    const { selectedTier, pokemonId, isShiny } = eggSpinningWheel();
    const fetchedPokemon = await fetchPokemon(pokemonId);
    if (!fetchedPokemon) {
      return NextResponse.json(
        { error: "Failed to fetch Pokémon data" },
        { status: 500 }
      );
    }

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
        p.pokedexId === (pokemonId) && p.isShiny === isShiny
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
        sprite: fetchedPokemon.sprite,
        isShiny,
        rarity: selectedTier.rarity,
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
