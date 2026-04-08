import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/game-events?gameIds=id1,id2,id3
 *
 * Batch fetch events for multiple games.
 * Used when joining a room that covers several games.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameIdsParam = searchParams.get("gameIds");

  if (!gameIdsParam) {
    return NextResponse.json({ error: "gameIds required" }, { status: 400 });
  }

  const gameIds = gameIdsParam.split(",").slice(0, 20); // cap at 20

  const { data, error } = await supabase
    .from("game_events")
    .select("*")
    .in("game_id", gameIds)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
