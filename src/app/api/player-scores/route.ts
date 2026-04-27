import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { PLAYER_SCORES_QUERY, PLAYER_STARTER_ODDS_QUERY } from "@/lib/queries";
import type { PlayerGameScore } from "@/lib/types";

interface PlayerScoresResponse {
  anyPlayer: {
    slug: string;
    displayName: string;
    allPlayerGameScores: {
      nodes: PlayerGameScore[];
    };
  } | null;
}

//
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const slugs = searchParams.get("slugs");
  const position = searchParams.get("position") || "Goalkeeper";
  const positions = searchParams.get("positions");

  // Batch mode: ?slugs=a,b,c — fetch upcoming game starter odds
  if (slugs) {
    const slugList = slugs.split(",").slice(0, 30);

    interface StarterOddsResponse {
      anyPlayer: {
        slug: string;
        activeClub: {
          upcomingGames: {
            playerGameScore: {
              scoreStatus: string;
              projectedScore: number | null;
              projection: { grade: string } | null;
              anyPlayerGameStats: {
                fieldStatus: string;
                footballPlayingStatusOdds: {
                  starterOddsBasisPoints: number;
                  reliability: string;
                } | null;
              } | null;
            } | null;
          }[];
        } | null;
      } | null;
    }

    const results = await Promise.allSettled(
      slugList.map(async (s) => {
        const result = await sorareClient.request<StarterOddsResponse>(
          PLAYER_STARTER_ODDS_QUERY,
          { slug: s }
        );
        const game = result?.anyPlayer?.activeClub?.upcomingGames?.[0];
        const pgs = game?.playerGameScore;
        const odds = pgs?.anyPlayerGameStats?.footballPlayingStatusOdds;
        const starterProbability = odds
          ? odds.starterOddsBasisPoints / 10000
          : null;
        const stats = pgs?.anyPlayerGameStats;
        const fieldStatus = stats?.fieldStatus ?? null;
        const reliability = odds?.reliability ?? null;
        const projectionGrade = pgs?.projection?.grade ?? null;
        const projectedScore = pgs?.projectedScore ?? null;

        return { slug: s, starterProbability, fieldStatus, reliability, projectionGrade, projectedScore };
      })
    );

    const players: Record<string, { starterProbability: number | null; fieldStatus: string | null; reliability: string | null; projectionGrade: string | null; projectedScore: number | null }> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        players[r.value.slug] = {
          starterProbability: r.value.starterProbability,
          fieldStatus: r.value.fieldStatus,
          reliability: r.value.reliability,
          projectionGrade: r.value.projectionGrade,
          projectedScore: r.value.projectedScore,
        };
      }
    }

    return NextResponse.json({ players });
  }

  // Single mode: ?slug=x&position=y
  if (!slug) {
    return NextResponse.json(
      { error: "Missing player slug" },
      { status: 400 }
    );
  }

  try {
    const result = await sorareClient.request<PlayerScoresResponse>(
      PLAYER_SCORES_QUERY,
      { slug, position }
    );

    const scores = result?.anyPlayer?.allPlayerGameScores?.nodes ?? [];

    return NextResponse.json({ scores });
  } catch (error: unknown) {
    console.error("Error fetching player scores:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch player scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
