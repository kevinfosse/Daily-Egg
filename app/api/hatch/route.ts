import { NextResponse } from "next/server";
import getServerSession from "next-auth";
import { authOptions } from "@/app/lib/auth/auth-options";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";

export async function POST() {
  try {
    // 1. Retrieve the session
    const session = (await getServerSession(authOptions)) as any;

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // 2. Connect to the database
    await connectToDb();

    // 3. Retrieve the user
    const user = await User.findById(session.user.id);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4. Check if the egg has already been hatched today
    const now = new Date();
    const lastHatchDate = user.lastHatchDate as Date | null;

    if (lastHatchDate) {
      const sameDay =
        lastHatchDate.getFullYear() === now.getFullYear() &&
        lastHatchDate.getMonth() === now.getMonth() &&
        lastHatchDate.getDate() === now.getDate();

      if (sameDay) {
        return NextResponse.json(
          { error: "Egg already hatched today" },
          { status: 429 }
        );
      }
    }

    // From here on, the gacha logic is not yet implemented
    return NextResponse.json(
      { message: "Gacha not implemented yet" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error during hatching:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
