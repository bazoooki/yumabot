import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { PLAYER_SCORES_QUERY } from "@/lib/queries";
import type { PlayerGameScore } from "@/lib/types";

interface PlayerScoresResponse {
  anyPlayer: {
    slug: string;
    displayName: string;
    allPlayerGameScores: PlayerGameScore[];
  } | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const position = searchParams.get("position") || "Goalkeeper";

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

    const scores = result?.anyPlayer?.allPlayerGameScores ?? [];

    return NextResponse.json({ scores });
  } catch (error: unknown) {
    console.error("Error fetching player scores:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch player scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
