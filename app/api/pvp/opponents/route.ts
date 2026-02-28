import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import mongoose from "mongoose";

// GET — return up to 10 random opponents with non-empty defense teams
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await connectToDb();
    const selfId = new mongoose.Types.ObjectId(session.user.id);

    const opponents = await User.aggregate([
      {
        $match: {
          _id: { $ne: selfId },
          "pvpDefenseTeam.0": { $exists: true },
        },
      },
      { $sample: { size: 10 } },
      {
        $project: {
          _id: 1,
          username: 1,
          pvpWins: 1,
          pvpLosses: 1,
          pvpElo: 1,
          pvpDefenseTeam: {
            $map: {
              input: "$pvpDefenseTeam",
              as: "p",
              in: {
                name: "$$p.name",
                sprite: "$$p.sprite",
                rarity: "$$p.rarity",
                types: "$$p.types",
              },
            },
          },
        },
      },
    ]);

    return NextResponse.json({ opponents });
  } catch (error) {
    console.error("pvp/opponents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
