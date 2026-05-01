import type { InSeasonLineupSlot, InSeasonCompetition, PlayerIntel } from "./types";
import { isCardInSeason, isEligibleForCompetition } from "./in-season/eligibility";

export interface ValidationMessage {
  type: "error" | "warning" | "info" | "success";
  text: string;
}

export interface ValidationResult {
  valid: boolean;
  messages: ValidationMessage[];
}

export function validateInSeasonLineup(
  slots: InSeasonLineupSlot[],
  comp: InSeasonCompetition,
  playerIntelMap?: Record<string, PlayerIntel> | null,
): ValidationResult {
  const messages: ValidationMessage[] = [];
  const filledSlots = slots.filter((s) => s.card);

  if (filledSlots.length === 0) {
    return { valid: false, messages: [{ type: "info", text: "Add cards to build your lineup" }] };
  }

  // Check rarity
  for (const slot of filledSlots) {
    const card = slot.card!;
    if (card.rarityTyped !== comp.mainRarityType) {
      messages.push({
        type: "error",
        text: `${card.anyPlayer?.displayName ?? "Card"} is ${card.rarityTyped}, need ${comp.mainRarityType}`,
      });
    }
  }

  for (const slot of filledSlots) {
    const card = slot.card!;
    if (!isEligibleForCompetition(card, comp)) {
      messages.push({
        type: "error",
        text: `${card.anyPlayer?.displayName ?? "Card"} not eligible for ${comp.leagueName}`,
      });
    }
  }

  // Sorare rule: max 1 classic card per in-season lineup (i.e. min 4 in-season).
  // Validates manually-built lineups; auto-pickers enforce the same rule via
  // pickInSeasonLineup's classic budget. Counts classic cards on top of the
  // per-slot eligibility check so a card that's both classic AND ineligible
  // gets the more specific eligibility error rather than the count error.
  const classicCount = filledSlots.filter((s) => !isCardInSeason(s.card!)).length;
  if (classicCount > 1) {
    messages.push({
      type: "error",
      text: `${classicCount} classic cards in lineup — max 1 allowed (need 4 in-season)`,
    });
  }

  // Min 4-of-5 rule is covered by the per-slot check above (each ineligible
  // card becomes an error). Keep a soft count warning while the lineup is
  // still being built.
  const eligibleCount = filledSlots.filter((s) =>
    s.card ? isEligibleForCompetition(s.card, comp) : false,
  ).length;
  const minRequired = 4;
  if (filledSlots.length < 5 && eligibleCount < minRequired) {
    const remaining = 5 - filledSlots.length;
    const needed = minRequired - eligibleCount;
    if (needed > remaining) {
      messages.push({
        type: "warning",
        text: `${eligibleCount} eligible cards so far — need at least ${minRequired} of 5`,
      });
    }
  }

  // Check captain
  const hasCaptain = slots.some((s) => s.isCaptain && s.card);
  if (filledSlots.length > 0 && !hasCaptain) {
    messages.push({
      type: "warning",
      text: "No captain assigned (+50% score bonus)",
    });
  }

  // Check duplicate players
  const playerSlugs = new Set<string>();
  for (const slot of filledSlots) {
    const slug = slot.card!.anyPlayer?.slug;
    if (slug) {
      if (playerSlugs.has(slug)) {
        messages.push({
          type: "error",
          text: `Duplicate player: ${slot.card!.anyPlayer?.displayName}`,
        });
      }
      playerSlugs.add(slug);
    }
  }

  // Check low start probability
  if (playerIntelMap) {
    for (const slot of filledSlots) {
      const playerSlug = slot.card!.anyPlayer?.slug;
      if (!playerSlug) continue;
      const intel = playerIntelMap[playerSlug];
      if (intel?.starterProbability != null && intel.starterProbability < 30) {
        messages.push({
          type: "warning",
          text: `${slot.card!.anyPlayer?.displayName} has low start probability (${intel.starterProbability}%)`,
        });
      }
    }
  }

  // Check has upcoming game
  for (const slot of filledSlots) {
    const card = slot.card!;
    if (!card.anyPlayer?.activeClub?.upcomingGames?.length) {
      messages.push({
        type: "warning",
        text: `${card.anyPlayer?.displayName ?? "Card"} has no upcoming game this GW`,
      });
    }
  }

  // Incomplete lineup
  if (filledSlots.length < 5) {
    messages.push({
      type: "info",
      text: `${filledSlots.length}/5 slots filled`,
    });
  }

  const hasErrors = messages.some((m) => m.type === "error");
  if (!hasErrors && filledSlots.length === 5) {
    messages.push({ type: "success", text: "Lineup valid" });
  }

  return {
    valid: !hasErrors && filledSlots.length === 5,
    messages,
  };
}
