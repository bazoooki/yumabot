import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { IN_SEASON_LIVE_QUERY, IN_SEASON_UPCOMING_QUERY } from "@/lib/queries";
import type {
  RarityType,
  InSeasonCompetition,
  InSeasonTeam,
  InSeasonSlot,
  InSeasonStreak,
  InSeasonThreshold,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Shared helpers ---

function parseSlot(appearance: any): InSeasonSlot {
  const pgs = appearance.playerGameScore;
  const game = pgs?.anyGame;
  return {
    index: appearance.index,
    position: appearance.anyPlayer?.cardPositions?.[0] ?? "",
    cardSlug: appearance.anyCard?.slug ?? null,
    playerName: appearance.anyPlayer?.displayName ?? null,
    playerSlug: appearance.anyPlayer?.slug ?? null,
    pictureUrl: appearance.anyCard?.pictureUrl ?? appearance.anyPlayer?.squaredPictureUrl ?? null,
    playerPictureUrl: appearance.anyPlayer?.squaredPictureUrl ?? null,
    rarityTyped: appearance.anyCard?.rarityTyped ?? null,
    isCaptain: appearance.captain ?? false,
    score: appearance.score ?? null,
    scoreStatus: appearance.status ?? null,
    gameDate: game?.date ?? null,
    gameStatus: game?.statusTyped ?? null,
    gameHomeCode: game?.homeTeam?.code ?? null,
    gameAwayCode: game?.awayTeam?.code ?? null,
  };
}

function parseStreak(task: any): InSeasonStreak | null {
  if (!task?.thresholds) return null;

  const currentIdx = task.thresholds.findIndex((th: any) => th.current);

  const thresholds: InSeasonThreshold[] = task.thresholds.map(
    (t: any, i: number) => {
      const monetary = t.rewardConfigs?.find(
        (r: any) => r.amount?.usdCents != null,
      );
      const coin = t.rewardConfigs?.find(
        (r: any) => r.currency != null,
      );
      let reward = "";
      if (monetary) {
        reward = `$${Math.round(monetary.amount.usdCents / 100)}`;
      } else if (coin) {
        reward = `${coin.amount} coins`;
      }

      return {
        level: i + 1,
        score: t.score,
        reward,
        isCleared: currentIdx >= 0 ? i < currentIdx : false,
        isCurrent: t.current ?? false,
      };
    },
  );

  const currentLevel = thresholds.findIndex((t) => t.isCurrent);
  return {
    currentLevel: currentLevel >= 0 ? currentLevel + 1 : 0,
    streakCount: task.progress ?? 0,
    thresholds,
  };
}

function deriveLeagueName(lb: any): string {
  const groupName = lb.so5LeaderboardGroup?.displayName;
  if (groupName) return groupName;
  const leagueName = lb.so5League?.displayName;
  if (leagueName) return leagueName;
  return "Unknown";
}

const RARITY_ORDER: Record<string, number> = {
  limited: 0,
  rare: 1,
  super_rare: 2,
  unique: 3,
};

function sortCompetitions(competitions: InSeasonCompetition[]) {
  competitions.sort((a, b) => {
    const leagueCmp = a.leagueName.localeCompare(b.leagueName);
    if (leagueCmp !== 0) return leagueCmp;
    return (RARITY_ORDER[a.mainRarityType] ?? 0) - (RARITY_ORDER[b.mainRarityType] ?? 0);
  });
}

// --- LIVE: fetch existing lineups via userFixtureResults ---

function parseLive(result: any, seasonalityFilter?: string): InSeasonCompetition[] {
  const contenders =
    result?.so5?.so5Fixture?.userFixtureResults?.so5LeaderboardContenders?.nodes ?? [];

  const filtered = seasonalityFilter === "all"
    ? contenders
    : contenders.filter(
        (c: any) => c.so5Leaderboard?.seasonality === (seasonalityFilter || "IN_SEASON"),
      );

  // Group by leaderboard (multiple contenders = multiple teams)
  const byLeaderboard = new Map<string, any[]>();
  for (const c of filtered) {
    const slug = c.so5Leaderboard?.slug;
    if (!slug) continue;
    const arr = byLeaderboard.get(slug) ?? [];
    arr.push(c);
    byLeaderboard.set(slug, arr);
  }

  const competitions: InSeasonCompetition[] = [];
  for (const [, group] of byLeaderboard) {
    const first = group[0];
    const lb = first.so5Leaderboard;

    const teams: InSeasonTeam[] = group.map((contender: any) => {
      const lineup = contender.so5Lineup;
      if (!lineup) {
        return { name: "Empty", lineupSlug: null, slots: [], totalScore: null, rewardMultiplier: 1, canEdit: true, ranking: null };
      }
      const slots = (lineup.so5Appearances ?? []).map(parseSlot);
      const ranking = lineup.so5Rankings?.[0];
      return {
        name: lineup.name ?? "Team",
        lineupSlug: contender.slug,
        slots,
        totalScore: ranking?.score ?? null,
        rewardMultiplier: lineup.rewardMultiplier ?? 1,
        canEdit: lineup.canEdit ?? false,
        ranking: ranking?.ranking ?? null,
      };
    });

    const streak = parseStreak(first.so5Lineup?.thresholdsStreakTask);

    competitions.push({
      slug: lb.slug,
      displayName: lb.displayName ?? "",
      leagueName: deriveLeagueName(lb),
      leagueSlug: lb.so5League?.slug ?? "",
      seasonality: lb.seasonality,
      mainRarityType: (lb.mainRarityType as RarityType) ?? "limited",
      division: lb.division ?? 1,
      teamsCap: lb.teamsCap ?? 4,
      cutOffDate: lb.cutOffDate ?? "",
      canCompose: lb.canCompose?.value ?? false,
      iconUrl: lb.iconUrl ?? "",
      stadiumUrl: lb.stadiumUrl ?? null,
      teams,
      streak,
      eligibleCardCount: 0,
    });
  }

  sortCompetitions(competitions);
  return competitions;
}

// --- UPCOMING: fetch all available leaderboards via so5Leagues ---

function parseUpcoming(result: any): InSeasonCompetition[] {
  const leagues = result?.so5?.so5Fixture?.so5Leagues ?? [];
  const competitions: InSeasonCompetition[] = [];

  for (const league of leagues) {
    const leaderboards = league.so5Leaderboards ?? [];
    for (const lb of leaderboards) {
      if (lb.seasonality !== "IN_SEASON") continue;

      // Streak data not available for UPCOMING without auth — will be null
      const streak: InSeasonStreak | null = null;

      // Empty teams — user will build these locally
      const emptyTeams: InSeasonTeam[] = Array.from(
        { length: lb.teamsCap ?? 4 },
        (_, i) => ({
          name: `Team #${i + 1}`,
          lineupSlug: null,
          slots: [],
          totalScore: null,
          rewardMultiplier: 1,
          canEdit: true,
          ranking: null,
        }),
      );

      competitions.push({
        slug: lb.slug,
        displayName: lb.displayName ?? "",
        leagueName: deriveLeagueName(lb),
        leagueSlug: lb.so5League?.slug ?? league.slug ?? "",
        seasonality: lb.seasonality,
        mainRarityType: (lb.mainRarityType as RarityType) ?? "limited",
        division: lb.division ?? 1,
        teamsCap: lb.teamsCap ?? 4,
        cutOffDate: lb.cutOffDate ?? "",
        canCompose: lb.canCompose?.value ?? false,
        iconUrl: lb.iconUrl ?? league.iconUrl ?? "",
        stadiumUrl: lb.stadiumUrl ?? null,
        teams: emptyTeams,
        streak,
        eligibleCardCount: 0,
      });
    }
  }

  sortCompetitions(competitions);
  return competitions;
}

// --- Route handler ---

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userSlug = searchParams.get("userSlug");
  const fixtureType = searchParams.get("type") || "UPCOMING";
  const seasonality = searchParams.get("seasonality") || undefined;

  if (!userSlug && fixtureType === "LIVE") {
    return NextResponse.json(
      { error: "userSlug is required for LIVE mode" },
      { status: 400 },
    );
  }

  try {
    let result: any;
    if (fixtureType === "LIVE") {
      result = await sorareClient.request(IN_SEASON_LIVE_QUERY, { userSlug });
    } else {
      result = await sorareClient.request(IN_SEASON_UPCOMING_QUERY);
    }

    const fixture = result?.so5?.so5Fixture;
    if (!fixture) {
      return NextResponse.json(
        { error: "No fixture found" },
        { status: 404 },
      );
    }

    const competitions =
      fixtureType === "LIVE" ? parseLive(result, seasonality) : parseUpcoming(result);

    return NextResponse.json({
      fixtureSlug: fixture.slug,
      gameWeek: fixture.gameWeek,
      endDate: fixture.endDate,
      aasmState: fixture.aasmState,
      competitions,
    });
  } catch (error) {
    console.error("[in-season] Error fetching competitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch in-season competitions" },
      { status: 500 },
    );
  }
}
