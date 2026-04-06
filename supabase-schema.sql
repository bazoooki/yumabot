-- Run this in your Supabase SQL editor to create the tables

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  fixture_slug text,
  status text not null default 'waiting',
  created_at timestamptz default now()
);

-- Participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_slug text not null,
  display_name text not null,
  joined_at timestamptz default now(),
  unique(room_id, user_slug)
);

-- Room lineups
create table room_lineups (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  room_id uuid references rooms(id) on delete cascade,
  slots jsonb not null default '[]',
  captain_index int not null default 0,
  target_score int not null default 280,
  current_level int not null default 1,
  unique(room_id, participant_id)
);

-- Room scores (live, updated every poll)
create table room_scores (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  total_score float not null default 0,
  projected_score float not null default 0,
  scores_json jsonb not null default '{}',
  updated_at timestamptz default now(),
  unique(room_id, participant_id)
);

-- Room messages (AI narration + chat)
create table room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  author text not null,
  message text not null,
  message_type text not null default 'chat',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index idx_participants_room on participants(room_id);
create index idx_lineups_room on room_lineups(room_id);
create index idx_scores_room on room_scores(room_id);
create index idx_messages_room on room_messages(room_id, created_at);

-- Enable realtime
alter publication supabase_realtime add table room_scores;
alter publication supabase_realtime add table room_messages;
alter publication supabase_realtime add table participants;
