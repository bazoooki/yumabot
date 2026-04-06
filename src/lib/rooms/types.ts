export interface Room {
  id: string;
  name: string;
  invite_code: string;
  fixture_slug: string | null;
  status: "waiting" | "live" | "finished";
  created_at: string;
}

export interface Participant {
  id: string;
  room_id: string;
  user_slug: string;
  display_name: string;
  joined_at: string;
}

export interface RoomLineup {
  id: string;
  participant_id: string;
  room_id: string;
  slots: LineupSlotData[];
  captain_index: number;
  target_score: number;
  current_level: number;
}

export interface LineupSlotData {
  position: string;
  playerSlug: string | null;
  playerName: string | null;
  pictureUrl: string | null;
  rarity: string | null;
  power: string | null;
}

export interface RoomScore {
  id: string;
  room_id: string;
  participant_id: string;
  total_score: number;
  projected_score: number;
  scores_json: Record<string, PlayerScoreData>;
  updated_at: string;
}

export interface PlayerScoreData {
  playerSlug: string;
  playerName: string;
  score: number;
  projectedScore: number | null;
  minsPlayed: number;
  isCaptain: boolean;
  gameStatus: string;
  fieldStatus: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  author: string; // "ai" | "system" | user_slug
  message: string;
  message_type: "narration" | "chat" | "reaction" | "event";
  metadata: Record<string, unknown>;
  created_at: string;
}

// What the AI narrator receives
export interface NarrationContext {
  phase?: "pre" | "live" | "post";
  participants: ParticipantState[];
  scoreChanges: ScoreChange[];
  activeGames: GameState[];
  gameEvents?: GameEvent[];
  leaderboard: LeaderboardEntry[];
  previousNarrations: string[];
}

export interface GameEvent {
  type: "goal" | "assist" | "sub_out" | "sub_in" | "yellow" | "red" | "injury" | "clean_sheet";
  playerName: string;
  playerSlug: string;
  description: string;
  affectedManagers: string[];
}

export interface ParticipantState {
  name: string;
  lineup: { playerName: string; position: string; isCaptain: boolean }[];
  currentScore: number;
  projectedScore: number;
  targetScore: number;
  currentLevel: number;
  streakReward: string;
  distanceToTarget: number;
  status: "on_track" | "at_risk" | "unlikely";
}

export interface ScoreChange {
  playerName: string;
  previousScore: number;
  newScore: number;
  delta: number;
  ownedBy: string[];
  isCaptainFor: string[];
  event?: string;
}

export interface GameState {
  homeTeam: string;
  awayTeam: string;
  status: string;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank: number;
}

// Streak level rewards (reused from lineup-store)
export const STREAK_REWARDS: Record<number, string> = {
  1: "$2",
  2: "$6",
  3: "$15",
  4: "$50",
  5: "$200",
  6: "$1,000",
};
