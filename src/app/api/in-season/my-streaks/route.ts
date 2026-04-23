import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { MY_IN_SEASON_STREAKS_QUERY } from "@/lib/queries";
import type { RarityType } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MyStreakCompetition {
  slug: string;
  displayName: string;
  leagueName: string;
  leagueSlug: string;
  leagueIconUrl: string | null;
  iconUrl: string | null;
  mainRarityType: RarityType;
  division: number;
  seasonality: string;
}

export interface MyStreaksResponse {
  fixtureSlug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: MyStreakCompetition[];
}

function deriveLeagueName(lb: any, leagueDisplayName: string): string {
  return (
    lb.so5LeaderboardGroup?.displayName ??
    lb.so5League?.displayName ??
    leagueDisplayName ??
    "Unknown"
  );
}

export async function GET() {
  try {
    const result: any = await sorareClient.request(MY_IN_SEASON_STREAKS_QUERY);
    const fixture = result?.so5?.so5Fixture;
    if (!fixture) {
      return NextResponse.json(
        { error: "No upcoming fixture found" },
        { status: 404 },
      );
    }

    const competitions: MyStreakCompetition[] = [];
    for (const league of fixture.so5Leagues ?? []) {
      for (const lb of league.so5Leaderboards ?? []) {
        if (lb.seasonality !== "IN_SEASON") continue;

        competitions.push({
          slug: lb.slug,
          displayName: lb.displayName ?? "",
          leagueName: deriveLeagueName(lb, league.displayName),
          leagueSlug: lb.so5League?.slug ?? league.slug ?? "",
          leagueIconUrl: league.iconUrl ?? null,
          iconUrl: lb.iconUrl ?? league.iconUrl ?? null,
          mainRarityType: (lb.mainRarityType as RarityType) ?? "limited",
          division: lb.division ?? 1,
          seasonality: lb.seasonality,
        });
      }
    }

    // Sort: league name alpha, then division asc, then rarity order
    const RARITY_ORDER: Record<string, number> = {
      limited: 0,
      rare: 1,
      super_rare: 2,
      unique: 3,
    };
    competitions.sort((a, b) => {
      const nameCmp = a.leagueName.localeCompare(b.leagueName);
      if (nameCmp !== 0) return nameCmp;
      if (a.division !== b.division) return a.division - b.division;
      return (
        (RARITY_ORDER[a.mainRarityType] ?? 99) -
        (RARITY_ORDER[b.mainRarityType] ?? 99)
      );
    });

    return NextResponse.json({
      fixtureSlug: fixture.slug,
      gameWeek: fixture.gameWeek,
      endDate: fixture.endDate,
      aasmState: fixture.aasmState,
      competitions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[my-streaks] Error:", message);
    return NextResponse.json(
      { error: "Failed to fetch my-streaks", detail: message.slice(0, 400) },
      { status: 500 },
    );
  }
}
