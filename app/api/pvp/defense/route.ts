import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { classifyRarity } from "@/app/lib/gacha/hatch-pokemon";

// GET — return current defense team, wins/losses
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id).lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      defenseTeam: user.pvpDefenseTeam ?? [],
      pvpWins: user.pvpWins ?? 0,
      pvpLosses: user.pvpLosses ?? 0,
      pvpElo: user.pvpElo ?? 1000,
    });
  } catch (error) {
    console.error("pvp/defense GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — set defense team (1–3 pokemon)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { pokemons: { pokedexId: number; isShiny: boolean }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { pokemons } = body;
  if (!Array.isArray(pokemons) || pokemons.length < 1 || pokemons.length > 3) {
    return NextResponse.json({ error: "Provide 1–3 Pokémon" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id).lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const activeExpIds = (user.activeExpeditions ?? []).map((e: any) => `${e.pokedexId}-${e.isShiny}`);

    // Validate each pokemon is in the collection and not on expedition
    const defenseTeam = [];
    for (const req of pokemons) {
      const key = `${req.pokedexId}-${req.isShiny}`;
      if (activeExpIds.includes(key)) {
        return NextResponse.json({ error: `Pokémon #${req.pokedexId} est en expédition` }, { status: 400 });
      }
      const owned = (user.pokemons ?? []).find(
        (p: any) => p.pokedexId === req.pokedexId && p.isShiny === req.isShiny
      );
      if (!owned) {
        return NextResponse.json({ error: `Pokémon #${req.pokedexId} introuvable dans la collection` }, { status: 400 });
      }

      // Fetch stats from PokeAPI
      const pData = await fetchPokemon(req.pokedexId);
      if (!pData) {
        return NextResponse.json({ error: `Impossible de charger Pokémon #${req.pokedexId}` }, { status: 500 });
      }

      const rarity = classifyRarity(pData);
      const sprite = req.isShiny ? pData.spriteShiny : pData.spriteDefault;

      defenseTeam.push({
        pokedexId: req.pokedexId,
        isShiny: req.isShiny,
        name: owned.name,
        sprite,
        rarity,
        types: pData.types,
        baseHP: pData.stats.hp,
        baseATK: pData.stats.attack,
        baseDEF: pData.stats.defense,
      });
    }

    await User.findByIdAndUpdate(
      session.user.id,
      { $set: { pvpDefenseTeam: defenseTeam } },
      { strict: false }
    );

    return NextResponse.json({ defenseTeam });
  } catch (error) {
    console.error("pvp/defense POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
