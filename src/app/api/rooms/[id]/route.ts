import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — Room details with participants and lineups
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [roomRes, participantsRes, lineupsRes, scoresRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("id", id).single(),
      supabase.from("participants").select("*").eq("room_id", id).order("joined_at"),
      supabase.from("room_lineups").select("*").eq("room_id", id),
      supabase.from("room_scores").select("*").eq("room_id", id),
    ]);

    if (roomRes.error) throw roomRes.error;

    return NextResponse.json({
      room: roomRes.data,
      participants: participantsRes.data || [],
      lineups: lineupsRes.data || [],
      scores: scoresRes.data || [],
    });
  } catch (error) {
    console.error("Failed to get room:", error);
    return NextResponse.json({ error: "Failed to get room" }, { status: 500 });
  }
}

// POST — Join a room
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userSlug, inviteCode } = await request.json();

    if (!userSlug || !inviteCode) {
      return NextResponse.json({ error: "userSlug and inviteCode required" }, { status: 400 });
    }

    // Verify invite code
    const { data: room, error: rErr } = await supabase
      .from("rooms")
      .select("id, invite_code")
      .eq("id", id)
      .single();

    if (rErr || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.invite_code !== inviteCode.toUpperCase()) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
    }

    // Join
    const { data: participant, error: jErr } = await supabase
      .from("participants")
      .upsert(
        { room_id: id, user_slug: userSlug, display_name: userSlug },
        { onConflict: "room_id,user_slug" }
      )
      .select()
      .single();

    if (jErr) throw jErr;

    return NextResponse.json({ participant });
  } catch (error) {
    console.error("Failed to join room:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
