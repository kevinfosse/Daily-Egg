import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import WonderTrade from "@/app/lib/models/WonderTrade";
import { auth } from "@/app/lib/auth/auth-options";
import { rollPokemonForEgg } from "@/app/lib/gacha/hatch-pokemon";
import { advanceMissionsOnDoc } from "@/app/lib/missions/tracker";

const MAX_TRADES_PER_DAY = 3;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await connectToDb();
    const user = await User.findById(session.user.id).select(
      "wonderTradesToday lastWonderTradeDate"
    );

    const now = new Date();
    let tradesUsed = 0;
    if (user?.lastWonderTradeDate && isSameDay(user.lastWonderTradeDate, now)) {
      tradesUsed = user.wonderTradesToday || 0;
    }

    const poolSize = await WonderTrade.countDocuments();

    return NextResponse.json({
      tradesRemaining: MAX_TRADES_PER_DAY - tradesUsed,
      poolSize,
    });
  } catch (error) {
    console.error("Error GET /api/wonder-trade:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { pokedexId, isShiny = false } = body;

    if (typeof pokedexId !== "number") {
      return NextResponse.json({ error: "pokedexId requis" }, { status: 400 });
    }

    await connectToDb();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Check daily limit
    const now = new Date();
    if (user.lastWonderTradeDate && isSameDay(user.lastWonderTradeDate, now)) {
      if ((user.wonderTradesToday || 0) >= MAX_TRADES_PER_DAY) {
        return NextResponse.json({ error: "Limite d'échanges atteinte (3/jour)" }, { status: 429 });
      }
    } else {
      // New day, reset counter
      user.wonderTradesToday = 0;
    }

    // Find the pokemon to trade
    const pokemonIndex = user.pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );

    if (pokemonIndex === -1) {
      return NextResponse.json({ error: "Pokémon non trouvé" }, { status: 404 });
    }

    const tradedPokemon = user.pokemons[pokemonIndex];

    // Block legendary trades
    if (tradedPokemon.rarity === "legendary") {
      return NextResponse.json({ error: "Impossible d'échanger un Légendaire !" }, { status: 403 });
    }

    // Remove from collection
    if (tradedPokemon.count > 1) {
      user.pokemons[pokemonIndex].count -= 1;
    } else {
      user.pokemons.splice(pokemonIndex, 1);
    }

    // Try to pick from pool (exclude own deposits)
    const poolPokemon = await WonderTrade.findOneAndDelete({
      depositorId: { $ne: session.user.id },
    });

    let receivedPokemon;

    if (poolPokemon) {
      receivedPokemon = poolPokemon.pokemon;
    } else {
      // Pool empty: generate a random wild pokemon
      const rolled = await rollPokemonForEgg();
      if ("error" in rolled) {
        // Refund the pokemon
        if (tradedPokemon.count > 1) {
          user.pokemons[pokemonIndex].count += 1;
        } else {
          user.pokemons.push(tradedPokemon);
        }
        await user.save();
        return NextResponse.json({ error: rolled.error }, { status: 500 });
      }
      receivedPokemon = {
        pokedexId: rolled.pokemonId,
        name: rolled.fetchedPokemon.name,
        types: rolled.fetchedPokemon.types,
        sprite: rolled.sprite,
        isShiny: rolled.isShiny,
        rarity: rolled.rarity,
      };
    }

    // Add received pokemon to collection
    const existingIndex = user.pokemons.findIndex(
      (p: any) => p.pokedexId === receivedPokemon.pokedexId && p.isShiny === receivedPokemon.isShiny
    );

    if (existingIndex !== -1) {
      user.pokemons[existingIndex].count += 1;
      user.pokemons[existingIndex].hatchedAt = now;
    } else {
      user.pokemons.push({
        ...receivedPokemon,
        count: 1,
        hatchedAt: now,
      } as any);
    }

    // Deposit traded pokemon into pool
    await WonderTrade.create({
      depositorId: session.user.id,
      depositorUsername: user.username,
      pokemon: {
        pokedexId: tradedPokemon.pokedexId,
        name: tradedPokemon.name,
        types: tradedPokemon.types,
        sprite: tradedPokemon.sprite,
        isShiny: tradedPokemon.isShiny,
        rarity: tradedPokemon.rarity,
      },
    });

    // Update trade counters
    user.lastWonderTradeDate = now;
    user.wonderTradesToday = (user.wonderTradesToday || 0) + 1;

    // Track collect_type mission if applicable
    if (receivedPokemon.types && receivedPokemon.types.length > 0) {
      for (const type of receivedPokemon.types) {
        advanceMissionsOnDoc(user, "collect_type", type);
      }
    }

    await user.save();

    return NextResponse.json({
      success: true,
      traded: {
        pokedexId: tradedPokemon.pokedexId,
        name: tradedPokemon.name,
        rarity: tradedPokemon.rarity,
        isShiny: tradedPokemon.isShiny,
      },
      received: receivedPokemon,
      tradesRemaining: MAX_TRADES_PER_DAY - user.wonderTradesToday,
    });
  } catch (error) {
    console.error("Error POST /api/wonder-trade:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
