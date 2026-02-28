import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { rollPokemonForEgg } from "@/app/lib/gacha/hatch-pokemon";
import { advanceMissionsOnDoc } from "@/app/lib/missions/tracker";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await connectToDb();

    // Atomic decrement — only if bonusEggs > 0
    const user = await User.findOneAndUpdate(
      { _id: session.user.id, bonusEggs: { $gt: 0 } },
      { $inc: { bonusEggs: -1 } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "Pas d'oeuf bonus disponible" }, { status: 400 });
    }

    const rolled = await rollPokemonForEgg();
    if ("error" in rolled) {
      // Refund the egg on failure
      await User.findByIdAndUpdate(session.user.id, { $inc: { bonusEggs: 1 } });
      return NextResponse.json({ error: rolled.error }, { status: 500 });
    }

    const { pokemonId, fetchedPokemon, rarity, isShiny, sprite } = rolled;
    const now = new Date();

    // No streak update for bonus eggs
    user.totalHatchedPokemons = (user.totalHatchedPokemons || 0) + 1;
    if (isShiny) {
      user.totalShinyHatchedPokemons = (user.totalShinyHatchedPokemons || 0) + 1;
    }

    const existingPokemon = user.pokemons.find(
      (p: any) => p.pokedexId === pokemonId && p.isShiny === isShiny
    );

    let hatchedPokemon;
    if (existingPokemon) {
      existingPokemon.count = (existingPokemon.count || 0) + 1;
      existingPokemon.hatchedAt = now;
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
        hatchedAt: now,
      };
      user.pokemons.push(newPokemon as any);
      hatchedPokemon = newPokemon;
    }

    // Track missions
    if (fetchedPokemon.types && fetchedPokemon.types.length > 0) {
      for (const type of fetchedPokemon.types) {
        advanceMissionsOnDoc(user, "collect_type", type);
      }
    }

    user.markModified('pokemons');
    await user.save();

    return NextResponse.json({
      hatchedPokemon,
      bonusEggs: user.bonusEggs,
      totalHatchedPokemons: user.totalHatchedPokemons,
      totalShinyHatchedPokemons: user.totalShinyHatchedPokemons,
    });
  } catch (error) {
    console.error("Error during bonus hatch:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
