import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { ensureMissionsForToday } from "@/app/lib/missions/generator";

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

    // Generate missions if not yet generated today
    const regenerated = ensureMissionsForToday(user, session.user.id);
    if (regenerated) {
      await user.save();
    }

    // Time until midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilReset = tomorrow.getTime() - now.getTime();

    return NextResponse.json({
      missions: user.dailyMissions,
      msUntilReset,
    });
  } catch (error) {
    console.error("Error GET /api/missions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
