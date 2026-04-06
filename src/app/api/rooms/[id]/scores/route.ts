import { NextResponse } from "next/server";
import { refreshRoomScores } from "@/lib/rooms/score-engine";

export const dynamic = "force-dynamic";

// GET — Trigger score refresh for the room (called every 30s by clients)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await refreshRoomScores(id);
    return NextResponse.json(result || { scores: [], narration: null });
  } catch (error) {
    console.error("Failed to refresh scores:", error);
    return NextResponse.json({ error: "Failed to refresh scores" }, { status: 500 });
  }
}
