import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { fetchPokemon } from "@/app/lib/pokeapi/pokeapi";
import { secureRandom } from "@/app/lib/gacha/config";

const MAX_DAILY_ATTEMPTS = 5;
const MAX_POKEMON_ID = 493;

function pickRandomId(exclude: number): number {
  let id: number;
  do {
    id = Math.floor(secureRandom() * MAX_POKEMON_ID) + 1;
  } while (id === exclude);
  return id;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id).lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastSafariDate: Date | null = user.lastSafariDate ?? null;
    const lastSafariDateStr = lastSafariDate ? new Date(lastSafariDate).toISOString().slice(0, 10) : null;

    let dailySafariAttempts = user.dailySafariAttempts ?? 0;
    if (lastSafariDateStr !== todayStr) {
      dailySafariAttempts = 0;
    }

    const attemptsLeft = MAX_DAILY_ATTEMPTS - dailySafariAttempts;

    if (attemptsLeft <= 0) {
      return NextResponse.json({
        attemptsLeft: 0,
        streak: user.safariWinStreak ?? 0,
        hasChallenge: false,
        message: "Tentatives épuisées pour aujourd'hui. Revenez demain !",
      });
    }

    // Generate or return existing challenge
    let challenge = user.currentSafariChallenge ?? null;
    let options: string[];

    if (!challenge || !challenge.pokemonId) {
      // Pick a random pokemon
      const correctId = Math.floor(secureRandom() * MAX_POKEMON_ID) + 1;
      const correctData = await fetchPokemon(correctId);
      if (!correctData) {
        return NextResponse.json({ error: "Impossible de charger le Pokémon" }, { status: 500 });
      }
      const correctName = correctData.name;

      // Pick 3 decoys
      const decoyIds = [
        pickRandomId(correctId),
        pickRandomId(correctId),
        pickRandomId(correctId),
      ];
      const decoyNames: string[] = [];
      for (const id of decoyIds) {
        const data = await fetchPokemon(id);
        if (data) decoyNames.push(data.name);
      }

      // Shuffle 4 options
      const allOptions = [correctName, ...decoyNames.slice(0, 3)];
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(secureRandom() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }
      options = allOptions;

      // Save challenge (without exposing pokemonId in response)
      await User.findByIdAndUpdate(
        session.user.id,
        { $set: { currentSafariChallenge: { pokemonId: correctId, correctName } } },
        { strict: false }
      );

      challenge = { pokemonId: correctId, correctName };
    } else {
      // Regenerate options from stored challenge
      const decoyIds = [
        pickRandomId(challenge.pokemonId),
        pickRandomId(challenge.pokemonId),
        pickRandomId(challenge.pokemonId),
      ];
      const decoyNames: string[] = [];
      for (const id of decoyIds) {
        const data = await fetchPokemon(id);
        if (data) decoyNames.push(data.name);
      }
      const allOptions = [challenge.correctName, ...decoyNames.slice(0, 3)];
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(secureRandom() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }
      options = allOptions;
    }

    return NextResponse.json({
      options,
      attemptsLeft,
      streak: user.safariWinStreak ?? 0,
      hasChallenge: true,
    });
  } catch (error) {
    console.error("safari GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
