import type { ScoredCardWithStrategy } from "@/lib/types";
import { isCardInSeason } from "./eligibility";

export const MAX_CLASSIC_CARDS = 1;
const PRIMARY_POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;

const playerKey = (sc: ScoredCardWithStrategy) =>
  sc.card.anyPlayer?.slug ?? sc.card.slug;

/**
 * Pick a 5-card lineup (1 GK + 1 DEF + 1 MID + 1 FWD + 1 EX) enforcing the
 * Sorare in-season composition rule: **at most 1 classic card** (i.e. min 4
 * in-season). The picker prefers in-season cards for every position; classic
 * cards are only used when no in-season candidate fits a position and the
 * single-classic budget is unspent.
 *
 * Two-phase fill so an early position doesn't burn the classic budget on a
 * card that would have been replaceable, leaving a later position with
 * nothing valid:
 *   1. Best in-season per primary position (GK/DEF/MID/FWD).
 *   2. Fill any still-empty primary position with a classic (within budget).
 *   3. EX slot — best remaining non-GK, in-season first, classic only if the
 *      budget remains.
 *
 * `sorted` must be score-descending so `find` picks the best candidate.
 */
export function pickInSeasonLineup(
  sorted: ScoredCardWithStrategy[],
): ScoredCardWithStrategy[] {
  const selected: ScoredCardWithStrategy[] = [];
  const usedPlayers = new Set<string>();
  let classicsUsed = 0;

  const tryPush = (sc: ScoredCardWithStrategy): boolean => {
    if (selected.length >= 5) return false;
    if (usedPlayers.has(playerKey(sc))) return false;
    const inSeason = isCardInSeason(sc.card);
    if (!inSeason && classicsUsed >= MAX_CLASSIC_CARDS) return false;
    selected.push(sc);
    usedPlayers.add(playerKey(sc));
    if (!inSeason) classicsUsed++;
    return true;
  };

  const byPosition: Record<string, ScoredCardWithStrategy[]> = {
    Goalkeeper: [],
    Defender: [],
    Midfielder: [],
    Forward: [],
  };
  for (const sc of sorted) {
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos && byPosition[pos]) byPosition[pos].push(sc);
  }

  for (const pos of PRIMARY_POSITIONS) {
    const cand = byPosition[pos].find(
      (sc) => isCardInSeason(sc.card) && !usedPlayers.has(playerKey(sc)),
    );
    if (cand) tryPush(cand);
  }

  for (const pos of PRIMARY_POSITIONS) {
    const filled = selected.some(
      (sc) => sc.card.anyPlayer?.cardPositions?.[0] === pos,
    );
    if (filled) continue;
    const cand = byPosition[pos].find((sc) => !usedPlayers.has(playerKey(sc)));
    if (cand) tryPush(cand);
  }

  for (const sc of sorted) {
    if (selected.length >= 5) break;
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos === "Goalkeeper") continue;
    if (!isCardInSeason(sc.card)) continue;
    tryPush(sc);
  }
  for (const sc of sorted) {
    if (selected.length >= 5) break;
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos === "Goalkeeper") continue;
    tryPush(sc);
  }

  return selected;
}
