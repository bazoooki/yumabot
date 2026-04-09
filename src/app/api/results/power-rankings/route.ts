import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameWeekParam = searchParams.get("gameWeek");
  const cumulative = searchParams.get("cumulative") === "true";

  try {
    let key: string;
    if (cumulative) {
      key = "power-rankings:all";
    } else if (gameWeekParam) {
      key = `power-rankings:${gameWeekParam}`;
    } else {
      // Find latest per-GW power rankings
      const latest = await prisma.computedResults.findFirst({
        where: {
          key: { startsWith: "power-rankings:" },
          NOT: { key: "power-rankings:all" },
        },
        orderBy: { computedAt: "desc" },
        select: { key: true },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No power rankings computed yet. Scrape a gameweek first." },
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
        { error: `No cached power rankings for ${key}` },
        { status: 404 },
      );
    }

    return NextResponse.json(JSON.parse(cached.dataJson));
  } catch (error) {
    console.error("[power-rankings] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch power rankings" },
      { status: 500 },
    );
  }
}
