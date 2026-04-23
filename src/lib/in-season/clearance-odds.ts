import { normalCDF } from "@/lib/ai-lineup";
import type { InSeasonSlot, InSeasonTeam } from "@/lib/types";

export interface TeamClearance {
  actualTotal: number;
  projectedTotal: number;
  pendingCount: number;
  finishedCount: number;
  successProbability: number;
  pendingSlots: InSeasonSlot[];
  finishedSlots: InSeasonSlot[];
}

const isFinal = (s: InSeasonSlot) =>
  s.scoreStatus === "FINAL" || s.gameStatus === "played";

/**
 * Estimate a team's probability of reaching `targetScore` given slot-level
 * live + projected scores.
 *
 * - actualTotal: sum of scores from slots whose game has finished.
 * - projectedTotal: actualTotal + sum of projectedScore across pending slots.
 * - pendingCount: slots still to play (or mid-game).
 * - stdDev heuristic: each pending player contributes ±15 points of variance.
 *   This is a rough fan-facing heuristic (not a serious statistical model).
 *
 * When all games have finished, probability collapses to 0/1 based on whether
 * actualTotal >= targetScore.
 */
export function computeTeamClearance(
  team: InSeasonTeam,
  targetScore: number,
): TeamClearance {
  const pendingSlots: InSeasonSlot[] = [];
  const finishedSlots: InSeasonSlot[] = [];
  let actualTotal = 0;
  let projectedTotal = 0;

  for (const slot of team.slots) {
    if (!slot.cardSlug) continue;
    const liveScore = slot.score ?? 0;
    if (isFinal(slot)) {
      actualTotal += liveScore;
      projectedTotal += liveScore;
      finishedSlots.push(slot);
    } else {
      pendingSlots.push(slot);
      // For mid-game slots we already have a partial live score; trust the
      // projected figure Sorare returns (it includes accrued points).
      projectedTotal += slot.projectedScore ?? liveScore;
    }
  }

  let successProbability: number;
  if (pendingSlots.length === 0) {
    successProbability = actualTotal >= targetScore ? 1 : 0;
  } else {
    const stdDev = Math.max(1, pendingSlots.length * 15);
    const z = (projectedTotal - targetScore) / stdDev;
    successProbability = normalCDF(z);
  }

  return {
    actualTotal: Math.round(actualTotal),
    projectedTotal: Math.round(projectedTotal),
    pendingCount: pendingSlots.length,
    finishedCount: finishedSlots.length,
    successProbability: Math.round(successProbability * 100) / 100,
    pendingSlots,
    finishedSlots,
  };
}
