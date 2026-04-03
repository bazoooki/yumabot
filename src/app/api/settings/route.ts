import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 1, userSlug: process.env.SORARE_USER_SLUG || "ba-zii" },
    });
  }
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { userSlug } = body;

  if (!userSlug || typeof userSlug !== "string" || userSlug.trim().length === 0) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: { userSlug: userSlug.trim() },
    create: { id: 1, userSlug: userSlug.trim() },
  });

  return NextResponse.json(settings);
}
