import type { RarityType, Position, LineupPosition } from "./types";
import type { PlayMode } from "./lineup-store";

// --- Position Aliases ---

/** Maps natural language position strings to LineupPosition (GK/DEF/MID/FWD/EX) */
export const LINEUP_POSITION_ALIASES: Record<string, LineupPosition> = {
  gk: "GK",
  goalkeeper: "GK",
  def: "DEF",
  defender: "DEF",
  mid: "MID",
  midfielder: "MID",
  fwd: "FWD",
  forward: "FWD",
  striker: "FWD",
  st: "FWD",
  ex: "EX",
  extra: "EX",
  any: "EX",
};

/** Maps natural language position strings to full Position names */
export const POSITION_ALIASES: Record<string, Position> = {
  gk: "Goalkeeper",
  goalkeeper: "Goalkeeper",
  def: "Defender",
  defender: "Defender",
  mid: "Midfielder",
  midfielder: "Midfielder",
  fwd: "Forward",
  forward: "Forward",
  st: "Forward",
  striker: "Forward",
};

/** Maps full Position name to LineupPosition shortcode */
export const POSITION_TO_SLOT: Record<string, LineupPosition> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Forward: "FWD",
};

/** Maps LineupPosition shortcode to full Position name (null for EX = any) */
export const SLOT_TO_POSITION: Record<LineupPosition, string | null> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
  EX: null,
};

/** Maps LineupPosition to slot index */
export const SLOT_INDEX: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
  EX: 4,
};

// --- Rarity Aliases ---

export const RARITY_ALIASES: Record<string, RarityType> = {
  common: "common",
  limited: "limited",
  rare: "rare",
  super_rare: "super_rare",
  "super rare": "super_rare",
  superrare: "super_rare",
  unique: "unique",
};

// --- Play Mode Aliases ---

export const MODE_ALIASES: Record<string, PlayMode> = {
  safe: "safe",
  balanced: "balanced",
  fast: "fast",
  ceiling: "fast",
  auto: "auto",
};

/** Maps strategy mode names to play modes */
export const STRATEGY_TO_PLAY_MODE: Record<string, PlayMode> = {
  floor: "safe",
  balanced: "balanced",
  ceiling: "fast",
};

// --- Normalization Functions ---

export function normalizeLineupPosition(input: string): LineupPosition | null {
  return LINEUP_POSITION_ALIASES[input.toLowerCase().trim()] ?? null;
}

export function normalizePosition(input: string): Position | null {
  return POSITION_ALIASES[input.toLowerCase().trim()] ?? null;
}

export function normalizeRarity(input: string): RarityType | null {
  return RARITY_ALIASES[input.toLowerCase().trim()] ?? null;
}

export function normalizePlayMode(input: string): PlayMode | null {
  return MODE_ALIASES[input.toLowerCase().trim()] ?? null;
}

/** Check if a player's position matches a lineup slot */
export function positionMatchesSlot(
  playerPosition: string | undefined,
  slotPosition: LineupPosition,
): boolean {
  if (slotPosition === "EX") return playerPosition !== "Goalkeeper";
  return POSITION_TO_SLOT[playerPosition || ""] === slotPosition;
}
