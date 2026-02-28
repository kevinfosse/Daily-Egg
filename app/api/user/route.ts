import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";



export async function GET() {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    try {
        await connectToDb();
        
        // lean() retourne l'objet brut MongoDB — bypasse le cache du schéma Mongoose
        const user = await User.findById(session.user.id).lean() as any;
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }

        // Calculer canHatch
        const now = new Date();
        const lastHatchDate: Date | null = user.lastHatchDate ?? null;
        let canHatch = true;

        if (lastHatchDate) {
          const d = new Date(lastHatchDate);
          canHatch = !(
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          );
        }


        const activeExpeditions: any[] = user.activeExpeditions ?? [];
        const readyExpeditions = activeExpeditions.filter(
          (e: any) => new Date(e.endsAt) <= now
        ).length;

        const currentBattle = user.currentBattle as any;
        const hasBattleActive = !!(
          currentBattle &&
          currentBattle.status === "active" &&
          new Date(currentBattle.expiresAt) > now
        );

        // Reset dailyBattles if new day
        const lastBattleDate: Date | null = (user as any).lastBattleDate ?? null;
        let dailyBattles = (user as any).dailyBattles ?? 0;
        if (lastBattleDate) {
          const lb = new Date(lastBattleDate);
          const sameDay =
            lb.getFullYear() === now.getFullYear() &&
            lb.getMonth() === now.getMonth() &&
            lb.getDate() === now.getDate();
          if (!sameDay) dailyBattles = 0;
        }

        // Reset dailyChallengeWon if new day
        const lastChallengeDateStr = (user as any).lastChallengeDateStr ?? "";
        const todayStr = now.toISOString().slice(0, 10);
        const dailyChallengeWon = lastChallengeDateStr === todayStr
          ? ((user as any).dailyChallengeWon ?? false)
          : false;

        // Reset dailyPvpChallenges if new day
        const lastPvpDate: Date | null = (user as any).lastPvpDate ?? null;
        let dailyPvpChallenges = (user as any).dailyPvpChallenges ?? 0;
        if (lastPvpDate) {
          const lp = new Date(lastPvpDate);
          const sameDay =
            lp.getFullYear() === now.getFullYear() &&
            lp.getMonth() === now.getMonth() &&
            lp.getDate() === now.getDate();
          if (!sameDay) dailyPvpChallenges = 0;
        }

        // Reset dailySafariAttempts if new day
        const lastSafariDate: Date | null = (user as any).lastSafariDate ?? null;
        let dailySafariAttempts = (user as any).dailySafariAttempts ?? 0;
        if (lastSafariDate) {
          const ls = new Date(lastSafariDate);
          const sameDay =
            ls.getFullYear() === now.getFullYear() &&
            ls.getMonth() === now.getMonth() &&
            ls.getDate() === now.getDate();
          if (!sameDay) dailySafariAttempts = 0;
        }

        return NextResponse.json({
          username: user.username,
          email: user.email,
          streak: user.streak ?? 0,
          bestStreak: user.bestStreak ?? 0,
          totalHatchedPokemons: user.totalHatchedPokemons ?? 0,
          totalShinyHatchedPokemons: user.totalShinyHatchedPokemons ?? 0,
          collectionSize: user.pokemons?.length ?? 0,
          canHatch,
          mysteryTickets: user.mysteryTickets ?? 0,
          bonusEggs: user.bonusEggs ?? 0,
          candy: user.candy ?? 0,
          pityCounter: user.pityCounter ?? 0,
          readyExpeditions,
          nextEggMinRarity: user.nextEggMinRarity ?? null,
          freeEvolveReady: user.freeEvolveReady ?? false,
          dailyBattles,
          bonusExpeditionSlots: (user as any).bonusExpeditionSlots ?? 0,
          hasBattleActive,
          dailyChallengeWon,
          pvpWins: (user as any).pvpWins ?? 0,
          pvpLosses: (user as any).pvpLosses ?? 0,
          dailyPvpChallenges,
          pvpElo: (user as any).pvpElo ?? 1000,
          dailySafariAttempts,
          safariWinStreak: (user as any).safariWinStreak ?? 0,
        });
      
      } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
    }
}
