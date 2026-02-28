import { NextResponse } from "next/server";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";
import { getDailyPokemonId } from "@/app/lib/daily-pokemon";

export async function GET() {
  const pokemonId = getDailyPokemonId();
  const pokemon = await fetchPokemon(pokemonId);

  if (!pokemon) {
    return NextResponse.json({ error: "Featured Pokemon unavailable" }, { status: 500 });
  }

  const rarity = classifyRarity(pokemon);

  return NextResponse.json({
    id: pokemonId,
    name: pokemon.name,
    sprite: pokemon.spriteDefault,
    types: pokemon.types,
    rarity,
  });
}
