import type { LeaderboardResult, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { CLAN_MEMBERS } from "../clan/members";
import { detectAchievements } from "./achievements";
import { computePowerRankings, mergePowerRankings } from "./power-rankings";
import type { LineupRewardBreakdown } from "../rewards";
import type { ResultsRanking, ResultsAppearance, LeaderboardSummary } from "../types";

const clanSlugs = new Set<string>(CLAN_MEMBERS.map((m) => m.slug));

/**
 * Safe replacement for `prisma.leaderboardResult.findMany`.
 *
 * Prisma 6.x has a napi bug where decoding large String columns in a batched
 * findMany can throw "Failed to convert rust String into napi string" — one
 * bad row kills the entire call. We work around it by:
 *   1. Fetching just the ids (cheap, no rankingsJson conversion).
 *   2. Loading rows individually via findUnique in parallel chunks.
 *   3. Logging + skipping any row that still fails.
 *
 * Ordering is preserved by taking it from the id query.
 */
async function safeFetchLeaderboardResults(
  where: Prisma.LeaderboardResultWhereInput,
  orderBy?: Prisma.LeaderboardResultOrderByWithRelationInput[],
  log?: ComputeLogger,
): Promise<LeaderboardResult[]> {
  const meta = await prisma.leaderboardResult.findMany({
    where,
    select: { id: true },
    orderBy: orderBy ?? [{ leagueName: "asc" }, { division: "asc" }],
  });

  log?.(`fetch: ${meta.length} rows to load (parallel chunks of 10)`);

  // Load in parallel chunks of 10 to keep the connection pool happy.
  const CHUNK = 10;
  const results: (LeaderboardResult | null)[] = new Array(meta.length).fill(null);
  let skipped = 0;
  let loaded = 0;

  for (let i = 0; i < meta.length; i += CHUNK) {
    const slice = meta.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async ({ id }, offset) => {
        try {
          const row = await prisma.leaderboardResult.findUnique({
            where: { id },
          });
          if (row) {
            results[i + offset] = row;
            loaded += 1;
          }
        } catch (err) {
          skipped += 1;
          console.warn(
            `[compute] Skipping LeaderboardResult id=${id} — Prisma decode error:`,
            String(err).slice(0, 160),
          );
        }
      }),
    );
    log?.(`fetch: ${Math.min(i + CHUNK, meta.length)}/${meta.length}`);
  }

  if (skipped > 0) {
    log?.(`fetch: WARN skipped ${skipped}/${meta.length} rows (napi decode)`);
    console.warn(
      `[compute] safeFetchLeaderboardResults skipped ${skipped}/${meta.length} rows due to Prisma napi decode errors`,
    );
  }
  log?.(`fetch: loaded ${loaded} rows`);
  return results.filter((r): r is LeaderboardResult => r !== null);
}

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

/** Pre-compute the /api/results payload for a GW and cache it */
export async function computeResultsForGW(gameWeek: number, log?: ComputeLogger) {
  const rows = await safeFetchLeaderboardResults(
    { gameWeek },
    [{ leagueName: "asc" }, { division: "asc" }],
    log,
  );
  if (rows.length === 0) return null;

  const { leaderboards } = parseRows(rows);
  const payload = {
    gameWeek,
    fixtureSlug: rows[0].fixtureSlug,
    leaderboards,
  };

  await prisma.computedResults.upsert({
    where: { key: `results:${gameWeek}` },
    create: {
      key: `results:${gameWeek}`,
      dataJson: JSON.stringify(payload),
    },
    update: {
      dataJson: JSON.stringify(payload),
      computedAt: new Date(),
    },
  });

  console.log(`[compute] Cached results for GW ${gameWeek}: ${leaderboards.length} leaderboards`);
  return payload;
}

/** Recompute achievements for a specific GW and cache */
async function computeAchievementsForGW(gameWeek: number, log?: ComputeLogger) {
  const rows = await safeFetchLeaderboardResults({ gameWeek }, undefined, log);
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
async function computePowerRankingsForGW(gameWeek: number, log?: ComputeLogger) {
  const rows = await safeFetchLeaderboardResults({ gameWeek }, undefined, log);
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
async function computeCumulativePowerRankings(log?: ComputeLogger) {
  const allRows = await safeFetchLeaderboardResults(
    {},
    [{ gameWeek: "desc" }],
    log,
  );
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

/** Aggregate $ earnings per user across all their lineups in a GW */
async function computeUserEarningsForGW(gameWeek: number, log?: ComputeLogger) {
  const rows = await safeFetchLeaderboardResults({ gameWeek }, undefined, log);
  if (rows.length === 0) return;

  interface Entry {
    userSlug: string;
    nickname: string;
    pictureUrl: string | null;
    totalUsdCents: number;
    teamsCount: number;
    anyActual: boolean;
    allActual: boolean;
    breakdown: {
      leaderboardSlug: string;
      leaderboardName: string;
      leagueName: string;
      division: number;
      mainRarityType: string;
      rank: number;
      usdCents: number;
      isActual: boolean;
    }[];
  }

  const byUser = new Map<string, Entry>();

  for (const row of rows) {
    const rankings = JSON.parse(row.rankingsJson) as Array<{
      ranking?: number;
      user?: { slug?: string; nickname?: string; pictureUrl?: string | null };
      rewards?: LineupRewardBreakdown;
    }>;

    for (const r of rankings) {
      const slug = r.user?.slug;
      if (!slug) continue;
      const rewards = r.rewards;
      const cents = rewards?.usdCents ?? 0;
      const isActual = rewards?.isActual ?? false;

      let entry = byUser.get(slug);
      if (!entry) {
        entry = {
          userSlug: slug,
          nickname: r.user?.nickname ?? "",
          pictureUrl: r.user?.pictureUrl ?? null,
          totalUsdCents: 0,
          teamsCount: 0,
          anyActual: false,
          allActual: true,
          breakdown: [],
        };
        byUser.set(slug, entry);
      }

      entry.totalUsdCents += cents;
      entry.teamsCount += 1;
      if (isActual) entry.anyActual = true;
      else entry.allActual = false;
      entry.breakdown.push({
        leaderboardSlug: row.leaderboardSlug,
        leaderboardName: row.leaderboardName,
        leagueName: row.leagueName,
        division: row.division,
        mainRarityType: row.mainRarityType,
        rank: r.ranking ?? 0,
        usdCents: cents,
        isActual,
      });
    }
  }

  const sorted = [...byUser.values()]
    .filter((e) => e.totalUsdCents > 0)
    .sort((a, b) => b.totalUsdCents - a.totalUsdCents)
    .map((e, i) => ({
      rank: i + 1,
      ...e,
      status: e.allActual ? "FINAL" : e.anyActual ? "PARTIAL" : "LIVE",
    }));

  const payload = {
    gameWeek,
    totalManagers: sorted.length,
    rankings: sorted,
  };

  await prisma.computedResults.upsert({
    where: { key: `user-earnings:${gameWeek}` },
    create: {
      key: `user-earnings:${gameWeek}`,
      dataJson: JSON.stringify(payload),
    },
    update: {
      dataJson: JSON.stringify(payload),
      computedAt: new Date(),
    },
  });

  console.log(
    `[compute] Cached user earnings for GW ${gameWeek}: ${sorted.length} managers`,
  );
}

/** For each in-season leaderboard in a GW, aggregate how many managers
 *  cleared each streak threshold (deduped by user, best team per user). */
async function computeStreakAchievementsForGW(
  gameWeek: number,
  log?: ComputeLogger,
) {
  const rows = await safeFetchLeaderboardResults(
    { gameWeek },
    [{ leagueName: "asc" }, { division: "asc" }],
    log,
  );
  if (rows.length === 0) return;

  interface ManagerEntry {
    userSlug: string;
    nickname: string;
    pictureUrl: string | null;
    score: number;
    ranking: number | null;
    teamsCount: number;
    lineup: Array<{
      playerName: string;
      playerSlug: string;
      cardSlug: string | null;
      score: number;
      captain: boolean;
      position: string;
    }>;
  }

  interface LevelEntry {
    level: number;
    score: number;
    rewardLabel: string;
    rewardKind: "cash" | "essence" | "coin" | "other";
    managerCount: number;
    managers: ManagerEntry[];
  }

  interface LeaderboardEntry {
    leaderboardSlug: string;
    leaderboardName: string;
    leagueName: string;
    division: number;
    mainRarityType: string;
    totalEntries: number;
    totalManagers: number;
    levels: LevelEntry[];
  }

  const leaderboards: LeaderboardEntry[] = [];

  for (const row of rows) {
    let rankings: any[];
    try {
      rankings = JSON.parse(row.rankingsJson) as any[];
    } catch {
      continue;
    }
    if (rankings.length === 0) continue;

    // Find the first ranking with a populated streak task — thresholds are
    // the same for everyone in the same leaderboard.
    const withStreak = rankings.find(
      (r) =>
        Array.isArray(r?.so5Lineup?.thresholdsStreakTask?.thresholds) &&
        r.so5Lineup.thresholdsStreakTask.thresholds.length > 0,
    );
    if (!withStreak) continue;

    interface ThresholdDef {
      score: number;
      rewardLabel: string;
      rewardKind: LevelEntry["rewardKind"];
      rewardConfig: any; // the raw reward config, for matching against completedTasks
    }
    const thresholds: ThresholdDef[] = withStreak.so5Lineup.thresholdsStreakTask.thresholds.map(
      (t: any) => {
        const rc = Array.isArray(t?.rewardConfigs)
          ? t.rewardConfigs.find((r: any) => r?.__typename)
          : null;
        if (rc?.__typename === "MonetaryRewardConfig") {
          const cents = rc.amount?.usdCents ?? 0;
          return {
            score: t.score ?? 0,
            rewardLabel: `$${Math.round(cents / 100)}`,
            rewardKind: "cash" as const,
            rewardConfig: rc,
          };
        }
        if (rc?.__typename === "CardShardRewardConfig") {
          return {
            score: t.score ?? 0,
            rewardLabel: `✦${rc.quantity ?? 0}`,
            rewardKind: "essence" as const,
            rewardConfig: rc,
          };
        }
        if (rc?.__typename === "CoinRewardConfig") {
          return {
            score: t.score ?? 0,
            rewardLabel: `${rc.amount ?? 0} coins`,
            rewardKind: "coin" as const,
            rewardConfig: rc,
          };
        }
        return {
          score: t.score ?? 0,
          rewardLabel: `${t.score ?? 0} pts`,
          rewardKind: "other" as const,
          rewardConfig: rc,
        };
      },
    );

    // Match a completedTask's reward config against a threshold's reward config.
    // Same-shape comparison so we correctly assign each task to its threshold.
    const rewardMatches = (a: any, b: any): boolean => {
      if (!a || !b || a.__typename !== b.__typename) return false;
      switch (a.__typename) {
        case "MonetaryRewardConfig":
          return (a.amount?.usdCents ?? 0) === (b.amount?.usdCents ?? 0);
        case "CardShardRewardConfig":
          return (
            (a.rarity ?? "") === (b.rarity ?? "") &&
            (a.quantity ?? 0) === (b.quantity ?? 0)
          );
        case "CoinRewardConfig":
          return (a.amount ?? 0) === (b.amount ?? 0);
        default:
          return false;
      }
    };

    // Determine which level (if any) a ranking completed this GW, from its
    // lineup's completedTasks. Returns the HIGHEST matching threshold index,
    // or -1 if the user didn't cross any threshold this GW.
    const levelForRanking = (r: any): number => {
      const tasks = r?.so5Lineup?.completedTasks ?? [];
      let best = -1;
      for (const task of tasks) {
        const cfgs = task?.rewardConfigs ?? [];
        for (const cfg of cfgs) {
          for (let i = 0; i < thresholds.length; i++) {
            if (rewardMatches(thresholds[i].rewardConfig, cfg) && i > best) {
              best = i;
            }
          }
        }
      }
      return best;
    };

    // Teams-per-user count (used for the "×N" badge)
    const teamCountByUser = new Map<string, number>();
    for (const r of rankings) {
      const slug = r?.user?.slug;
      if (!slug) continue;
      teamCountByUser.set(slug, (teamCountByUser.get(slug) ?? 0) + 1);
    }

    // For each user: the HIGHEST level completed this GW, and the team that
    // actually completed it (fall back to best-scoring team if we couldn't
    // resolve a specific team).
    interface UserLevelEntry {
      levelIdx: number;
      ranking: any;
    }
    const byUserLevel = new Map<string, UserLevelEntry>();
    for (const r of rankings) {
      const slug = r?.user?.slug;
      if (!slug) continue;
      const levelIdx = levelForRanking(r);
      if (levelIdx < 0) continue;
      const existing = byUserLevel.get(slug);
      if (!existing || levelIdx > existing.levelIdx) {
        byUserLevel.set(slug, { levelIdx, ranking: r });
      }
    }

    const toManager = (r: any): ManagerEntry => ({
      userSlug: r.user?.slug ?? "",
      nickname: r.user?.nickname ?? "",
      pictureUrl: r.user?.pictureUrl ?? null,
      score: r.score ?? 0,
      ranking: r.ranking ?? null,
      teamsCount: teamCountByUser.get(r.user?.slug ?? "") ?? 1,
      lineup: (r.so5Lineup?.so5Appearances ?? []).map((a: any) => ({
        playerName: a.anyPlayer?.displayName ?? "",
        playerSlug: a.anyPlayer?.slug ?? "",
        cardSlug: a.anyCard?.slug ?? null,
        score: a.score ?? 0,
        captain: a.captain ?? false,
        position: a.position ?? "",
      })),
    });

    // Bucket users into their strict level
    const bucketsByLevel: ManagerEntry[][] = thresholds.map(() => []);
    for (const { levelIdx, ranking } of byUserLevel.values()) {
      bucketsByLevel[levelIdx].push(toManager(ranking));
    }
    for (const bucket of bucketsByLevel) {
      bucket.sort((a, b) => b.score - a.score);
    }

    const levels: LevelEntry[] = thresholds.map((t, idx) => ({
      level: idx + 1,
      score: t.score,
      rewardLabel: t.rewardLabel,
      rewardKind: t.rewardKind,
      managerCount: bucketsByLevel[idx].length,
      // Cap managers list to 500 per level to bound payload
      managers: bucketsByLevel[idx].slice(0, 500),
    }));

    leaderboards.push({
      leaderboardSlug: row.leaderboardSlug,
      leaderboardName: row.leaderboardName,
      leagueName: row.leagueName,
      division: row.division,
      mainRarityType: row.mainRarityType,
      totalEntries: row.totalEntries,
      totalManagers: teamCountByUser.size,
      levels,
    });
  }

  // Sort: Premier League first, then alphabetical + division
  leaderboards.sort((a, b) => {
    const aPL = a.leagueName.toLowerCase().includes("premier");
    const bPL = b.leagueName.toLowerCase().includes("premier");
    if (aPL !== bPL) return aPL ? -1 : 1;
    const nameCmp = a.leagueName.localeCompare(b.leagueName);
    if (nameCmp !== 0) return nameCmp;
    return a.division - b.division;
  });

  await prisma.computedResults.upsert({
    where: { key: `streak-achievements:${gameWeek}` },
    create: {
      key: `streak-achievements:${gameWeek}`,
      dataJson: JSON.stringify({ gameWeek, leaderboards }),
    },
    update: {
      dataJson: JSON.stringify({ gameWeek, leaderboards }),
      computedAt: new Date(),
    },
  });

  console.log(
    `[compute] Cached streak achievements for GW ${gameWeek}: ${leaderboards.length} leaderboards`,
  );
}

export type ComputeLogger = (
  step: string,
  detail?: Record<string, unknown>,
) => void;

async function safeStep(
  name: string,
  fn: () => Promise<unknown>,
  log?: ComputeLogger,
) {
  const start = Date.now();
  log?.(`${name}: start`);
  try {
    const result = await fn();
    const ms = Date.now() - start;
    log?.(`${name}: done in ${ms}ms`, { ms });
    return result;
  } catch (err) {
    const ms = Date.now() - start;
    log?.(`${name}: FAILED after ${ms}ms — ${String(err).slice(0, 160)}`, {
      ms,
      error: String(err).slice(0, 200),
    });
    console.error(`[compute] ${name} failed`, err);
    return null;
  }
}

/** Run all computations after a GW scrape completes.
 *  Emits progress through the optional logger so the admin UI can stream it. */
export async function recomputeAllForGW(
  gameWeek: number,
  log?: ComputeLogger,
) {
  log?.(`recompute: start GW ${gameWeek}`);
  console.log(`[compute] Starting recomputation for GW ${gameWeek}...`);

  await safeStep("results", () => computeResultsForGW(gameWeek, log), log);
  await safeStep("achievements", () => computeAchievementsForGW(gameWeek, log), log);
  await safeStep("power-rankings", () => computePowerRankingsForGW(gameWeek, log), log);
  await safeStep("power-rankings:all", () => computeCumulativePowerRankings(log), log);
  await safeStep("user-earnings", () => computeUserEarningsForGW(gameWeek, log), log);
  await safeStep("streak-achievements", () => computeStreakAchievementsForGW(gameWeek, log), log);

  log?.(`recompute: done GW ${gameWeek}`);
  console.log(`[compute] All recomputation done for GW ${gameWeek}`);
}
