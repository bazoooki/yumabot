import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import type { ResultsRanking, ResultsAppearance } from "@/lib/types";
import {
  computePowerRankings,
  mergePowerRankings,
  type PowerRankEntry,
} from "@/lib/results/power-rankings";

const clanSlugs = new Set<string>(CLAN_MEMBERS.map((m) => m.slug));

function parseRanking(node: any): ResultsRanking {
  return {
    ranking: node.ranking ?? 0,
    score: node.score ?? 0,
    user: {
      slug: node.user?.slug ?? "",
      nickname: node.user?.nickname ?? "",
      pictureUrl: node.user?.pictureUrl ?? null,
    },
    lineup: (node.so5Lineup?.so5Appearances ?? []).map(
      (a: any): ResultsAppearance => ({
        index: a.index ?? 0,
        captain: a.captain ?? false,
        score: a.score ?? 0,
        position: a.position ?? "",
        grade: a.grade ?? 0,
        bonus: a.bonus ?? 0,
        playerSlug: a.anyPlayer?.slug ?? "",
        playerName: a.anyPlayer?.displayName ?? "",
        cardSlug: a.anyCard?.slug ?? null,
      }),
    ),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameWeekParam = searchParams.get("gameWeek");
  const cumulative = searchParams.get("cumulative") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10), 5000);

  try {
    let rows;
    if (cumulative) {
      // All stored GWs
      rows = await prisma.leaderboardResult.findMany({
        orderBy: [{ gameWeek: "desc" }],
      });
    } else if (gameWeekParam) {
      rows = await prisma.leaderboardResult.findMany({
        where: { gameWeek: parseInt(gameWeekParam, 10) },
      });
    } else {
      // Latest GW
      const latest = await prisma.leaderboardResult.findFirst({
        select: { gameWeek: true },
        orderBy: { gameWeek: "desc" },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No results available" },
          { status: 404 },
        );
      }
      rows = await prisma.leaderboardResult.findMany({
        where: { gameWeek: latest.gameWeek },
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No results found" },
        { status: 404 },
      );
    }

    let rankings: PowerRankEntry[];

    if (cumulative) {
      // Group by GW, compute per-GW, then merge
      const byGW = new Map<number, typeof rows>();
      for (const row of rows) {
        const existing = byGW.get(row.gameWeek) ?? [];
        existing.push(row);
        byGW.set(row.gameWeek, existing);
      }

      const gwRankings: PowerRankEntry[][] = [];
      for (const [gw, gwRows] of byGW) {
        // Only count GWs with at least 3 in-season competitions (with actual data)
        const withData = gwRows.filter((r) => r.totalEntries > 0);
        if (withData.length < 3) {
          console.log(`[power-rankings] Skipping GW ${gw}: only ${withData.length} leaderboards with data`);
          continue;
        }
        const leaderboards = gwRows.map((row) => ({
          slug: row.leaderboardSlug,
          leagueName: row.leagueName,
          division: row.division,
          totalEntries: row.totalEntries,
          rankings: (JSON.parse(row.rankingsJson) as any[]).map(parseRanking),
        }));
        gwRankings.push(computePowerRankings(leaderboards));
      }
      rankings = mergePowerRankings(gwRankings);
    } else {
      const leaderboards = rows.map((row) => ({
        slug: row.leaderboardSlug,
        leagueName: row.leagueName,
        division: row.division,
        totalEntries: row.totalEntries,
        rankings: (JSON.parse(row.rankingsJson) as any[]).map(parseRanking),
      }));
      rankings = computePowerRankings(leaderboards);
    }

    // Return top N (strip breakdown for the list view to keep response small)
    const topN = rankings.slice(0, limit).map((r, i) => ({
      rank: i + 1,
      userSlug: r.userSlug,
      nickname: r.nickname,
      pictureUrl: r.pictureUrl,
      totalPoints: Math.round(r.totalPoints),
      leaderboardCount: r.leaderboardCount,
      bestFinish: Math.round(r.bestFinish * 10) / 10,
      topBreakdown: r.breakdown.slice(0, 5).map((b) => ({
        leagueName: b.leagueName,
        division: b.division,
        ranking: b.ranking,
        totalEntries: b.totalEntries,
        points: Math.round(b.points),
      })),
    }));

    // Find clan members in full rankings with their global rank
    const clanRankings = rankings
      .map((r, i) => ({ ...r, rank: i + 1 }))
      .filter((r) => clanSlugs.has(r.userSlug))
      .map((r) => ({
        rank: r.rank,
        userSlug: r.userSlug,
        nickname: r.nickname,
        pictureUrl: r.pictureUrl,
        totalPoints: Math.round(r.totalPoints),
        leaderboardCount: r.leaderboardCount,
        bestFinish: Math.round(r.bestFinish * 10) / 10,
        topBreakdown: r.breakdown.slice(0, 5).map((b) => ({
          leagueName: b.leagueName,
          division: b.division,
          ranking: b.ranking,
          totalEntries: b.totalEntries,
          points: Math.round(b.points),
        })),
      }));

    const gameWeeks = [...new Set(rows.map((r) => r.gameWeek))].sort(
      (a, b) => b - a,
    );

    return NextResponse.json({
      cumulative,
      gameWeeks,
      totalManagers: rankings.length,
      rankings: topN,
      clanRankings,
    });
  } catch (error) {
    console.error("[power-rankings] Error:", error);
    return NextResponse.json(
      { error: "Failed to compute power rankings" },
      { status: 500 },
    );
  }
}
