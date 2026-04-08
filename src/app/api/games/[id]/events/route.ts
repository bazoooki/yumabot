import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/:id/events
 *
 * Returns the event log for a game, collected by the background worker.
 * Used for replaying events when a user joins a room mid-game.
 *
 * Query params:
 *   since - ISO timestamp to only get events after this time (optional)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  let query = supabase
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .order("timestamp", { ascending: true });

  if (since) {
    query = query.gt("created_at", since);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
