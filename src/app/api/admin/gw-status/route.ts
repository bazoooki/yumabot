import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface GWStatusEntry {
  gameWeek: number;
  fixtureSlug: string;
  leaderboardCount: number;
  withDataCount: number;
  totalRankings: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    // NOTE: explicitly omit `rankingsJson` from the select — it's a large
    // JSON blob and Prisma's napi binding has been known to throw
    // "Failed to convert rust String into napi string" on rows with
    // certain payloads. The admin listing only needs metadata + counts.
    const rows = await prisma.leaderboardResult.findMany({
      select: {
        gameWeek: true,
        fixtureSlug: true,
        leaderboardSlug: true,
        leaderboardName: true,
        leagueName: true,
        division: true,
        totalEntries: true,
        fetchedAt: true,
      },
      orderBy: { gameWeek: "desc" },
    });

    // Group by GW
    const byGW = new Map<
      number,
      {
        fixtureSlug: string;
        leaderboards: {
          slug: string;
          name: string;
          leagueName: string;
          division: number;
          totalEntries: number;
          rankingsCount: number;
          fetchedAt: Date;
        }[];
      }
    >();

    for (const row of rows) {
      const existing = byGW.get(row.gameWeek) ?? {
        fixtureSlug: row.fixtureSlug,
        leaderboards: [],
      };
      existing.leaderboards.push({
        slug: row.leaderboardSlug,
        name: row.leaderboardName,
        leagueName: row.leagueName,
        division: row.division,
        totalEntries: row.totalEntries,
        // Approximation: the pagination stops at totalEntries or 1000 nodes,
        // whichever is smaller — good enough for the admin overview.
        rankingsCount: row.totalEntries,
        fetchedAt: row.fetchedAt,
      });
      byGW.set(row.gameWeek, existing);
    }

    const gameWeeks = [...byGW.entries()].map(([gw, data]) => ({
      gameWeek: gw,
      fixtureSlug: data.fixtureSlug,
      leaderboardCount: data.leaderboards.length,
      withDataCount: data.leaderboards.filter((lb) => lb.rankingsCount > 0)
        .length,
      totalRankings: data.leaderboards.reduce(
        (sum, lb) => sum + lb.rankingsCount,
        0,
      ),
      fetchedAt: data.leaderboards
        .map((lb) => lb.fetchedAt.toISOString())
        .sort()
        .pop()!,
      leaderboards: data.leaderboards.sort((a, b) => {
        if (a.leagueName !== b.leagueName)
          return a.leagueName.localeCompare(b.leagueName);
        return a.division - b.division;
      }),
    }));

    return NextResponse.json({ gameWeeks });
  } catch (error) {
    console.error("[admin] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GW status", detail: String(error).slice(0, 200) },
      { status: 500 },
    );
  }
}
