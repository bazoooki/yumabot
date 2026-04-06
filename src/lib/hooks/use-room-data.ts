import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Room, Participant, RoomLineup, RoomScore } from "@/lib/rooms/types";
import type { FixtureGame } from "@/lib/types";

export interface RoomData {
  room: Room & { games?: FixtureGame[] };
  participants: Participant[];
  lineups: RoomLineup[];
  scores: RoomScore[];
}

export function useRoomData(roomId: string) {
  const [data, setData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const fetchRoom = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [roomId]);

  // Initial fetch
  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  // Supabase real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_scores", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_lineups", filter: `room_id=eq.${roomId}` }, () => fetchRoom())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchRoom]);

  // Score polling (every 30s)
  useEffect(() => {
    if (!data?.room) return;
    const interval = setInterval(async () => {
      setPolling(true);
      try { await fetch(`/api/rooms/${roomId}/scores`); } catch {}
      setPolling(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [roomId, data?.room]);

  return { data, loading, polling, refetch: fetchRoom };
}
