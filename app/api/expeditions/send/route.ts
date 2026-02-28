import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

const EXPEDITION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

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

    const activeExpeditions: any[] = (user as any).activeExpeditions ?? [];
    const pokemons: any[] = (user as any).pokemons ?? [];

    const maxSlots = 3 + ((user as any).bonusExpeditionSlots ?? 0);
    if (activeExpeditions.length >= maxSlots) {
      return NextResponse.json({ error: `Slots d'expédition pleins (max ${maxSlots})` }, { status: 400 });
    }

    // Check not already on expedition
    const alreadyOnExpedition = activeExpeditions.some(
      (e: any) => e.pokedexId === pokedexId && e.isShiny === isShiny
    );
    if (alreadyOnExpedition) {
      return NextResponse.json({ error: "Ce Pokémon est déjà en expédition" }, { status: 400 });
    }

    // Check user owns this pokemon
    const ownedIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );
    if (ownedIdx === -1) {
      return NextResponse.json({ error: "Pokémon non possédé" }, { status: 400 });
    }

    const owned = pokemons[ownedIdx];

    // Decrement count or remove
    if (owned.count <= 1) {
      pokemons.splice(ownedIdx, 1);
    } else {
      owned.count -= 1;
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + EXPEDITION_DURATION_MS);

    activeExpeditions.push({
      pokedexId,
      isShiny,
      pokemonName: owned.name,
      pokemonSprite: owned.sprite,
      pokemonRarity: owned.rarity,
      startedAt: now,
      endsAt,
      equippedItem: owned.equippedItem ?? null,
    });

    (user as any).pokemons = pokemons;
    (user as any).activeExpeditions = activeExpeditions;
    user.markModified("pokemons");
    user.markModified("activeExpeditions");
    await user.save();

    return NextResponse.json({ expeditions: activeExpeditions });
  } catch (error) {
    console.error("Expeditions send error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
