import { NextRequest, NextResponse } from "next/server";
import { connectToDb } from "@/app/lib/mongodb";
import { hashPassword } from "@/app/lib/auth/password";
import User from "@/app/lib/models/User";

export async function POST(request: NextRequest) {
    try {
        await connectToDb();
        const { username, email, password } = await request.json();
    if (!username || !email || !password) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (username.length < 3 || username.length > 20) {
        return NextResponse.json({ error: "Username must be between 3 and 20 characters" }, { status: 400 });
    }
    if (!email.includes("@")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }
    const hashedPassword = await hashPassword(password);
    const user = await User.create({ username, email, passwordHash: hashedPassword });
    return NextResponse.json({ message: "User created successfully" }, { status: 201 });
    } catch (error) {
        console.error("Failed to connect to database", error);
        return NextResponse.json({ error: "Failed to connect to database"}, { status: 500 });
    }
    
}
