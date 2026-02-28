import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

const VALID_CATEGORIES = ["totalPokemons", "totalShinys", "bestStreak", "totalHatched", "pvpElo"] as const;
type Category = typeof VALID_CATEGORIES[number];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as Category | null;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Catégorie invalide. Valeurs: totalPokemons, totalShinys, bestStreak, totalHatched, pvpElo" },
        { status: 400 }
      );
    }

    await connectToDb();

    let leaderboard: any[];

    if (category === "totalPokemons") {
      // Aggregate: count pokemons array size
      leaderboard = await User.aggregate([
        { $project: { username: 1, value: { $size: "$pokemons" } } },
        { $sort: { value: -1 } },
        { $limit: 20 },
      ]);
    } else {
      const fieldMap: Record<string, string> = {
        totalShinys: "totalShinyHatchedPokemons",
        bestStreak: "bestStreak",
        totalHatched: "totalHatchedPokemons",
        pvpElo: "pvpElo",
      };
      const field = fieldMap[category];

      const users = await User.find()
        .sort({ [field]: -1 })
        .limit(20)
        .select(`username ${field}`)
        .lean();

      leaderboard = users.map((u: any) => ({
        _id: u._id,
        username: u.username,
        value: field === "pvpElo" ? (u[field] ?? 1000) : (u[field] || 0),
      }));
    }

    // Get current user's rank if authenticated
    let currentUserRank: { rank: number; value: number } | null = null;

    const session = await auth();
    if (session?.user?.id) {
      if (category === "totalPokemons") {
        const user = await User.findById(session.user.id).select("pokemons").lean() as any;
        if (user) {
          const userValue = user.pokemons?.length || 0;
          const rank = await User.aggregate([
            { $project: { size: { $size: "$pokemons" } } },
            { $match: { size: { $gt: userValue } } },
            { $count: "count" },
          ]);
          currentUserRank = { rank: (rank[0]?.count || 0) + 1, value: userValue };
        }
      } else {
        const fieldMap: Record<string, string> = {
          totalShinys: "totalShinyHatchedPokemons",
          bestStreak: "bestStreak",
          totalHatched: "totalHatchedPokemons",
          pvpElo: "pvpElo",
        };
        const field = fieldMap[category];
        const user = await User.findById(session.user.id).select(field).lean() as any;
        if (user) {
          const userValue = field === "pvpElo" ? (user[field] ?? 1000) : (user[field] || 0);
          const aboveCount = await User.countDocuments({ [field]: { $gt: userValue } });
          currentUserRank = { rank: aboveCount + 1, value: userValue };
        }
      }
    }

    return NextResponse.json({
      category,
      leaderboard: leaderboard.map((entry: any, index: number) => ({
        rank: index + 1,
        username: entry.username,
        value: entry.value,
      })),
      currentUser: currentUserRank,
    });
  } catch (error) {
    console.error("Error GET /api/leaderboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
