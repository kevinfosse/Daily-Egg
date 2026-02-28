import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

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
      inventory: user.inventory ?? [],
      nextEggMinRarity: user.nextEggMinRarity ?? null,
      freeEvolveReady: user.freeEvolveReady ?? false,
    });
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
