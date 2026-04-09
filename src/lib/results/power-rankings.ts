import type { ResultsRanking } from "../types";

export interface PowerRankEntry {
  userSlug: string;
  nickname: string;
  pictureUrl: string | null;
  totalPoints: number;
  leaderboardCount: number;
  bestFinish: number; // best percentile rank (lowest = best)
  breakdown: PowerRankBreakdown[];
}

export interface PowerRankBreakdown {
  leaderboardSlug: string;
  leagueName: string;
  division: number;
  ranking: number;
  totalEntries: number;
  percentile: number; // 0-100, lower = better
  basePoints: number;
  multiplier: number;
  points: number;
}

interface LeaderboardInput {
  slug: string;
  leagueName: string;
  division: number;
  totalEntries: number;
  rankings: ResultsRanking[];
}

/** Percentile → base points (lower percentile = better) */
function percentileToPoints(percentile: number): number {
  if (percentile <= 1) return 100;
  if (percentile <= 5) return 80;
  if (percentile <= 10) return 60;
  if (percentile <= 25) return 40;
  if (percentile <= 50) return 20;
  return 5;
}

/** Division → score multiplier */
function divisionMultiplier(division: number): number {
  if (division === 1) return 2.0;
  if (division === 2) return 1.5;
  return 1.0;
}

/** Compute power rankings for a single GW */
export function computePowerRankings(
  leaderboards: LeaderboardInput[],
): PowerRankEntry[] {
  // Step 1: For each user, find their best entry per competition (leagueName).
  // A user in "All Star" Div1 AND Div2 only gets their best one.
  // A user with multiple teams in the same leaderboard only gets their best.
  // key: `${userSlug}::${leagueName}`
  const bestPerCompetition = new Map<
    string,
    {
      user: ResultsRanking["user"];
      ranking: number;
      leaderboardSlug: string;
      leagueName: string;
      division: number;
      totalEntries: number;
      points: number;
      percentile: number;
      basePoints: number;
      multiplier: number;
    }
  >();

  for (const lb of leaderboards) {
    if (lb.totalEntries === 0) continue;
    const mult = divisionMultiplier(lb.division);

    for (const r of lb.rankings) {
      const percentile = (r.ranking / lb.totalEntries) * 100;
      const basePoints = percentileToPoints(percentile);
      const points = basePoints * mult;

      const key = `${r.user.slug}::${lb.leagueName}`;
      const prev = bestPerCompetition.get(key);
      if (!prev || points > prev.points) {
        bestPerCompetition.set(key, {
          user: r.user,
          ranking: r.ranking,
          leaderboardSlug: lb.slug,
          leagueName: lb.leagueName,
          division: lb.division,
          totalEntries: lb.totalEntries,
          points,
          percentile,
          basePoints,
          multiplier: mult,
        });
      }
    }
  }

  // Step 2: Aggregate per user
  const userMap = new Map<
    string,
    {
      nickname: string;
      pictureUrl: string | null;
      totalPoints: number;
      leaderboardCount: number;
      bestFinish: number;
      breakdown: PowerRankBreakdown[];
    }
  >();

  for (const entry of bestPerCompetition.values()) {
    const breakdown: PowerRankBreakdown = {
      leaderboardSlug: entry.leaderboardSlug,
      leagueName: entry.leagueName,
      division: entry.division,
      ranking: entry.ranking,
      totalEntries: entry.totalEntries,
      percentile: entry.percentile,
      basePoints: entry.basePoints,
      multiplier: entry.multiplier,
      points: entry.points,
    };

    const existing = userMap.get(entry.user.slug);
    if (existing) {
      existing.totalPoints += entry.points;
      existing.leaderboardCount++;
      existing.bestFinish = Math.min(existing.bestFinish, entry.percentile);
      existing.breakdown.push(breakdown);
    } else {
      userMap.set(entry.user.slug, {
        nickname: entry.user.nickname,
        pictureUrl: entry.user.pictureUrl,
        totalPoints: entry.points,
        leaderboardCount: 1,
        bestFinish: entry.percentile,
        breakdown: [breakdown],
      });
    }
  }

  const results: PowerRankEntry[] = [];
  for (const [slug, data] of userMap) {
    // Sort breakdown by points descending
    data.breakdown.sort((a, b) => b.points - a.points);
    results.push({
      userSlug: slug,
      ...data,
    });
  }

  // Sort by total points descending
  results.sort((a, b) => b.totalPoints - a.totalPoints);

  return results;
}

/** Merge multiple GWs of power rankings into cumulative */
export function mergePowerRankings(
  gwRankings: PowerRankEntry[][],
): PowerRankEntry[] {
  const userMap = new Map<
    string,
    {
      nickname: string;
      pictureUrl: string | null;
      totalPoints: number;
      leaderboardCount: number;
      bestFinish: number;
      breakdown: PowerRankBreakdown[];
    }
  >();

  for (const gwEntries of gwRankings) {
    for (const entry of gwEntries) {
      const existing = userMap.get(entry.userSlug);
      if (existing) {
        existing.totalPoints += entry.totalPoints;
        existing.leaderboardCount += entry.leaderboardCount;
        existing.bestFinish = Math.min(existing.bestFinish, entry.bestFinish);
        existing.breakdown.push(...entry.breakdown);
      } else {
        userMap.set(entry.userSlug, {
          nickname: entry.nickname,
          pictureUrl: entry.pictureUrl,
          totalPoints: entry.totalPoints,
          leaderboardCount: entry.leaderboardCount,
          bestFinish: entry.bestFinish,
          breakdown: [...entry.breakdown],
        });
      }
    }
  }

  const results: PowerRankEntry[] = [];
  for (const [slug, data] of userMap) {
    data.breakdown.sort((a, b) => b.points - a.points);
    results.push({ userSlug: slug, ...data });
  }

  results.sort((a, b) => b.totalPoints - a.totalPoints);
  return results;
}
