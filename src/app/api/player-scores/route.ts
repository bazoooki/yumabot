import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { PLAYER_SCORES_QUERY, PLAYER_STARTER_ODDS_QUERY } from "@/lib/queries";
import type { PlayerGameScore } from "@/lib/types";

interface BatchHistoryResponse {
  anyPlayer: {
    slug: string;
    allPlayerGameScores: {
      nodes: PlayerGameScore[];
    };
  } | null;
}

interface PlayerScoresResponse {
  anyPlayer: {
    slug: string;
    displayName: string;
    allPlayerGameScores: {
      nodes: PlayerGameScore[];
    };
  } | null;
}

interface StarterOddsBatchPayload {
  starterProbability: number | null;
  fieldStatus: string | null;
  reliability: string | null;
  projectionGrade: string | null;
  projectedScore: number | null;
}

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

//
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const slugs = searchParams.get("slugs");
  const position = searchParams.get("position") || "Goalkeeper";

  const history = searchParams.get("history") === "1";
  const positions = searchParams.get("positions");

  // Batch history mode: ?slugs=a,b,c&positions=Forward,Midfielder&history=1
  // Returns raw recent PlayerGameScore[] per slug (NOT aggregated form).
  // Used by the home AI panel's formula override when minutesDepth or
  // setPieceTaker ingredients are enabled — those need per-game minsPlayed,
  // setPieceTaken, penaltyTaken which the form endpoint doesn't expose.
  if (slugs && history) {
    const slugList = slugs.split(",").slice(0, 15);
    const posList = positions ? positions.split(",") : [];

    const results = await Promise.allSettled(
      slugList.map(async (s, i) => {
        const pos = posList[i] || "Goalkeeper";
        const result = await sorareClient.request<BatchHistoryResponse>(
          PLAYER_SCORES_QUERY,
          { slug: s, position: pos },
        );
        const nodes = result?.anyPlayer?.allPlayerGameScores?.nodes ?? [];
        return { slug: s, scores: nodes };
      }),
    );

    const players: Record<string, PlayerGameScore[]> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        players[r.value.slug] = r.value.scores;
      }
    }

    return NextResponse.json({ players });
  }

  // Batch mode: ?slugs=a,b,c — fetch upcoming game starter odds.
  // Sorare's federation gateway rejects aliased duplicate root fields
  // ("Duplicated root field: anyPlayer"), so we have to fan out per slug.
  // Concurrency is bounded globally inside `sorareClient` (semaphore) so
  // these calls queue alongside fixtures/competitions instead of bursting
  // through the per-account rate limit.
  if (slugs) {
    const slugList = slugs.split(",").slice(0, 15); // see knowledge/03-sorare-graphql.md

    const results = await Promise.allSettled(
      slugList.map(async (s) => {
        const result = await sorareClient.request<StarterOddsResponse>(
          PLAYER_STARTER_ODDS_QUERY,
          { slug: s },
        );
        const game = result?.anyPlayer?.activeClub?.upcomingGames?.[0];
        const pgs = game?.playerGameScore;
        const odds = pgs?.anyPlayerGameStats?.footballPlayingStatusOdds;
        return {
          slug: s,
          starterProbability: odds ? odds.starterOddsBasisPoints / 10000 : null,
          fieldStatus: pgs?.anyPlayerGameStats?.fieldStatus ?? null,
          reliability: odds?.reliability ?? null,
          projectionGrade: pgs?.projection?.grade ?? null,
          projectedScore: pgs?.projectedScore ?? null,
        };
      }),
    );

    const players: Record<string, StarterOddsBatchPayload> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        const { slug: s, ...payload } = r.value;
        players[s] = payload;
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
