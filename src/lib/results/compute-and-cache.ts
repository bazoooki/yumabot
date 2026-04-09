import { prisma } from "../db";
import { CLAN_MEMBERS } from "../clan/members";
import { detectAchievements } from "./achievements";
import { computePowerRankings, mergePowerRankings } from "./power-rankings";
import type { ResultsRanking, ResultsAppearance, LeaderboardSummary } from "../types";

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

function parseRows(rows: { leaderboardSlug: string; leaderboardName: string; leagueName: string; division: number; mainRarityType: string; totalEntries: number; rankingsJson: string }[]) {
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

  return { leaderboards, allRankings };
}

/** Recompute achievements for a specific GW and cache */
async function computeAchievementsForGW(gameWeek: number) {
  const rows = await prisma.leaderboardResult.findMany({
    where: { gameWeek },
  });
  if (rows.length === 0) return;

  const { leaderboards, allRankings } = parseRows(rows);
  const achievements = detectAchievements(leaderboards, allRankings, clanSlugs);

  await prisma.computedResults.upsert({
    where: { key: `achievements:${gameWeek}` },
    create: {
      key: `achievements:${gameWeek}`,
      dataJson: JSON.stringify({ gameWeek, achievements }),
    },
    update: {
      dataJson: JSON.stringify({ gameWeek, achievements }),
      computedAt: new Date(),
    },
  });

  console.log(`[compute] Cached achievements for GW ${gameWeek}: ${achievements.length} achievements`);
}

/** Recompute power rankings for a specific GW and cache */
async function computePowerRankingsForGW(gameWeek: number) {
  const rows = await prisma.leaderboardResult.findMany({
    where: { gameWeek },
  });
  if (rows.length === 0) return;

  const leaderboards = rows.map((row) => ({
    slug: row.leaderboardSlug,
    leagueName: row.leagueName,
    division: row.division,
    totalEntries: row.totalEntries,
    rankings: (JSON.parse(row.rankingsJson) as any[]).map(parseRanking),
  }));

  const rankings = computePowerRankings(leaderboards);
  const topN = formatRankings(rankings);
  const clanRankings = formatClanRankings(rankings);

  await prisma.computedResults.upsert({
    where: { key: `power-rankings:${gameWeek}` },
    create: {
      key: `power-rankings:${gameWeek}`,
      dataJson: JSON.stringify({
        cumulative: false,
        gameWeeks: [gameWeek],
        totalManagers: rankings.length,
        rankings: topN,
        clanRankings,
      }),
    },
    update: {
      dataJson: JSON.stringify({
        cumulative: false,
        gameWeeks: [gameWeek],
        totalManagers: rankings.length,
        rankings: topN,
        clanRankings,
      }),
      computedAt: new Date(),
    },
  });

  console.log(`[compute] Cached power rankings for GW ${gameWeek}: ${rankings.length} managers`);
}

/** Recompute cumulative (all-time) power rankings and cache */
async function computeCumulativePowerRankings() {
  const allRows = await prisma.leaderboardResult.findMany({
    orderBy: { gameWeek: "desc" },
  });
  if (allRows.length === 0) return;

  const byGW = new Map<number, typeof allRows>();
  for (const row of allRows) {
    const existing = byGW.get(row.gameWeek) ?? [];
    existing.push(row);
    byGW.set(row.gameWeek, existing);
  }

  const gwRankings = [];
  const validGWs: number[] = [];
  for (const [gw, gwRows] of byGW) {
    const withData = gwRows.filter((r) => r.totalEntries > 0);
    if (withData.length < 3) continue;
    validGWs.push(gw);

    const leaderboards = gwRows.map((row) => ({
      slug: row.leaderboardSlug,
      leagueName: row.leagueName,
      division: row.division,
      totalEntries: row.totalEntries,
      rankings: (JSON.parse(row.rankingsJson) as any[]).map(parseRanking),
    }));
    gwRankings.push(computePowerRankings(leaderboards));
  }

  const rankings = mergePowerRankings(gwRankings);
  const topN = formatRankings(rankings);
  const clanRankings = formatClanRankings(rankings);

  await prisma.computedResults.upsert({
    where: { key: "power-rankings:all" },
    create: {
      key: "power-rankings:all",
      dataJson: JSON.stringify({
        cumulative: true,
        gameWeeks: validGWs.sort((a, b) => b - a),
        totalManagers: rankings.length,
        rankings: topN,
        clanRankings,
      }),
    },
    update: {
      dataJson: JSON.stringify({
        cumulative: true,
        gameWeeks: validGWs.sort((a, b) => b - a),
        totalManagers: rankings.length,
        rankings: topN,
        clanRankings,
      }),
      computedAt: new Date(),
    },
  });

  console.log(`[compute] Cached cumulative power rankings: ${rankings.length} managers across ${validGWs.length} GWs`);
}

function formatRankings(rankings: ReturnType<typeof computePowerRankings>) {
  return rankings.slice(0, 500).map((r, i) => ({
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
}

function formatClanRankings(rankings: ReturnType<typeof computePowerRankings>) {
  return rankings
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
}

/** Run all computations after a GW scrape completes */
export async function recomputeAllForGW(gameWeek: number) {
  console.log(`[compute] Starting recomputation for GW ${gameWeek}...`);
  await computeAchievementsForGW(gameWeek);
  await computePowerRankingsForGW(gameWeek);
  await computeCumulativePowerRankings();
  console.log(`[compute] All recomputation done for GW ${gameWeek}`);
}
