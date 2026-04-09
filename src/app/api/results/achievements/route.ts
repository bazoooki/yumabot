import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { detectAchievements } from "@/lib/results/achievements";
import type { ResultsRanking, ResultsAppearance, LeaderboardSummary } from "@/lib/types";

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
          { error: "No results available" },
          { status: 404 },
        );
      }
      gameWeek = latest.gameWeek;
    }

    const rows = await prisma.leaderboardResult.findMany({
      where: { gameWeek },
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: `No results for GW ${gameWeek}` },
        { status: 404 },
      );
    }

    const allRankings = new Map<string, ResultsRanking[]>();
    const leaderboards: LeaderboardSummary[] = rows.map((row) => {
      const rawRankings: any[] = JSON.parse(row.rankingsJson);
      const parsed = rawRankings.map(parseRanking);
      allRankings.set(row.leaderboardSlug, parsed);

      return {
        slug: row.leaderboardSlug,
        displayName: row.leaderboardName,
        leagueName: row.leagueName,
        division: row.division,
        mainRarityType: row.mainRarityType,
        totalEntries: row.totalEntries,
        podium: parsed.slice(0, 3),
        clanEntries: parsed.filter((r) => clanSlugs.has(r.user.slug)),
      };
    });

    const achievements = detectAchievements(leaderboards, allRankings, clanSlugs);

    return NextResponse.json({ gameWeek, achievements });
  } catch (error) {
    console.error("[results-achievements] Error:", error);
    return NextResponse.json(
      { error: "Failed to compute achievements" },
      { status: 500 },
    );
  }
}
