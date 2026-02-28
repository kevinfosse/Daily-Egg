import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";

const CANDY_COST: Record<string, number> = {
  common: 25,
  uncommon: 50,
  rare: 100,
  epic: 200,
};

// In-memory cache for evolution chains (shared with info route in practice via module cache)
const chainCache = new Map<number, any>();

function extractIdFromUrl(url: string): number {
  const parts = url.split("/").filter(Boolean);
  return Number(parts[parts.length - 1]);
}

function findNextEvolutionId(chain: any, speciesId: number): number | null {
  function traverse(node: any): { found: boolean; nextId: number | null } {
    const nodeId = extractIdFromUrl(node.species.url);
    if (nodeId === speciesId) {
      if (node.evolves_to && node.evolves_to.length > 0) {
        return { found: true, nextId: extractIdFromUrl(node.evolves_to[0].species.url) };
      }
      return { found: true, nextId: null };
    }
    for (const child of node.evolves_to || []) {
      const result = traverse(child);
      if (result.found) return result;
    }
    return { found: false, nextId: null };
  }
  return traverse(chain).nextId;
}

async function getNextEvolutionId(pokedexId: number): Promise<number | null> {
  // Fetch species
  let chainId: number;
  const speciesCacheKey = -pokedexId;
  if (chainCache.has(speciesCacheKey)) {
    chainId = chainCache.get(speciesCacheKey);
  } else {
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokedexId}`);
    if (!speciesRes.ok) return null;
    const species = await speciesRes.json();
    const chainUrl: string = species.evolution_chain?.url ?? "";
    chainId = extractIdFromUrl(chainUrl);
    chainCache.set(speciesCacheKey, chainId);
  }

  // Fetch chain
  let chainData: any;
  if (chainCache.has(chainId)) {
    chainData = chainCache.get(chainId);
  } else {
    const chainRes = await fetch(`https://pokeapi.co/api/v2/evolution-chain/${chainId}`);
    if (!chainRes.ok) return null;
    const chainJson = await chainRes.json();
    chainData = chainJson.chain;
    chainCache.set(chainId, chainData);
  }

  return findNextEvolutionId(chainData, pokedexId);
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

    const pokemons: any[] = (user as any).pokemons ?? [];
    const ownedIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );

    if (ownedIdx === -1) {
      return NextResponse.json({ error: "Pokémon not in collection" }, { status: 400 });
    }

    const owned = pokemons[ownedIdx];
    const currentRarity = owned.rarity as string;

    if (currentRarity === "legendary") {
      return NextResponse.json({ error: "Évolution finale" }, { status: 400 });
    }

    const candyCost = CANDY_COST[currentRarity] ?? 999;
    const userCandy = (user as any).candy ?? 0;
    const freeEvolve = (user as any).freeEvolveReady === true;

    if (!freeEvolve && userCandy < candyCost) {
      return NextResponse.json({ error: "Pas assez de candy" }, { status: 400 });
    }

    // Find next evolution
    const nextId = await getNextEvolutionId(pokedexId);
    if (!nextId) {
      return NextResponse.json({ error: "Évolution finale" }, { status: 400 });
    }

    const nextPokemon = await fetchPokemon(nextId);
    if (!nextPokemon) {
      return NextResponse.json({ error: "Impossible de récupérer l'évolution" }, { status: 500 });
    }

    const nextRarity = classifyRarity(nextPokemon);
    const nextSprite = isShiny ? nextPokemon.spriteShiny : nextPokemon.spriteDefault;

    // Decrement / remove original
    if (owned.count <= 1) {
      pokemons.splice(ownedIdx, 1);
    } else {
      owned.count -= 1;
    }

    // Add / increment evolved pokemon
    const evolvedIdx = pokemons.findIndex(
      (p: any) => p.pokedexId === nextId && p.isShiny === isShiny
    );

    let evolvedEntry: any;
    if (evolvedIdx !== -1) {
      pokemons[evolvedIdx].count = (pokemons[evolvedIdx].count ?? 1) + 1;
      pokemons[evolvedIdx].hatchedAt = new Date();
      evolvedEntry = pokemons[evolvedIdx];
    } else {
      evolvedEntry = {
        pokedexId: nextId,
        name: nextPokemon.name,
        types: nextPokemon.types,
        sprite: nextSprite,
        isShiny,
        rarity: nextRarity,
        count: 1,
        hatchedAt: new Date(),
      };
      pokemons.push(evolvedEntry);
    }

    // Deduct candy (or consume free evolve)
    if (freeEvolve) {
      (user as any).freeEvolveReady = false;
    } else {
      (user as any).candy = userCandy - candyCost;
    }

    (user as any).pokemons = pokemons;
    user.markModified("pokemons");
    await user.save();

    return NextResponse.json({
      evolved: evolvedEntry,
      candy: (user as any).candy,
    });
  } catch (error) {
    console.error("Evolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
