/**
 * Background game event collector.
 *
 * Runs as a standalone process alongside Next.js.
 * Discovers live games, polls Sorare for detailed stats every 30s,
 * diffs to detect events (goals, cards, subs, etc.), and persists
 * them to the `game_events` Supabase table so users joining a room
 * mid-game can replay the event log.
 *
 * Usage:  npx tsx worker/game-collector.ts
 */

import { GraphQLClient } from "graphql-request";
import { createClient } from "@supabase/supabase-js";
import { gql } from "graphql-request";

// ── Types (mirror src/lib/types.ts — kept lean, no React deps) ──

interface StatScore {
  category: string;
  stat: string;
  statValue: number;
  totalScore: number;
  points: number;
}

interface GamePlayerScore {
  score: number;
  scoreStatus: string;
  projectedScore: number | null;
  positionTyped: string;
  anyPlayer: {
    slug: string;
    displayName: string;
    squaredPictureUrl?: string;
    activeClub: { code: string } | null;
  };
  anyPlayerGameStats: { minsPlayed: number; fieldStatus: string | null } | null;
  detailedScore: StatScore[] | null;
  positiveDecisiveStats: StatScore[] | null;
  negativeDecisiveStats: StatScore[] | null;
}

interface GameDetail {
  id: string;
  date: string;
  statusTyped: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { code: string; name: string };
  awayTeam: { code: string; name: string };
  competition: { name: string };
  playerGameScores: GamePlayerScore[];
}

interface FixtureGame {
  id: string;
  date: string;
  statusTyped: string;
  sport: string;
}

interface GameEvent {
  playerSlug: string;
  playerName: string;
  teamCode: string;
  minute: number;
  stat: string;
  category: "decisive" | "negative" | "all_around";
  pointsDelta: number;
  newValue: number;
  playerTotalScore: number;
  timestamp: number;
}

// ── Config ──

const SORARE_API_URL =
  process.env.SORARE_API_URL || "https://api.sorare.com/federation/graphql";
const SORARE_API_KEY = process.env.SORARE_API_KEY || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const POLL_INTERVAL_MS = 30_000;     // per-game poll cadence
const DISCOVERY_INTERVAL_MS = 60_000; // fixture discovery cadence
const CYCLE_INTERVAL_MS = 10_000;    // main loop sleep

// ── Clients ──

const sorare = new GraphQLClient(SORARE_API_URL, {
  headers: {
    ...(SORARE_API_KEY ? { APIKEY: SORARE_API_KEY } : {}),
    "Content-Type": "application/json",
  },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Queries ──

const CURRENT_FIXTURE_QUERY = gql`
  query CurrentFixture {
    so5 {
      so5Fixture(type: LIVE) {
        slug
        games {
          id
          date
          statusTyped
          sport
        }
      }
    }
  }
`;

const GAME_DETAIL_QUERY = gql`
  query GameDetail($gameId: ID!) {
    anyGame(id: $gameId) {
      id
      date
      statusTyped
      homeScore
      awayScore
      homeTeam { code name }
      awayTeam { code name }
      competition { name }
      playerGameScores {
        score
        scoreStatus
        projectedScore
        positionTyped
        anyPlayer {
          slug
          displayName
          activeClub { code }
        }
        anyPlayerGameStats {
          ... on PlayerGameStats {
            minsPlayed
            fieldStatus
          }
        }
        detailedScore {
          category stat statValue totalScore points
        }
        ... on PlayerGameScore {
          positiveDecisiveStats {
            category stat statValue totalScore points
          }
          negativeDecisiveStats {
            category stat statValue totalScore points
          }
        }
      }
    }
  }
`;

// ── Stat diffing (inlined from game-events.ts to avoid React deps) ──

const MIN_POINTS_THRESHOLD = 1.5;

const ALWAYS_SHOW = new Set([
  "goal", "goals", "assist", "own_goal", "red_card", "yellow_card",
  "penalty_won", "penalty_conceded", "clean_sheet", "clean_sheet_60",
  "error_led_to_goal", "last_man_tackle", "big_chance_created",
  "big_chance_missed", "save", "saves", "saved_ibox",
  "double_double", "triple_double", "triple_triple",
]);

type PrevState = Map<string, Map<string, number>>;

function diffGameStats(
  prev: PrevState,
  game: GameDetail,
): { events: GameEvent[]; nextState: PrevState } {
  const events: GameEvent[] = [];
  const nextState: PrevState = new Map();
  const matchMinute = Math.max(
    0,
    Math.round((Date.now() - new Date(game.date).getTime()) / 60000),
  );

  for (const ps of game.playerGameScores) {
    const slug = ps.anyPlayer.slug;
    const prevStats = prev.get(slug) ?? new Map<string, number>();
    const newStats = new Map<string, number>();

    for (const stat of ps.detailedScore ?? []) {
      newStats.set(stat.stat, stat.totalScore);

      const prevScore = prevStats.get(stat.stat) ?? 0;
      const delta = stat.totalScore - prevScore;
      if (Math.abs(delta) < 0.01) continue;

      const isImportant =
        ALWAYS_SHOW.has(stat.stat) || Math.abs(delta) >= MIN_POINTS_THRESHOLD;
      if (!isImportant) continue;

      const isDecisive = (ps.positiveDecisiveStats ?? []).some(
        (s) => s.stat === stat.stat,
      );
      const isNegative = (ps.negativeDecisiveStats ?? []).some(
        (s) => s.stat === stat.stat,
      );
      const category: GameEvent["category"] = isDecisive
        ? "decisive"
        : isNegative
          ? "negative"
          : "all_around";

      events.push({
        playerSlug: slug,
        playerName: ps.anyPlayer.displayName,
        teamCode: ps.anyPlayer.activeClub?.code ?? "",
        minute: matchMinute,
        stat: stat.stat,
        category,
        pointsDelta: Math.round(delta * 10) / 10,
        newValue: stat.statValue,
        playerTotalScore: Math.round(ps.score),
        timestamp: Date.now(),
      });
    }

    nextState.set(slug, newStats);
  }

  return { events, nextState };
}

// ── In-memory game tracking ──

interface TrackedGame {
  prevState: PrevState;
  isFirstPoll: boolean;       // skip events on first poll (baseline capture)
  lastPollAt: number;
  status: string;             // 'playing' | 'played' | 'scheduled'
}

const trackedGames = new Map<string, TrackedGame>();

// ── Core logic ──

let lastDiscoveryAt = 0;
let liveGameIds = new Set<string>();

async function discoverLiveGames(): Promise<void> {
  try {
    const data = await sorare.request<{
      so5: { so5Fixture: { games: FixtureGame[] } | null };
    }>(CURRENT_FIXTURE_QUERY);

    const games = data.so5.so5Fixture?.games ?? [];
    const football = games.filter((g) => g.sport === "FOOTBALL");
    const live = football.filter(
      (g) => g.statusTyped === "playing" || g.statusTyped === "scheduled",
    );

    liveGameIds = new Set(live.map((g) => g.id));

    // Start tracking new games
    for (const g of live) {
      if (!trackedGames.has(g.id)) {
        // Check if we tracked this game before (in Supabase)
        const { data: existing } = await supabase
          .from("game_collector_state")
          .select("game_id")
          .eq("game_id", g.id)
          .single();

        trackedGames.set(g.id, {
          prevState: new Map(),
          isFirstPoll: !existing, // only skip first poll for truly new games
          lastPollAt: 0,
          status: g.statusTyped,
        });

        if (!existing) {
          await supabase.from("game_collector_state").upsert({
            game_id: g.id,
            status: "tracking",
            last_poll_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        log(`tracking game ${g.id} (${g.statusTyped})`);
      }
    }

    // Mark finished games
    for (const [gameId, tracked] of trackedGames) {
      if (!liveGameIds.has(gameId) && tracked.status !== "played") {
        tracked.status = "played";
        await supabase
          .from("game_collector_state")
          .update({ status: "finished", updated_at: new Date().toISOString() })
          .eq("game_id", gameId);
        log(`game ${gameId} finished, will stop tracking`);
      }
    }

    // Remove finished games from memory (keep for one more cycle to catch final events)
    for (const [gameId, tracked] of trackedGames) {
      if (tracked.status === "played" && Date.now() - tracked.lastPollAt > 120_000) {
        trackedGames.delete(gameId);
        log(`removed game ${gameId} from memory`);
      }
    }
  } catch (err) {
    log(`fixture discovery error: ${err instanceof Error ? err.message : err}`);
  }
}

async function pollGame(gameId: string): Promise<void> {
  const tracked = trackedGames.get(gameId);
  if (!tracked) return;

  // Throttle: don't poll more often than POLL_INTERVAL_MS
  if (Date.now() - tracked.lastPollAt < POLL_INTERVAL_MS) return;

  try {
    const data = await sorare.request<{ anyGame: GameDetail | null }>(
      GAME_DETAIL_QUERY,
      { gameId },
    );

    const game = data.anyGame;
    if (!game) return;

    tracked.lastPollAt = Date.now();
    tracked.status = game.statusTyped;

    // Update collector state
    await supabase
      .from("game_collector_state")
      .update({ last_poll_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("game_id", gameId);

    // Run stat diff
    const { events, nextState } = diffGameStats(tracked.prevState, game);
    tracked.prevState = nextState;

    // On first poll, capture baseline — don't emit events
    if (tracked.isFirstPoll) {
      tracked.isFirstPoll = false;
      log(`baseline captured for ${gameId} (${game.homeTeam.code} vs ${game.awayTeam.code}, ${game.playerGameScores.length} players)`);
      return;
    }

    // Persist events
    if (events.length > 0) {
      const rows = events.map((e) => ({
        game_id: gameId,
        player_slug: e.playerSlug,
        player_name: e.playerName,
        team_code: e.teamCode,
        minute: e.minute,
        stat: e.stat,
        category: e.category,
        points_delta: e.pointsDelta,
        new_value: e.newValue,
        player_total_score: e.playerTotalScore,
        timestamp: e.timestamp,
      }));

      const { error } = await supabase.from("game_events").insert(rows);
      if (error) {
        log(`insert error for ${gameId}: ${error.message}`);
      } else {
        for (const e of events) {
          log(`${game.homeTeam.code}-${game.awayTeam.code} ${e.minute}' ${e.stat} ${e.playerName} (${e.pointsDelta > 0 ? "+" : ""}${e.pointsDelta})`);
        }
      }
    }
  } catch (err) {
    log(`poll error for ${gameId}: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Main loop ──

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function run() {
  log("game-collector starting");
  log(`sorare api: ${SORARE_API_URL}`);
  log(`supabase: ${SUPABASE_URL}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  // Initial discovery
  await discoverLiveGames();
  lastDiscoveryAt = Date.now();
  log(`found ${trackedGames.size} games to track`);

  // Main loop
  while (true) {
    // Re-discover games periodically
    if (Date.now() - lastDiscoveryAt > DISCOVERY_INTERVAL_MS) {
      await discoverLiveGames();
      lastDiscoveryAt = Date.now();
    }

    // Poll all tracked games (throttled individually)
    const gameIds = Array.from(trackedGames.keys());
    for (const gameId of gameIds) {
      await pollGame(gameId);
    }

    // Sleep before next cycle
    await new Promise((r) => setTimeout(r, CYCLE_INTERVAL_MS));
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  log("shutting down (SIGINT)");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log("shutting down (SIGTERM)");
  process.exit(0);
});

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
