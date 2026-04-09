import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameWeekParam = searchParams.get("gameWeek");

  try {
    let key: string;
    if (gameWeekParam) {
      key = `achievements:${gameWeekParam}`;
    } else {
      // Find latest cached achievements
      const latest = await prisma.computedResults.findFirst({
        where: { key: { startsWith: "achievements:" } },
        orderBy: { computedAt: "desc" },
        select: { key: true },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No achievements computed yet. Scrape a gameweek first." },
          { status: 404 },
        );
      }
      key = latest.key;
    }

    const cached = await prisma.computedResults.findUnique({
      where: { key },
    });

    if (!cached) {
      return NextResponse.json(
        { error: `No cached achievements for ${key}` },
        { status: 404 },
      );
    }

    return NextResponse.json(JSON.parse(cached.dataJson));
  } catch (error) {
    console.error("[results-achievements] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 },
    );
  }
}
