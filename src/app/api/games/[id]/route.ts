import { NextRequest, NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { GAME_DETAIL_QUERY } from "@/lib/queries";
import type { GameDetail } from "@/lib/types";

interface GameResponse {
  anyGame: GameDetail;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const result = await sorareClient.request<GameResponse>(
      GAME_DETAIL_QUERY,
      { gameId: id },
    );

    const game = result?.anyGame;
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error: unknown) {
    console.error("Error fetching game:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch game";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
