import { NextResponse } from "next/server";
import ActivityLogs from "@/app/lib/models/ActivityLogs";
import { connectToDb } from "@/app/lib/mongodb";
import { auth } from "@/app/lib/auth/auth-options";

// GET : Appelé par la NotificationBar pour lire les logs récents
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    await connectToDb();
    const logs = await ActivityLogs.find()
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST : Appelé en interne par les routes du jeu (hatch, pvp, etc.)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    await connectToDb();
    const body = await req.json();

    const message = typeof body.message === "string" ? body.message.slice(0, 200) : null;
    const pokemonName = typeof body.pokemonName === "string" ? body.pokemonName.slice(0, 100) : undefined;

    if (!message) {
      return NextResponse.json({ error: "message requis" }, { status: 400 });
    }

    await ActivityLogs.create({ message, pokemonName });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur création" }, { status: 500 });
  }
}