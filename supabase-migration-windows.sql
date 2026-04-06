-- Run this in Supabase SQL Editor to add game window support

-- Add window columns to rooms
alter table rooms add column if not exists window_start timestamptz;
alter table rooms add column if not exists window_end timestamptz;
alter table rooms add column if not exists games jsonb default '[]';

-- Add game events table for tracking goals, subs, injuries
create table if not exists room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  event_type text not null,  -- 'goal', 'assist', 'sub_in', 'sub_out', 'yellow', 'red', 'injury', 'clean_sheet'
  player_slug text,
  player_name text,
  affected_participants jsonb default '[]',  -- which managers are affected
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_events_room on room_events(room_id, created_at);

-- Add predictions table
create table if not exists room_predictions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  question text not null,
  answer text,
  correct boolean,
  created_at timestamptz default now()
);

-- Enable realtime on new tables
alter publication supabase_realtime add table room_events;
