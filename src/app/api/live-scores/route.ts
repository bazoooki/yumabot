import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { LIVE_PLAYER_SCORES_QUERY } from "@/lib/queries";

interface LiveScoreResponse {
  anyPlayer: {
    slug: string;
    activeClub: {
      upcomingGames: {
        date: string;
        statusTyped: string;
        homeTeam: { code: string };
        awayTeam: { code: string };
        playerGameScore: {
          score: number;
          scoreStatus: string;
          projectedScore: number | null;
          anyPlayerGameStats: {
            minsPlayed: number;
            fieldStatus: string;
          } | null;
        } | null;
      }[];
    } | null;
  } | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slugs = searchParams.get("slugs");

  if (!slugs) {
    return NextResponse.json({ error: "Missing slugs" }, { status: 400 });
  }

  const slugList = slugs.split(",").slice(0, 10);

  const results = await Promise.allSettled(
    slugList.map(async (slug) => {
      const result = await sorareClient.request<LiveScoreResponse>(
        LIVE_PLAYER_SCORES_QUERY,
        { slug }
      );
      const game = result?.anyPlayer?.activeClub?.upcomingGames?.[0];
      const pgs = game?.playerGameScore;
      const stats = pgs?.anyPlayerGameStats;

      return {
        playerSlug: slug,
        score: pgs?.score ?? 0,
        projectedScore: pgs?.projectedScore ?? null,
        scoreStatus: pgs?.scoreStatus ?? "PENDING",
        minsPlayed: stats?.minsPlayed ?? 0,
        fieldStatus: stats?.fieldStatus ?? null,
        gameStatus: game?.statusTyped ?? "scheduled",
        gameDate: game?.date ?? "",
        homeTeam: game?.homeTeam?.code ?? "",
        awayTeam: game?.awayTeam?.code ?? "",
      };
    })
  );

  const scores: Record<string, unknown> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      scores[r.value.playerSlug] = r.value;
    }
  }

  return NextResponse.json({ scores });
}
