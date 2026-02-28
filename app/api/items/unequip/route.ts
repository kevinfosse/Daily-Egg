import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

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
    return NextResponse.json({ error: "pokedexId invalide" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pokemons: any[] = (user as any).pokemons ?? [];
    const pokemonIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );

    if (pokemonIdx === -1) {
      return NextResponse.json({ error: "Pokémon non possédé" }, { status: 400 });
    }

    const pokemon = pokemons[pokemonIdx];
    if (!pokemon.equippedItem) {
      return NextResponse.json({ error: "Aucun objet équipé sur ce Pokémon" }, { status: 400 });
    }

    const unequippedItemId = pokemon.equippedItem;
    const inventory: any[] = (user as any).inventory ?? [];

    // Return item to inventory
    const itemIdx = inventory.findIndex((i: any) => i.itemId === unequippedItemId);
    if (itemIdx !== -1) {
      inventory[itemIdx].quantity += 1;
    } else {
      inventory.push({ itemId: unequippedItemId, quantity: 1 });
    }

    // Remove equipped item from pokemon
    pokemon.equippedItem = null;

    (user as any).inventory = inventory;
    (user as any).pokemons = pokemons;
    user.markModified("inventory");
    user.markModified("pokemons");
    await user.save();

    return NextResponse.json({
      pokemons: (user as any).pokemons,
      inventory: (user as any).inventory,
    });
  } catch (error) {
    console.error("POST /api/items/unequip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
