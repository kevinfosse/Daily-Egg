import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";

// In-memory cache for evolution chains
const chainCache = new Map<number, any>();

const CANDY_COST: Record<string, number> = {
  common: 25,
  uncommon: 50,
  rare: 100,
  epic: 200,
};

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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pokedexId = Number(searchParams.get("pokedexId"));
  if (!pokedexId || isNaN(pokedexId)) {
    return NextResponse.json({ error: "Invalid pokedexId" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id).lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check user has this pokemon
    const owned = (user.pokemons || []).find((p: any) => p.pokedexId === pokedexId);
    if (!owned) {
      return NextResponse.json({ canEvolve: false, reason: "not_owned" });
    }

    // Current rarity determines cost
    const currentRarity = owned.rarity as string;
    if (currentRarity === "legendary") {
      return NextResponse.json({ canEvolve: false, reason: "final_evolution" });
    }

    const candyCost = CANDY_COST[currentRarity] ?? 999;

    // Fetch species to get evolution chain URL
    let chainId: number;
    try {
      let speciesRes: Response;
      if (chainCache.has(-pokedexId)) {
        chainId = chainCache.get(-pokedexId);
      } else {
        speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokedexId}`);
        if (!speciesRes.ok) return NextResponse.json({ canEvolve: false, reason: "api_error" });
        const species = await speciesRes.json();
        const chainUrl: string = species.evolution_chain?.url ?? "";
        chainId = extractIdFromUrl(chainUrl);
        chainCache.set(-pokedexId, chainId);
      }
    } catch {
      return NextResponse.json({ canEvolve: false, reason: "api_error" });
    }

    // Fetch evolution chain (cached)
    let chainData: any;
    if (chainCache.has(chainId)) {
      chainData = chainCache.get(chainId);
    } else {
      try {
        const chainRes = await fetch(`https://pokeapi.co/api/v2/evolution-chain/${chainId}`);
        if (!chainRes.ok) return NextResponse.json({ canEvolve: false, reason: "api_error" });
        const chainJson = await chainRes.json();
        chainData = chainJson.chain;
        chainCache.set(chainId, chainData);
      } catch {
        return NextResponse.json({ canEvolve: false, reason: "api_error" });
      }
    }

    // Find next evolution
    const nextId = findNextEvolutionId(chainData, pokedexId);
    if (!nextId) {
      return NextResponse.json({ canEvolve: false, reason: "final_evolution" });
    }

    // Fetch next pokemon data
    const nextPokemon = await fetchPokemon(nextId);
    if (!nextPokemon) {
      return NextResponse.json({ canEvolve: false, reason: "api_error" });
    }

    const nextRarity = classifyRarity(nextPokemon);

    return NextResponse.json({
      canEvolve: true,
      nextEvolution: {
        id: nextId,
        name: nextPokemon.name,
        sprite: nextPokemon.spriteDefault,
        types: nextPokemon.types,
        rarity: nextRarity,
      },
      candyCost,
      userCandy: user.candy ?? 0,
    });
  } catch (error) {
    console.error("Evolve info error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
