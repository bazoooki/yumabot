import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const rows = await prisma.leaderboardResult.findMany({
      select: { gameWeek: true },
      distinct: ["gameWeek"],
      orderBy: { gameWeek: "desc" },
    });

    return NextResponse.json({
      gameWeeks: rows.map((r) => r.gameWeek),
    });
  } catch (error) {
    console.error("[results-gameweeks] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gameweeks" },
      { status: 500 },
    );
  }
}
