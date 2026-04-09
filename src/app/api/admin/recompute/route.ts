import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recomputeAllForGW } from "@/lib/results/compute-and-cache";

export async function POST() {
  try {
    const gws = await prisma.leaderboardResult.findMany({
      select: { gameWeek: true },
      distinct: ["gameWeek"],
      orderBy: { gameWeek: "desc" },
    });

    for (const { gameWeek } of gws) {
      await recomputeAllForGW(gameWeek);
    }

    return NextResponse.json({
      recomputed: gws.map((g) => g.gameWeek),
    });
  } catch (error) {
    console.error("[recompute] Error:", error);
    return NextResponse.json(
      { error: "Failed to recompute" },
      { status: 500 },
    );
  }
}
