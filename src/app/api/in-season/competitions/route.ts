import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import {
  IN_SEASON_LIVE_QUERY,
  IN_SEASON_UPCOMING_QUERY,
  IN_SEASON_BY_FIXTURE_QUERY,
} from "@/lib/queries";
import {
  parseEligibleOrSo5Rewards,
  parseCompletedTasksRewards,
  mergeRewardBreakdowns,
} from "@/lib/rewards";
import { parseStreak } from "@/lib/in-season/parse-streak";
import type {
  RarityType,
  InSeasonCompetition,
  InSeasonTeam,
  InSeasonSlot,
  InSeasonStreak,
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
    projectedScore: pgs?.projectedScore ?? null,
    projectionGrade: pgs?.projection?.grade ?? null,
    gameDate: game?.date ?? null,
    gameStatus: game?.statusTyped ?? null,
    gameHomeCode: game?.homeTeam?.code ?? null,
    gameAwayCode: game?.awayTeam?.code ?? null,
    gameHomeCrestUrl: game?.homeTeam?.pictureUrl ?? null,
    gameAwayCrestUrl: game?.awayTeam?.pictureUrl ?? null,
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

/** A fixture is "final" when it's closed OR past its endDate. */
function isFixtureFinal(fixture: any): boolean {
  if (!fixture) return false;
  if (fixture.aasmState === "closed") return true;
  if (fixture.endDate) {
    const end = new Date(fixture.endDate).getTime();
    if (!Number.isNaN(end) && end < Date.now()) return true;
  }
  return false;
}

function parseLive(result: any, seasonalityFilter?: string): InSeasonCompetition[] {
  const fixture = result?.so5?.so5Fixture;
  const fixtureFinal = isFixtureFinal(fixture);
  const contenders =
    fixture?.userFixtureResults?.so5LeaderboardContenders?.nodes ?? [];

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
        return {
          name: "Empty",
          lineupSlug: null,
          slots: [],
          totalScore: null,
          rewardMultiplier: 1,
          canEdit: true,
          ranking: null,
          rewardUsdCents: 0,
          rewardEssence: [],
          rewardIsActual: false,
        };
      }
      const slots = (lineup.so5Appearances ?? []).map(parseSlot);
      const ranking = lineup.so5Rankings?.[0];
      // Rewards = rank bracket + completed tasks (streak threshold payouts, etc.)
      const rewards = parseEligibleOrSo5Rewards(
        ranking?.eligibleOrSo5Rewards ?? [],
      );
      mergeRewardBreakdowns(
        rewards,
        parseCompletedTasksRewards(lineup.completedTasks ?? []),
      );
      // Past/closed fixture → rewards are final regardless of union branch.
      const isActual = fixtureFinal || rewards.isActual;
      return {
        name: lineup.name ?? "Team",
        lineupSlug: contender.slug,
        slots,
        totalScore: ranking?.score ?? null,
        rewardMultiplier: lineup.rewardMultiplier ?? 1,
        canEdit: lineup.canEdit ?? false,
        ranking: ranking?.ranking ?? null,
        rewardUsdCents: rewards.usdCents,
        rewardEssence: rewards.essence,
        rewardIsActual: isActual,
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
          rewardUsdCents: 0,
          rewardEssence: [],
          rewardIsActual: false,
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
  const fixtureSlug = searchParams.get("fixtureSlug") || undefined;
  const seasonality = searchParams.get("seasonality") || undefined;

  // fixtureSlug mode treats the response like LIVE (userFixtureResults shape)
  const isByFixture = Boolean(fixtureSlug);
  const needsUser = fixtureType === "LIVE" || isByFixture;
  if (!userSlug && needsUser) {
    return NextResponse.json(
      { error: "userSlug is required for LIVE or fixtureSlug mode" },
      { status: 400 },
    );
  }

  try {
    let result: any;
    if (isByFixture) {
      result = await sorareClient.request(IN_SEASON_BY_FIXTURE_QUERY, {
        userSlug,
        fixtureSlug,
      });
    } else if (fixtureType === "LIVE") {
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
      fixtureType === "LIVE" || isByFixture
        ? parseLive(result, seasonality)
        : parseUpcoming(result);

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
