import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeResultsForGW } from "@/lib/results/compute-and-cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameWeekParam = searchParams.get("gameWeek");

  try {
    let gameWeek: number;
    if (gameWeekParam) {
      gameWeek = parseInt(gameWeekParam, 10);
    } else {
      const latest = await prisma.leaderboardResult.findFirst({
        select: { gameWeek: true },
        orderBy: { gameWeek: "desc" },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No results available. Fetch results first." },
          { status: 404 },
        );
      }
      gameWeek = latest.gameWeek;
    }

    const cached = await prisma.computedResults.findUnique({
      where: { key: `results:${gameWeek}` },
    });
    if (cached) {
      return new NextResponse(cached.dataJson, {
        headers: { "content-type": "application/json" },
      });
    }

    const payload = await computeResultsForGW(gameWeek);
    if (!payload) {
      return NextResponse.json(
        { error: `No results for GW ${gameWeek}` },
        { status: 404 },
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[results] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}
