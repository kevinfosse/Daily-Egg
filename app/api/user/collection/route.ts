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
        
        const user = await User.findById(session.user.id);
        if (!user) {
          return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
          );
        }
      

        return NextResponse.json({
          totalHatchedPokemons: user.totalHatchedPokemons,
          totalShinyHatchedPokemons: user.totalShinyHatchedPokemons,
          collectionSize: user.pokemons.length,
          pokemons: user.pokemons,
        });
      
      } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
    }
}
