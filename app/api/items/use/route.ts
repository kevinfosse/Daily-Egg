import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";
import { ITEMS } from "@/app/lib/items/config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { itemId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { itemId } = body;
  if (!itemId || !ITEMS[itemId]) {
    return NextResponse.json({ error: "Item invalide" }, { status: 400 });
  }

  const itemDef = ITEMS[itemId];
  if (itemDef.type !== "consumable") {
    return NextResponse.json({ error: "Cet objet ne peut pas être utilisé directement (c'est un objet tenu)" }, { status: 400 });
  }

  try {
    await connectToDb();
    const user = await User.findById(session.user.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const inventory: any[] = (user as any).inventory ?? [];
    const itemIdx = inventory.findIndex((i: any) => i.itemId === itemId);

    if (itemIdx === -1 || inventory[itemIdx].quantity < 1) {
      return NextResponse.json({ error: "Objet non disponible dans l'inventaire" }, { status: 400 });
    }

    // Apply effect
    if (itemId === "incense_rare") {
      (user as any).nextEggMinRarity = "rare";
    } else if (itemId === "incense_epic") {
      (user as any).nextEggMinRarity = "epic";
    } else if (itemId === "rare_candy") {
      (user as any).freeEvolveReady = true;
    }

    // Decrement quantity
    inventory[itemIdx].quantity -= 1;
    if (inventory[itemIdx].quantity <= 0) {
      inventory.splice(itemIdx, 1);
    }

    (user as any).inventory = inventory;
    user.markModified("inventory");
    await user.save();

    return NextResponse.json({
      inventory: (user as any).inventory,
      nextEggMinRarity: (user as any).nextEggMinRarity ?? null,
      freeEvolveReady: (user as any).freeEvolveReady ?? false,
    });
  } catch (error) {
    console.error("POST /api/items/use error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
