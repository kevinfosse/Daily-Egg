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

    const challenge = user.currentSafariChallenge;
    if (!challenge?.pokemonId) {
      return NextResponse.json({ error: "No active challenge" }, { status: 400 });
    }

    const cryUrl = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${challenge.pokemonId}.ogg`;
    const res = await fetch(cryUrl);
    if (!res.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/ogg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("safari/cry GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
