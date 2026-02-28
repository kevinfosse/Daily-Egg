import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { rollPokemonForEgg, rollPokemonForEggWithPity } from "@/app/lib/gacha/hatch-pokemon";
import { advanceMissionsOnDoc } from "@/app/lib/missions/tracker";
import { getDailyPokemonId } from "@/app/lib/daily-pokemon";

// Streak milestone rewards
const STREAK_MILESTONES = [
  { days: 7,   field: "bonusEggs",      amount: 2,  label: "7 jours" },
  { days: 14,  field: "mysteryTickets", amount: 1,  label: "14 jours" },
  { days: 30,  field: "mysteryTickets", amount: 2,  label: "30 jours" },
  { days: 60,  field: "mysteryTickets", amount: 5,  label: "60 jours" },
  { days: 100, field: "mysteryTickets", amount: 10, label: "100 jours" },
] as const;

export async function POST() {
  try {
    const session = await auth();
    const isGuest = !session || !session.user || !session.user.id;

    if (isGuest) {
      const rolled = await rollPokemonForEgg();
      if ("error" in rolled) {
        return NextResponse.json({ error: rolled.error }, { status: 500 });
      }

      const hatchedPokemon = {
        pokedexId: rolled.pokemonId,
        name: rolled.fetchedPokemon.name,
        types: rolled.fetchedPokemon.types,
        sprite: rolled.sprite,
        isShiny: rolled.isShiny,
        rarity: rolled.rarity,
        count: 1,
        hatchedAt: new Date(),
      };

      return NextResponse.json({ isGuest: true, hatchedPokemon }, { status: 200 });
    }

    await connectToDb();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const lastHatchDate = user.lastHatchDate as Date | null;

    if (lastHatchDate) {
      const sameDay =
        lastHatchDate.getFullYear() === now.getFullYear() &&
        lastHatchDate.getMonth() === now.getMonth() &&
        lastHatchDate.getDate() === now.getDate();

      if (sameDay) {
        return NextResponse.json({ error: "Egg already hatched today" }, { status: 429 });
      }
    }

    // Roll with pity system + nextEggMinRarity item effect
    const pityCounter = (user as any).pityCounter ?? 0;
    const RARITY_ORDER_LOCAL = ["common", "uncommon", "rare", "epic", "legendary"];
    const pityMinRarity = pityCounter >= 50 ? "epic" : undefined;
    const itemMinRarity = (user as any).nextEggMinRarity as string | undefined;
    // Combine: take the higher of pity and item min rarity
    let combinedMinRarity: string | undefined = pityMinRarity;
    if (itemMinRarity) {
      if (!combinedMinRarity || RARITY_ORDER_LOCAL.indexOf(itemMinRarity) > RARITY_ORDER_LOCAL.indexOf(combinedMinRarity)) {
        combinedMinRarity = itemMinRarity;
      }
    }
    const rolled = await rollPokemonForEggWithPity(pityCounter, combinedMinRarity);
    if ("error" in rolled) {
      return NextResponse.json({ error: rolled.error }, { status: 500 });
    }

    const { pokemonId, fetchedPokemon, rarity, isShiny, sprite } = rolled;

    // Update pity counter — reset on epic or legendary, otherwise increment
    const isEpicOrBetter = rarity === "epic" || rarity === "legendary";
    (user as any).pityCounter = isEpicOrBetter ? 0 : pityCounter + 1;

    // Update streak
    let streak = 1;
    if (lastHatchDate) {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const wasYesterday =
        lastHatchDate.getFullYear() === yesterday.getFullYear() &&
        lastHatchDate.getMonth() === yesterday.getMonth() &&
        lastHatchDate.getDate() === yesterday.getDate();
      streak = wasYesterday ? (user.streak || 0) + 1 : 1;
    }

    user.streak = streak;
    user.bestStreak = Math.max(user.bestStreak || 0, streak);
    user.lastHatchDate = now;

    // Check streak milestones
    const claimedMilestones: number[] = (user as any).claimedStreakMilestones ?? [];
    const newMilestones: { days: number; field: string; amount: number; label: string }[] = [];
    for (const m of STREAK_MILESTONES) {
      if (streak >= m.days && !claimedMilestones.includes(m.days)) {
        claimedMilestones.push(m.days);
        (user as any)[m.field] = ((user as any)[m.field] ?? 0) + m.amount;
        newMilestones.push({ days: m.days, field: m.field, amount: m.amount, label: m.label });
      }
    }
    if (newMilestones.length > 0) {
      (user as any).claimedStreakMilestones = claimedMilestones;
    }

    user.totalHatchedPokemons = (user.totalHatchedPokemons || 0) + 1;
    if (isShiny) {
      user.totalShinyHatchedPokemons = (user.totalShinyHatchedPokemons || 0) + 1;
    }

    // Handle duplicate or new entry
    const existingPokemon = user.pokemons.find(
      (p: any) => p.pokedexId === pokemonId && p.isShiny === isShiny
    );

    const hatchedAt = now;
    let hatchedPokemon;

    if (existingPokemon) {
      existingPokemon.count = (existingPokemon.count || 0) + 1;
      existingPokemon.hatchedAt = hatchedAt;
      hatchedPokemon = existingPokemon;
    } else {
      const newPokemon = {
        pokedexId: pokemonId,
        name: fetchedPokemon.name,
        types: fetchedPokemon.types,
        sprite,
        isShiny,
        rarity,
        count: 1,
        hatchedAt,
      };
      user.pokemons.push(newPokemon as any);
      hatchedPokemon = newPokemon;
    }

    // Fix missing sprites/types
    user.pokemons.forEach((p: any) => {
      if (!p.sprite) p.sprite = "https://example.com/mock-sprite.png";
      if (!p.types) p.types = [];
    });

    // Track missions
    advanceMissionsOnDoc(user, "hatch_daily");
    if (fetchedPokemon.types && fetchedPokemon.types.length > 0) {
      for (const type of fetchedPokemon.types) {
        advanceMissionsOnDoc(user, "collect_type", type);
      }
    }

    // Check featured Pokemon match
    const dailyPokemonId = getDailyPokemonId();
    const isFeaturedMatch = pokemonId === dailyPokemonId;

    // Clear item incense flag after use
    if ((user as any).nextEggMinRarity) {
      (user as any).nextEggMinRarity = null;
    }

    user.markModified("pokemons");
    if (newMilestones.length > 0) user.markModified("claimedStreakMilestones");
    await user.save();

    return NextResponse.json(
      {
        hatchedPokemon,
        streak: user.streak,
        bestStreak: user.bestStreak,
        totalHatchedPokemons: user.totalHatchedPokemons,
        totalShinyHatchedPokemons: user.totalShinyHatchedPokemons,
        pityCounter: (user as any).pityCounter,
        bonusEggs: (user as any).bonusEggs ?? 0,
        mysteryTickets: (user as any).mysteryTickets ?? 0,
        milestoneRewards: newMilestones,
        isFeaturedMatch,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during hatching:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
