import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { ITEMS } from "@/app/lib/items/config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { itemId?: string; pokedexId?: number; isShiny?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { itemId, pokedexId, isShiny = false } = body;
  if (!itemId || !ITEMS[itemId]) {
    return NextResponse.json({ error: "Item invalide" }, { status: 400 });
  }
  if (!pokedexId || isNaN(pokedexId)) {
    return NextResponse.json({ error: "pokedexId invalide" }, { status: 400 });
  }

  const itemDef = ITEMS[itemId];
  if (itemDef.type !== "held") {
    return NextResponse.json({ error: "Cet objet est un consommable, pas un objet tenu" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const inventory: any[] = (user as any).inventory ?? [];
    const itemIdx = inventory.findIndex((i: any) => i.itemId === itemId);

    if (itemIdx === -1 || inventory[itemIdx].quantity < 1) {
      return NextResponse.json({ error: "Objet non disponible dans l'inventaire" }, { status: 400 });
    }

    const pokemons: any[] = (user as any).pokemons ?? [];
    const activeExpeditions: any[] = (user as any).activeExpeditions ?? [];

    // Check not on expedition
    const onExpedition = activeExpeditions.some(
      (e: any) => e.pokedexId === pokedexId && e.isShiny === isShiny
    );
    if (onExpedition) {
      return NextResponse.json({ error: "Ce Pokémon est en expédition" }, { status: 400 });
    }

    // Check owned
    const pokemonIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );
    if (pokemonIdx === -1) {
      return NextResponse.json({ error: "Pokémon non possédé" }, { status: 400 });
    }

    const pokemon = pokemons[pokemonIdx];

    // If pokemon already has an item, return it to inventory
    if (pokemon.equippedItem) {
      const returnedItemIdx = inventory.findIndex((i: any) => i.itemId === pokemon.equippedItem);
      if (returnedItemIdx !== -1) {
        inventory[returnedItemIdx].quantity += 1;
      } else {
        inventory.push({ itemId: pokemon.equippedItem, quantity: 1 });
      }
    }

    // Decrement inventory for new item
    inventory[itemIdx].quantity -= 1;
    if (inventory[itemIdx].quantity <= 0) {
      inventory.splice(itemIdx, 1);
    }

    // Equip item on pokemon
    pokemon.equippedItem = itemId;

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
    console.error("POST /api/items/equip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
