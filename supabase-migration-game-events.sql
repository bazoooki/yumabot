-- Game-scoped event log for the background collector.
-- Unlike room_events (room-scoped), these are per-game so any room
-- covering the same game can replay events on join.

CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  player_slug TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_code TEXT DEFAULT '',
  minute INT DEFAULT 0,
  stat TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all_around',
  points_delta FLOAT DEFAULT 0,
  new_value FLOAT DEFAULT 0,
  player_total_score FLOAT DEFAULT 0,
  timestamp BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id, created_at);
CREATE INDEX IF NOT EXISTS idx_game_events_player ON game_events(player_slug);

-- Enable realtime so clients can subscribe to live events
ALTER publication supabase_realtime ADD TABLE game_events;

-- Tracks which games the collector is actively monitoring.
-- Used to resume cleanly after restart (skip first-poll phantom events).
CREATE TABLE IF NOT EXISTS game_collector_state (
  game_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'tracking',  -- 'tracking' | 'finished'
  last_poll_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
