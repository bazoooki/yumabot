import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { IN_SEASON_UPCOMING_LIST_QUERY } from "@/lib/queries";
import type { InSeasonCompetition, InSeasonStreak } from "@/lib/types";
import type { RarityType, InSeasonTeam } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

interface UpcomingFixtureNode {
  slug: string;
  aasmState: string;
  gameWeek: number;
  endDate: string;
  competitions: InSeasonCompetition[];
}

function deriveLeagueName(lb: any): string {
  return (
    lb.so5LeaderboardGroup?.displayName ??
    lb.so5League?.displayName ??
    lb.displayName ??
    ""
  );
}

function parseUpcomingFixture(fixture: any): InSeasonCompetition[] {
  const leagues = fixture?.so5Leagues ?? [];
  const competitions: InSeasonCompetition[] = [];

  for (const league of leagues) {
    const leaderboards = league.so5Leaderboards ?? [];
    for (const lb of leaderboards) {
      if (lb.seasonality !== "IN_SEASON") continue;

      const streak: InSeasonStreak | null = null;
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

  competitions.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  return competitions;
}

// Returns the next N upcoming fixtures that carry at least one IN_SEASON
// leaderboard. The workspace uses this to render a horizontal GW selector
// so the user can hop between the next few weekend (or whatever) windows.
export async function GET() {
  try {
    const result = (await sorareClient.request(IN_SEASON_UPCOMING_LIST_QUERY, {
      first: 8,
    })) as { so5?: { so5Fixtures?: { nodes?: any[] } } };

    const nodes = result?.so5?.so5Fixtures?.nodes ?? [];
    const fixtures: UpcomingFixtureNode[] = [];
    for (const node of nodes) {
      const competitions = parseUpcomingFixture(node);
      if (competitions.length === 0) continue;
      fixtures.push({
        slug: node.slug,
        aasmState: node.aasmState,
        gameWeek: node.gameWeek,
        endDate: node.endDate,
        competitions,
      });
    }

    return NextResponse.json({ fixtures });
  } catch (error) {
    console.error("[in-season] upcoming-fixtures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming fixtures" },
      { status: 500 },
    );
  }
}
