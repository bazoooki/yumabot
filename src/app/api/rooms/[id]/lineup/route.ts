import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PUT — Submit or update a lineup for this room
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const { userSlug, slots, captainIndex, targetScore, currentLevel } = await request.json();

    if (!userSlug || !slots || !Array.isArray(slots)) {
      return NextResponse.json({ error: "userSlug and slots required" }, { status: 400 });
    }

    // Find participant
    const { data: participant, error: pErr } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_slug", userSlug)
      .single();

    if (pErr || !participant) {
      return NextResponse.json({ error: "Not a participant in this room" }, { status: 403 });
    }

    // Upsert lineup
    const { data: lineup, error: lErr } = await supabase
      .from("room_lineups")
      .upsert(
        {
          participant_id: participant.id,
          room_id: roomId,
          slots,
          captain_index: captainIndex ?? 0,
          target_score: targetScore ?? 280,
          current_level: currentLevel ?? 1,
        },
        { onConflict: "room_id,participant_id" }
      )
      .select()
      .single();

    if (lErr) throw lErr;

    return NextResponse.json({ lineup });
  } catch (error) {
    console.error("Failed to submit lineup:", error);
    return NextResponse.json({ error: "Failed to submit lineup" }, { status: 500 });
  }
}
