import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameWeekParam = searchParams.get("gameWeek");

  try {
    let key: string;
    if (gameWeekParam) {
      key = `user-earnings:${gameWeekParam}`;
    } else {
      const latest = await prisma.computedResults.findFirst({
        where: { key: { startsWith: "user-earnings:" } },
        orderBy: { computedAt: "desc" },
        select: { key: true },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No user earnings computed yet. Scrape a gameweek first." },
          { status: 404 },
        );
      }
      key = latest.key;
    }

    const cached = await prisma.computedResults.findUnique({ where: { key } });
    if (!cached) {
      return NextResponse.json(
        { error: `No cached user earnings for ${key}` },
        { status: 404 },
      );
    }

    return NextResponse.json(JSON.parse(cached.dataJson));
  } catch (error) {
    console.error("[user-earnings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user earnings" },
      { status: 500 },
    );
  }
}
