import { NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";


export async function GET() {
    try {
        const db = await connectToDb();

        return NextResponse.json({ message: "Database connected successfully : " + db.connection.name }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: "Database connection failed", error: error }, { status: 500 });
    }
}