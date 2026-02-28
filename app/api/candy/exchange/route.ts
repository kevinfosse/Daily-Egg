import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

const CANDY_VALUE: Record<string, number> = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 30,
  legendary: 100,
};

const SHINY_MULTIPLIER = 5;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { pokedexId, isShiny } = await req.json();
  if (typeof pokedexId !== "number") {
    return NextResponse.json({ error: "Invalid pokedexId" }, { status: 400 });
  }

  await connectToDb();

  // lean() = objet JS brut depuis MongoDB, bypasse le cache du schéma Mongoose
  const user = await User.findById(session.user.id).lean() as any;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const pokemonIndex = (user.pokemons as any[]).findIndex(
    (p) => p.pokedexId === pokedexId && p.isShiny === !!isShiny
  );

  if (pokemonIndex === -1) {
    return NextResponse.json({ error: "Pokemon not found" }, { status: 404 });
  }

  const pokemon = user.pokemons[pokemonIndex];
  const duplicates = (pokemon.count || 1) - 1;
  if (duplicates <= 0) {
    return NextResponse.json({ error: "Aucun doublon à convertir" }, { status: 400 });
  }

  const baseValue = CANDY_VALUE[pokemon.rarity] ?? 1;
  const multiplier = pokemon.isShiny ? SHINY_MULTIPLIER : 1;
  const candyEarned = duplicates * baseValue * multiplier;

  // findByIdAndUpdate + lean() : atomique ET retourne l'objet brut MongoDB (bypasse le cache schéma)
  const updated = await User.findByIdAndUpdate(
    user._id,
    {
      $set: { [`pokemons.${pokemonIndex}.count`]: 1 },
      $inc: { candy: candyEarned },
    },
    { new: true, strict: false }  // strict:false = Mongoose ne supprime pas les champs absents du schéma en cache
  ).lean() as any;

  const newCandy = updated?.candy ?? 0;

  return NextResponse.json({
    candyEarned,
    candy: newCandy,
    pokemonName: pokemon.name,
  });
}
