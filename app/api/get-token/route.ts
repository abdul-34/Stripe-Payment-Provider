import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
        return NextResponse.json({ error: "Missing locationId" }, { status: 400 });
    }

    const token = await prisma.token.findUnique({
        where: { locationId },
    });

    if (!token) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json(token);
}
