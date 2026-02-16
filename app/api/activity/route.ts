import { NextResponse } from "next/server"; 
import ActivityLogs from "@/app/lib/models/ActivityLogs";
import { connectToDb } from "@/app/lib/mongodb";

// 1. GET : Appelé par la NotificationBar pour lire les infos
export async function GET() {
  try {
    await connectToDb();

    // On récupère le log le plus récent
    // .lean() permet d'obtenir un objet JS pur (plus léger)
    const logs = await ActivityLogs.find()
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// 2. POST : Appelé par ton jeu quand un œuf éclot
export async function POST(req: Request) {
  try {
    await connectToDb();
    const body = await req.json();

    // On crée l'entrée en base de données
    // L'index TTL (expires) de ton modèle se chargera de le supprimer dans 60s
    await ActivityLogs.create({
      message: body.message,
      pokemonName: body.pokemonName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erreur création" }, { status: 500 });
  }
}