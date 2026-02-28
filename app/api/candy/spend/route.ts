import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import User from "@/app/lib/models/User";
import { auth } from "@/app/lib/auth/auth-options";

const SHOP_ITEMS: Record<string, { cost: number; field: string }> = {
  bonusEgg: { cost: 50, field: "bonusEggs" },
  mysteryTicket: { cost: 200, field: "mysteryTickets" },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { item } = await req.json();
  const shopItem = SHOP_ITEMS[item];
  if (!shopItem) {
    return NextResponse.json({ error: "Article inconnu" }, { status: 400 });
  }

  await connectToDb();

  const user = await User.findById(session.user.id).lean() as any;
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentCandy = user.candy ?? 0;
  if (currentCandy < shopItem.cost) {
    return NextResponse.json({ error: "Pas assez de candy" }, { status: 400 });
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $inc: { candy: -shopItem.cost, [shopItem.field]: 1 } },
    { new: true, strict: false }
  ).lean() as any;

  return NextResponse.json({
    candy: updated?.candy ?? 0,
    bonusEggs: updated?.bonusEggs ?? 0,
    mysteryTickets: updated?.mysteryTickets ?? 0,
  });
}
