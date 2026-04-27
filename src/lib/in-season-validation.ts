import type { InSeasonLineupSlot, InSeasonCompetition, PlayerIntel } from "./types";

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

  // A card is eligible for this comp iff its `eligibleUpcomingLeagueTracks`
  // contains a track to a leaderboard matching this comp's rarity + league.
  // This replaces the old `domesticLeague === comp.leagueName` + `inSeasonEligible`
  // pair — both were stale/misleading (loanees, dual-eligible cards).
  const isEligibleForComp = (card: InSeasonLineupSlot["card"]): boolean => {
    if (!card) return false;
    const tracks = card.eligibleUpcomingLeagueTracks ?? [];
    return tracks.some(
      (t) =>
        t.entrySo5Leaderboard.mainRarityType === comp.mainRarityType &&
        t.entrySo5Leaderboard.so5League.displayName === comp.leagueName,
    );
  };

  for (const slot of filledSlots) {
    const card = slot.card!;
    if (!isEligibleForComp(card)) {
      messages.push({
        type: "error",
        text: `${card.anyPlayer?.displayName ?? "Card"} not eligible for ${comp.leagueName}`,
      });
    }
  }

  // Min 4-of-5 rule is covered by the per-slot check above (each ineligible
  // card becomes an error). Keep a soft count warning while the lineup is
  // still being built.
  const eligibleCount = filledSlots.filter((s) => isEligibleForComp(s.card)).length;
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
