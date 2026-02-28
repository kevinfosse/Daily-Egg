import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { secureRandom } from "@/app/lib/gacha/config";

interface Rewards {
  candy: number;
  bonusEggs: number;
  mysteryTickets: number;
  itemDropped?: string;
}

function rollItemDrop(rarity: string): string | null {
  const roll = secureRandom();
  if (rarity === "rare") {
    if (roll < 0.15) {
      return secureRandom() < 0.5 ? "amulet_coin" : "lum_berry";
    }
  } else if (rarity === "epic") {
    if (roll < 0.25) {
      const r2 = secureRandom();
      if (r2 < 0.33) return "amulet_coin";
      if (r2 < 0.66) return "macho_brace";
      return "incense_rare";
    }
  } else if (rarity === "legendary") {
    return secureRandom() < 0.5 ? "macho_brace" : "incense_epic";
  }
  return null;
}

function computeRewards(rarity: string, isShiny: boolean): Rewards {
  let candy = 0;
  let bonusEggs = 0;
  let mysteryTickets = 0;

  switch (rarity) {
    case "common":
      candy = 5 + Math.floor(secureRandom() * 11); // 5-15
      break;
    case "uncommon":
      candy = 15 + Math.floor(secureRandom() * 16); // 15-30
      break;
    case "rare":
      candy = 30 + Math.floor(secureRandom() * 31); // 30-60
      if (secureRandom() < 0.1) bonusEggs = 1;
      break;
    case "epic":
      candy = 60 + Math.floor(secureRandom() * 61); // 60-120
      if (secureRandom() < 0.2) bonusEggs = 1;
      break;
    case "legendary":
      candy = 100 + Math.floor(secureRandom() * 101); // 100-200
      bonusEggs = 1; // guaranteed
      if (secureRandom() < 0.15) mysteryTickets = 1;
      break;
    default:
      candy = 5;
  }

  if (isShiny) {
    candy *= 2;
    bonusEggs *= 2;
  }

  return { candy, bonusEggs, mysteryTickets };
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

    const activeExpeditions: any[] = (user as any).activeExpeditions ?? [];
    const expIdx = activeExpeditions.findIndex(
      (e: any) => e.pokedexId === pokedexId && e.isShiny === isShiny
    );

    if (expIdx === -1) {
      return NextResponse.json({ error: "Expédition introuvable" }, { status: 400 });
    }

    const expedition = activeExpeditions[expIdx];
    const now = new Date();
    const endsAt = new Date(expedition.endsAt);
    const equippedItem: string | null = expedition.equippedItem ?? null;

    // lum_berry allows claiming 30 min early
    const lumBerryOffset = equippedItem === "lum_berry" ? 30 * 60 * 1000 : 0;
    if (endsAt.getTime() - lumBerryOffset > now.getTime()) {
      return NextResponse.json({ error: "Expédition pas encore terminée" }, { status: 400 });
    }

    // Compute rewards
    const rewards = computeRewards(expedition.pokemonRarity, expedition.isShiny);

    // Apply held item effects
    if (equippedItem === "amulet_coin") {
      rewards.candy *= 2;
    }
    if (equippedItem === "macho_brace") {
      rewards.bonusEggs = Math.max(rewards.bonusEggs, 1);
    }

    // Roll item drop from expedition
    const droppedItem = rollItemDrop(expedition.pokemonRarity);
    if (droppedItem) {
      rewards.itemDropped = droppedItem;
      const inventory: any[] = (user as any).inventory ?? [];
      const invIdx = inventory.findIndex((i: any) => i.itemId === droppedItem);
      if (invIdx !== -1) {
        inventory[invIdx].quantity += 1;
      } else {
        inventory.push({ itemId: droppedItem, quantity: 1 });
      }
      (user as any).inventory = inventory;
      user.markModified("inventory");
    }

    // Apply rewards
    (user as any).candy = ((user as any).candy ?? 0) + rewards.candy;
    if (rewards.bonusEggs > 0) {
      (user as any).bonusEggs = ((user as any).bonusEggs ?? 0) + rewards.bonusEggs;
    }
    if (rewards.mysteryTickets > 0) {
      (user as any).mysteryTickets = ((user as any).mysteryTickets ?? 0) + rewards.mysteryTickets;
    }

    // Return pokemon to collection
    const pokemons: any[] = (user as any).pokemons ?? [];
    const returnIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );

    if (returnIdx !== -1) {
      pokemons[returnIdx].count = (pokemons[returnIdx].count ?? 1) + 1;
      // Restore equippedItem on return
      if (equippedItem) {
        pokemons[returnIdx].equippedItem = equippedItem;
      }
    } else {
      pokemons.push({
        pokedexId: expedition.pokedexId,
        name: expedition.pokemonName,
        types: [],
        sprite: expedition.pokemonSprite,
        isShiny: expedition.isShiny,
        rarity: expedition.pokemonRarity,
        count: 1,
        hatchedAt: new Date(),
        equippedItem: equippedItem ?? null,
      });
    }

    // Remove expedition
    activeExpeditions.splice(expIdx, 1);

    (user as any).pokemons = pokemons;
    (user as any).activeExpeditions = activeExpeditions;
    user.markModified("pokemons");
    user.markModified("activeExpeditions");
    await user.save();

    return NextResponse.json({
      rewards,
      candy: (user as any).candy,
      bonusEggs: (user as any).bonusEggs ?? 0,
      mysteryTickets: (user as any).mysteryTickets ?? 0,
      expeditions: activeExpeditions,
      inventory: (user as any).inventory ?? [],
    });
  } catch (error) {
    console.error("Expeditions claim error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
