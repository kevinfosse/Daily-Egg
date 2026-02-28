import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { missionIndex } = body;

    if (typeof missionIndex !== "number" || missionIndex < 0 || missionIndex > 2) {
      return NextResponse.json({ error: "Index de mission invalide" }, { status: 400 });
    }

    await connectToDb();
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const mission = user.dailyMissions?.[missionIndex];
    if (!mission) {
      return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
    }

    if (!mission.completed) {
      return NextResponse.json({ error: "Mission non complétée" }, { status: 400 });
    }

    if (mission.claimed) {
      return NextResponse.json({ error: "Récompense déjà réclamée" }, { status: 400 });
    }

    // Apply reward
    if (mission.rewardType === "bonusEgg") {
      user.bonusEggs = (user.bonusEggs || 0) + mission.rewardAmount;
    } else if (mission.rewardType === "mysteryTicket") {
      user.mysteryTickets = (user.mysteryTickets || 0) + mission.rewardAmount;
    } else if (mission.rewardType === "item" && (mission as any).rewardItemId) {
      const rewardItemId = (mission as any).rewardItemId as string;
      const inventory: any[] = (user as any).inventory ?? [];
      const itemIdx = inventory.findIndex((i: any) => i.itemId === rewardItemId);
      if (itemIdx !== -1) {
        inventory[itemIdx].quantity += mission.rewardAmount;
      } else {
        inventory.push({ itemId: rewardItemId, quantity: mission.rewardAmount });
      }
      (user as any).inventory = inventory;
      user.markModified("inventory");
    }

    mission.claimed = true;

    await user.save();

    return NextResponse.json({
      success: true,
      missions: user.dailyMissions,
      mysteryTickets: user.mysteryTickets,
      bonusEggs: user.bonusEggs,
      inventory: (user as any).inventory ?? [],
    });
  } catch (error) {
    console.error("Error POST /api/missions/claim:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
