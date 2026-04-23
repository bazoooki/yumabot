import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Returns the set of (leagueSlug, division, mainRarityType) tuples the given
 * user has appeared in across the last N distinct scraped GameWeeks. Used by
 * the "My Hot Streaks" panel to filter upcoming comps down to ones the user
 * has actually played — instead of showing every in-season leaderboard for
 * next GW.
 *
 * The filter is a `LIKE %"slug":"<userSlug>"%` match against `rankingsJson`.
 * Each row is narrow (scraper already filters mainRarityType="limited") and
 * we pre-filter by gameWeek, so the scan is bounded.
 */

export interface PlayedTrack {
  leagueSlug: string;
  leagueName: string;
  division: number;
  mainRarityType: string;
  lastPlayedGameWeek: number;
}

export interface PlayedTracksResponse {
  userSlug: string;
  gameWeeks: number[];
  tracks: PlayedTrack[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userSlug = searchParams.get("userSlug");
  const fixturesParam = parseInt(searchParams.get("fixtures") ?? "3", 10);
  const fixtures = Math.min(Math.max(fixturesParam, 1), 10);

  if (!userSlug) {
    return NextResponse.json(
      { error: "userSlug is required" },
      { status: 400 },
    );
  }

  try {
    const recentGws = await prisma.leaderboardResult.findMany({
      select: { gameWeek: true },
      distinct: ["gameWeek"],
      orderBy: { gameWeek: "desc" },
      take: fixtures,
    });
    const gwList = recentGws.map((r) => r.gameWeek);
    if (gwList.length === 0) {
      return NextResponse.json({ userSlug, gameWeeks: [], tracks: [] });
    }

    // Find every leaderboard row from those GWs whose rankings include the
    // user. The `contains` check targets the serialized user slug exactly.
    const rows = await prisma.leaderboardResult.findMany({
      where: {
        gameWeek: { in: gwList },
        rankingsJson: { contains: `"slug":"${userSlug}"` },
      },
      select: {
        leagueSlug: true,
        leagueName: true,
        division: true,
        mainRarityType: true,
        gameWeek: true,
      },
    });

    // Dedupe by (leagueSlug, division, rarity), keep the most recent GW.
    const byKey = new Map<string, PlayedTrack>();
    for (const r of rows) {
      const key = `${r.leagueSlug}::${r.division}::${r.mainRarityType}`;
      const existing = byKey.get(key);
      if (!existing || r.gameWeek > existing.lastPlayedGameWeek) {
        byKey.set(key, {
          leagueSlug: r.leagueSlug,
          leagueName: r.leagueName,
          division: r.division,
          mainRarityType: r.mainRarityType,
          lastPlayedGameWeek: r.gameWeek,
        });
      }
    }

    const tracks = Array.from(byKey.values()).sort((a, b) => {
      const nameCmp = a.leagueName.localeCompare(b.leagueName);
      if (nameCmp !== 0) return nameCmp;
      return a.division - b.division;
    });

    return NextResponse.json({
      userSlug,
      gameWeeks: gwList,
      tracks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[played-tracks] Error:", message);
    return NextResponse.json(
      { error: "Failed to fetch played tracks", detail: message.slice(0, 400) },
      { status: 500 },
    );
  }
}
