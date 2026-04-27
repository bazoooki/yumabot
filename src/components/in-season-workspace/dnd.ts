import type { LineupPosition, SorareCard } from "@/lib/types";
import type { DragPayload } from "@/lib/in-season/workspace-store";

// Custom MIME so we can ignore foreign drags (file uploads, browser bookmarks, etc).
export const DRAG_MIME = "application/x-yumabot-card";

const POSITION_FIRST_CHAR_MAP: Record<string, LineupPosition> = {
  G: "GK",
  D: "DEF",
  M: "MID",
  F: "FWD",
};

/** Map a card's primary position to one of our 4 positional slots. EX is wildcard. */
export function cardPrimaryPosition(card: SorareCard): LineupPosition {
  const pos = card.anyPlayer?.cardPositions?.[0] ?? "";
  const first = pos.charAt(0).toUpperCase();
  return POSITION_FIRST_CHAR_MAP[first] ?? "EX";
}

export function serializePayload(p: DragPayload): string {
  return JSON.stringify(p);
}

export function tryParsePayload(serialized: string | null): DragPayload | null {
  if (!serialized) return null;
  try {
    return JSON.parse(serialized) as DragPayload;
  } catch {
    return null;
  }
}

/**
 * Whether `target` is a valid drop slot for the given drag payload.
 *
 * Rules (mock-faithful — see in-season.jsx:165):
 *  - position match: source card's primary position equals target slot, OR
 *  - target slot is EX (wildcard), OR
 *  - source is a slot in the same team (cross-position swap is allowed).
 */
export function isValidDrop(
  drag: DragPayload | null,
  target: { teamId: number; position: LineupPosition },
): boolean {
  if (!drag) return false;
  if (target.position === "EX") return true;
  if (drag.cardPos === target.position) return true;
  if (
    drag.from === "slot" &&
    drag.teamId === target.teamId &&
    drag.position !== target.position
  ) {
    return true; // intra-team swap allowed across positions
  }
  return false;
}
