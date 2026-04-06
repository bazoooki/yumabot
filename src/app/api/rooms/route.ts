import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sorareClient } from "@/lib/sorare-client";
import { CURRENT_FIXTURE_QUERY } from "@/lib/queries";
import type { Fixture, FixtureGame } from "@/lib/types";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface GameWindow {
  windowLabel: string;
  windowStart: string;
  windowEnd: string;
  games: FixtureGame[];
  room: { id: string; invite_code: string; status: string } | null;
  participantCount: number;
}

function groupGamesIntoWindows(games: FixtureGame[]): { start: Date; end: Date; games: FixtureGame[] }[] {
  const now = Date.now();

  // Only include games that haven't started yet
  const sorted = [...games]
    .filter((g) => g.date && new Date(g.date).getTime() > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) return [];

  const MERGE_MS = 90 * 60 * 1000; // 90 min — merge nearby kickoffs into one room
  const windows: { start: Date; end: Date; games: FixtureGame[] }[] = [];
  let current = { start: new Date(sorted[0].date), end: new Date(sorted[0].date), games: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    const gameTime = new Date(sorted[i].date);
    if (gameTime.getTime() - current.start.getTime() <= MERGE_MS) {
      current.games.push(sorted[i]);
      if (gameTime > current.end) current.end = gameTime;
    } else {
      windows.push(current);
      current = { start: gameTime, end: gameTime, games: [sorted[i]] };
    }
  }
  windows.push(current);

  // Only return windows with 3+ games
  return windows.filter((w) => w.games.length >= 3);
}

function formatWindowLabel(start: Date, gameCount: number): string {
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();

  const day = isToday ? "Today" : isTomorrow ? "Tomorrow" : start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return `${day} ${time} — ${gameCount} game${gameCount !== 1 ? "s" : ""}`;
}

// GET — List game window rooms
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userSlug = searchParams.get("userSlug");

    // 1. Check if rooms already exist for the current fixture
    const { data: existingRooms } = await supabase
      .from("rooms")
      .select("*, participants(count)")
      .not("window_start", "is", null)
      .order("window_start", { ascending: true });

    // If we have rooms with window data, check if they're from the current fixture
    // by seeing if any have future/live games (not all finished)
    const now = new Date();
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const activeRooms = (existingRooms || []).filter((r) => {
      // Filter by date — if latest game kickoff + 3h is in the past, room is done
      const windowEnd = new Date(r.window_end || r.window_start);
      return windowEnd.getTime() + THREE_HOURS > now.getTime();
    });

    if (activeRooms.length > 0) {
      // Rooms already exist — just return them, no Sorare API call needed
      const fixtureSlug = activeRooms[0].fixture_slug;

      const result: GameWindow[] = activeRooms.map((r) => {
        const games = (r.games || []) as FixtureGame[];
        const start = new Date(r.window_start);

        // Auto-join user if needed
        if (userSlug) {
          supabase
            .from("participants")
            .upsert(
              { room_id: r.id, user_slug: userSlug, display_name: userSlug },
              { onConflict: "room_id,user_slug" }
            )
            .then(() => {});
        }

        return {
          windowLabel: r.name,
          windowStart: r.window_start,
          windowEnd: r.window_end,
          games,
          room: { id: r.id, invite_code: r.invite_code, status: r.status },
          participantCount: (r.participants as unknown as { count: number }[])?.[0]?.count || 0,
        };
      });

      return NextResponse.json({
        windows: result,
        fixture: { slug: fixtureSlug, displayName: activeRooms[0].name, gameWeek: 0 },
      });
    }

    // 2. No active rooms — fetch fixture from Sorare and create them (one-time)
    console.log("[Rooms] No active rooms found, fetching fixture from Sorare...");

    const fixtureData = await sorareClient.request<{
      so5: { so5Fixture: Fixture };
    }>(CURRENT_FIXTURE_QUERY);

    const fixture = fixtureData.so5.so5Fixture;
    if (!fixture || !fixture.games?.length) {
      return NextResponse.json({ windows: [], fixture: null });
    }

    console.log(`[Rooms] Creating rooms for GW${fixture.gameWeek}: ${fixture.games.length} games`);

    const gameWindows = groupGamesIntoWindows(fixture.games);
    const result: GameWindow[] = [];

    for (const window of gameWindows) {
      const label = formatWindowLabel(window.start, window.games.length);
      const { data: room } = await supabase
        .from("rooms")
        .insert({
          name: label,
          invite_code: generateInviteCode(),
          fixture_slug: fixture.slug,
          status: "waiting",
          window_start: window.start.toISOString(),
          window_end: window.end.toISOString(),
          games: window.games.map((g) => ({
            id: g.id,
            date: g.date,
            statusTyped: g.statusTyped,
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            competition: g.competition,
          })),
        })
        .select("id, invite_code, status")
        .single();

      if (userSlug && room) {
        await supabase
          .from("participants")
          .upsert(
            { room_id: room.id, user_slug: userSlug, display_name: userSlug },
            { onConflict: "room_id,user_slug" }
          );
      }

      result.push({
        windowLabel: label,
        windowStart: window.start.toISOString(),
        windowEnd: window.end.toISOString(),
        games: window.games,
        room: room ? { id: room.id, invite_code: room.invite_code, status: room.status } : null,
        participantCount: userSlug ? 1 : 0,
      });
    }

    return NextResponse.json({
      windows: result,
      fixture: { slug: fixture.slug, displayName: fixture.displayName, gameWeek: fixture.gameWeek },
    });
  } catch (error) {
    console.error("Failed to list game windows:", error);
    return NextResponse.json({ error: "Failed to load game windows" }, { status: 500 });
  }
}

// POST — Create a custom room
export async function POST(request: Request) {
  try {
    const { name, userSlug } = await request.json();

    if (!name || !userSlug) {
      return NextResponse.json({ error: "name and userSlug required" }, { status: 400 });
    }

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({ name, invite_code: generateInviteCode() })
      .select()
      .single();

    if (roomErr) throw roomErr;

    await supabase.from("participants").insert({
      room_id: room.id,
      user_slug: userSlug,
      display_name: userSlug,
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
