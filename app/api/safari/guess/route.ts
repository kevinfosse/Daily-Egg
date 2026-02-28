import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

const MAX_DAILY_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { guess: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { guess } = body;
  if (!guess) {
    return NextResponse.json({ error: "guess required" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id).lean() as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const challenge = user.currentSafariChallenge;
    if (!challenge?.pokemonId || !challenge?.correctName) {
      return NextResponse.json({ error: "No active challenge" }, { status: 400 });
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastSafariDate: Date | null = user.lastSafariDate ?? null;
    const lastSafariDateStr = lastSafariDate ? new Date(lastSafariDate).toISOString().slice(0, 10) : null;

    let dailySafariAttempts = user.dailySafariAttempts ?? 0;
    if (lastSafariDateStr !== todayStr) {
      dailySafariAttempts = 0;
    }

    if (dailySafariAttempts >= MAX_DAILY_ATTEMPTS) {
      return NextResponse.json({ error: "No attempts left" }, { status: 429 });
    }

    const correct = guess.toLowerCase().trim() === challenge.correctName.toLowerCase().trim();
    const currentStreak = user.safariWinStreak ?? 0;

    let newStreak = correct ? currentStreak + 1 : 0;
    let candyEarned = correct ? 20 : 0;
    let bonusEggEarned = false;
    let mysteryTicketEarned = false;

    if (correct && newStreak === 3) {
      bonusEggEarned = true;
    }
    if (correct && newStreak === 5) {
      mysteryTicketEarned = true;
    }

    const newAttempts = dailySafariAttempts + 1;

    // Build update
    const updateFields: any = {
      $set: {
        currentSafariChallenge: null,
        safariWinStreak: newStreak,
        lastSafariDate: now,
        dailySafariAttempts: newAttempts,
      },
      $inc: {} as any,
    };
    if (candyEarned > 0) updateFields.$inc.candy = candyEarned;
    if (bonusEggEarned) updateFields.$inc.bonusEggs = 1;
    if (mysteryTicketEarned) updateFields.$inc.mysteryTickets = 1;

    // Clean empty $inc
    if (Object.keys(updateFields.$inc).length === 0) delete updateFields.$inc;

    await User.findByIdAndUpdate(session.user.id, updateFields, { strict: false });

    // Reveal the actual sprite URL only after guess
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${challenge.pokemonId}.png`;

    return NextResponse.json({
      correct,
      correctName: challenge.correctName,
      spriteUrl,
      candyEarned: candyEarned,
      bonusEggEarned,
      mysteryTicketEarned,
      streak: newStreak,
      attemptsLeft: MAX_DAILY_ATTEMPTS - newAttempts,
    });
  } catch (error) {
    console.error("safari/guess POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
