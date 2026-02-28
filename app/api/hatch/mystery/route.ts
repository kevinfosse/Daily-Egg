import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { rollPokemonForMystery } from "@/app/lib/gacha/hatch-pokemon";
import { advanceMissionsOnDoc } from "@/app/lib/missions/tracker";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await connectToDb();

    // Atomic decrement — only if mysteryTickets > 0
    const user = await User.findOneAndUpdate(
      { _id: session.user.id, mysteryTickets: { $gt: 0 } },
      { $inc: { mysteryTickets: -1 } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: "Pas de ticket mystère disponible" }, { status: 400 });
    }

    const rolled = await rollPokemonForMystery();
    if ("error" in rolled) {
      // Refund the ticket on failure
      await User.findByIdAndUpdate(session.user.id, { $inc: { mysteryTickets: 1 } });
      return NextResponse.json({ error: rolled.error }, { status: 500 });
    }

    const { pokemonId, fetchedPokemon, rarity, isShiny, sprite } = rolled;
    const now = new Date();

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
      mysteryTickets: user.mysteryTickets,
      totalHatchedPokemons: user.totalHatchedPokemons,
      totalShinyHatchedPokemons: user.totalShinyHatchedPokemons,
    });
  } catch (error) {
    console.error("Error during mystery hatch:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
