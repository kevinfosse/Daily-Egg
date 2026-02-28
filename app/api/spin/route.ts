import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth/auth-options";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { RARITY_CONFIG, SHINY_RATE, secureRandom } from "@/app/lib/gacha/config";
import { Rarity } from "@/app/types";
import { advanceMissionsOnDoc } from "@/app/lib/missions/tracker";
import { ALL_ITEM_IDS } from "@/app/lib/items/config";

// Configuration des résultats du spin
const SPIN_RESULTS = [
  { id: "downgrade", label: "Downgrade", probability: 20 },
  { id: "same", label: "Échange", probability: 42 },
  { id: "upgrade", label: "Upgrade", probability: 25 },
  { id: "ticket", label: "Ticket Mystère", probability: 8 },
  { id: "egg", label: "Œuf Bonus", probability: 2 },
  { id: "item", label: "Objet !", probability: 3 },
] as const;

type SpinResultId = typeof SPIN_RESULTS[number]["id"];

// secureRandom imported from config

// Tirage pondéré du résultat
function getSpinResult(): typeof SPIN_RESULTS[number] {
  const random = secureRandom() * 100;
  let cumulative = 0;

  for (const result of SPIN_RESULTS) {
    cumulative += result.probability;
    if (random < cumulative) {
      return result;
    }
  }
  return SPIN_RESULTS[0];
}

// Ordre des raretés
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

// Calculer la nouvelle rareté
function calculateNewRarity(currentRarity: Rarity, resultType: SpinResultId): Rarity {
  const currentIndex = RARITY_ORDER.indexOf(currentRarity);

  switch (resultType) {
    case "upgrade":
      // Max = Epic (pas de Legendary par spin)
      return RARITY_ORDER[Math.min(currentIndex + 1, 3)];
    case "downgrade":
      // Min = Common
      return RARITY_ORDER[Math.max(currentIndex - 1, 0)];
    case "same":
    default:
      return currentRarity;
  }
}

// Générer un Pokémon d'une rareté donnée
async function generatePokemonByRarity(rarity: Rarity) {
  const config = RARITY_CONFIG[rarity.toUpperCase() as keyof typeof RARITY_CONFIG];
  const { min, max } = config.pokemonRange;
  
  const pokemonId = Math.floor(secureRandom() * (max - min + 1)) + min;
  const isShiny = secureRandom() < SHINY_RATE;
  
  const pokemonData = await fetchPokemon(pokemonId);
  
  if (!pokemonData) {
    throw new Error("Impossible de récupérer les données du Pokémon");
  }

  return {
    pokedexId: pokemonId,
    name: pokemonData.name,
    types: pokemonData.types,
    sprite: isShiny ? pokemonData.spriteShiny : pokemonData.spriteDefault,
    isShiny,
    rarity,
    count: 1,
    hatchedAt: new Date(),
  };
}

// Vérifier si même jour
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Temps jusqu'à minuit
function getTimeUntilMidnight() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const diff = tomorrow.getTime() - now.getTime();

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

// GET — Statut du spin
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await connectToDb();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const now = new Date();
    const lastSpinDate = user.lastSpinDate as Date | null;
    const canSpin = !lastSpinDate || !isSameDay(lastSpinDate, now);

    return NextResponse.json({
      success: true,
      data: {
        canSpin,
        timeUntilNext: canSpin ? null : getTimeUntilMidnight(),
        mysteryTickets: user.mysteryTickets || 0,
        bonusEggs: user.bonusEggs || 0,
        pokemons: user.pokemons || [],
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/spin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — Effectuer le spin
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

    // Vérifier cooldown
    const now = new Date();
    if (user.lastSpinDate && isSameDay(user.lastSpinDate, now)) {
      return NextResponse.json(
        { error: "Déjà spinné aujourd'hui", timeUntilNext: getTimeUntilMidnight() },
        { status: 429 }
      );
    }

    // Trouver le Pokémon à sacrifier
    const pokemonIndex = user.pokemons.findIndex(
      (p: any) => p.pokedexId === pokedexId && p.isShiny === isShiny
    );

    if (pokemonIndex === -1) {
      return NextResponse.json(
        { error: "Pokémon non trouvé dans ta collection" },
        { status: 404 }
      );
    }

    const sacrificedPokemon = user.pokemons[pokemonIndex];

    // Bloquer le sacrifice de Legendary
    if (sacrificedPokemon.rarity === "legendary") {
      return NextResponse.json(
        { error: "Impossible de sacrifier un Légendaire !" },
        { status: 403 }
      );
    }

    // Effectuer le spin
    const spinResult = getSpinResult();

    // Retirer le Pokémon sacrifié
    if (sacrificedPokemon.count > 1) {
      user.pokemons[pokemonIndex].count -= 1;
    } else {
      user.pokemons.splice(pokemonIndex, 1);
    }

    // Préparer la réponse
    let reward: any = {
      type: spinResult.id,
      label: spinResult.label,
      sacrificed: {
        pokedexId: sacrificedPokemon.pokedexId,
        name: sacrificedPokemon.name,
        rarity: sacrificedPokemon.rarity,
        isShiny: sacrificedPokemon.isShiny,
      },
    };

    // Appliquer le résultat
    switch (spinResult.id) {
      case "ticket":
        user.mysteryTickets = (user.mysteryTickets || 0) + 1;
        reward.newTotal = user.mysteryTickets;
        break;

      case "egg":
        user.bonusEggs = (user.bonusEggs || 0) + 1;
        reward.newTotal = user.bonusEggs;
        break;

      case "upgrade":
      case "same":
      case "downgrade":
        const newRarity = calculateNewRarity(sacrificedPokemon.rarity, spinResult.id);
        const newPokemon = await generatePokemonByRarity(newRarity);

        // Ajouter ou incrémenter dans la collection
        const existingIndex = user.pokemons.findIndex(
          (p: any) => p.pokedexId === newPokemon.pokedexId && p.isShiny === newPokemon.isShiny
        );

        if (existingIndex !== -1) {
          user.pokemons[existingIndex].count += 1;
        } else {
          user.pokemons.push(newPokemon);
        }

        reward.newPokemon = newPokemon;
        reward.newRarity = newRarity;
        break;

      case "item":
        const randomItemId = ALL_ITEM_IDS[Math.floor(secureRandom() * ALL_ITEM_IDS.length)];
        const spinInventory: any[] = (user as any).inventory ?? [];
        const spinItemIdx = spinInventory.findIndex((i: any) => i.itemId === randomItemId);
        if (spinItemIdx !== -1) {
          spinInventory[spinItemIdx].quantity += 1;
        } else {
          spinInventory.push({ itemId: randomItemId, quantity: 1 });
        }
        (user as any).inventory = spinInventory;
        user.markModified("inventory");
        reward.itemReceived = randomItemId;
        break;
    }

    // Mettre à jour les stats
    user.lastSpinDate = now;
    user.totalSpins = (user.totalSpins || 0) + 1;

    // Track missions
    advanceMissionsOnDoc(user, "spin_daily");

    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        result: reward,
        mysteryTickets: user.mysteryTickets || 0,
        bonusEggs: user.bonusEggs || 0,
        canSpin: false,
        timeUntilNext: getTimeUntilMidnight(),
        inventory: (user as any).inventory ?? [],
        itemReceived: reward.itemReceived ?? null,
      },
    });
  } catch (error) {
    console.error("Erreur POST /api/spin:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}