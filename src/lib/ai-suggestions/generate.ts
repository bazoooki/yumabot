import {
  estimateLineupProbability,
  mapThresholdToLevel,
  RISK_PROFILE_WEIGHTS,
  scoreCardsWithStrategy,
} from "@/lib/ai-lineup";
import { isCardEligibleFor } from "@/lib/in-season/eligibility";
import { nextTargetForEntry } from "@/lib/in-season/streak-target";
import type {
  PlayerIntel,
  RarityType,
  ScoredCardWithStrategy,
  SorareCard,
} from "@/lib/types";
import type { HotStreakEntry } from "@/components/home/use-hot-streak-entries";
import type {
  AiSuggestionsSettings,
  LineupCount,
} from "@/lib/ai-suggestions-store";
import type { SuggestedLineup } from "@/lib/in-season/build-suggested-competition";

/**
 * Resolve the target threshold given the user's requested level offset.
 * Delegates to the shared `nextTargetForEntry` helper which handles the
 * heuristic fallback when streak data is missing.
 */
function resolveTarget(
  entry: HotStreakEntry,
  offset: number,
): { score: number; rewardLabel: string; level: number } {
  const t = nextTargetForEntry(entry, offset);
  return { score: t.score, rewardLabel: t.reward, level: t.level };
}

function filterEligible(
  cards: SorareCard[],
  rarity: RarityType,
  leagueName: string,
  excludeDoubtful: boolean,
  starterProbs: Record<string, number | null>,
): SorareCard[] {
  // HotStreakEntry is always sourced from an IN_SEASON competition (see
  // useHotStreakEntries which filters live competitions on `seasonality ===
  // "IN_SEASON"`), so we hardcode the seasonality to keep classic-edition
  // cards of the same player out of the suggestion pool.
  return cards.filter((c) => {
    if (
      !isCardEligibleFor(c, {
        mainRarityType: rarity,
        leagueName,
        seasonality: "IN_SEASON",
      })
    ) {
      return false;
    }
    if (!c.anyPlayer?.activeClub?.upcomingGames?.length) return false;
    if (excludeDoubtful) {
      const slug = c.anyPlayer?.slug;
      const prob = slug ? starterProbs[slug] : null;
      if (prob != null && prob < 30) return false;
    }
    return true;
  });
}

/**
 * Pick 5 cards from the sorted scored list enforcing positional diversity
 * (1 GK, 1 DEF, 1 MID, 1 FWD, then best remaining for the EX slot).
 * De-duplicates by player slug so the same player doesn't occupy two slots.
 */
function pickFiveWithDiversity(
  sorted: ScoredCardWithStrategy[],
): ScoredCardWithStrategy[] {
  const selected: ScoredCardWithStrategy[] = [];
  const usedPlayers = new Set<string>();
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

  for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward"]) {
    const best = byPosition[pos].find((sc) => {
      const slug = sc.card.anyPlayer?.slug ?? sc.card.slug;
      return !usedPlayers.has(slug);
    });
    if (best && selected.length < 5) {
      selected.push(best);
      usedPlayers.add(best.card.anyPlayer?.slug ?? best.card.slug);
    }
  }

  // EX slot fill — Sorare's EX slot accepts any position *except* Goalkeeper
  // (see positionMatchesSlot in src/lib/normalization.ts). Without this guard
  // the overflow would happily pick a second GK if it outranked other outfield
  // candidates, producing an invalid lineup.
  for (const sc of sorted) {
    if (selected.length >= 5) break;
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos === "Goalkeeper") continue;
    const slug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (!usedPlayers.has(slug)) {
      selected.push(sc);
      usedPlayers.add(slug);
    }
  }

  return selected;
}

/**
 * Captain = highest strategy-weighted score in the lineup. Using the
 * weighted score (rather than raw expectedScore) means safe/balanced/ceiling
 * each promote the player that best fits their risk profile — otherwise all
 * three tabs crown the same captain.
 */
function pickCaptain(lineup: ScoredCardWithStrategy[]): string {
  let best: ScoredCardWithStrategy | null = null;
  for (const sc of lineup) {
    if (!best || sc.strategyScore > best.strategyScore) {
      best = sc;
    }
  }
  return best?.card.anyPlayer?.slug ?? best?.card.slug ?? "";
}

const MODE_ORDER: Array<"safe" | "balanced" | "ceiling"> = [
  "safe",
  "balanced",
  "ceiling",
];

function modesForCount(count: LineupCount): Array<"safe" | "balanced" | "ceiling"> {
  if (count === 1) return ["balanced"];
  if (count === 2) return ["safe", "ceiling"];
  return MODE_ORDER;
}

export interface GenerateInput {
  entry: HotStreakEntry;
  cards: SorareCard[];
  settings: AiSuggestionsSettings;
  playerIntel: Record<string, PlayerIntel> | null;
}

export interface GenerateOutput {
  targetScore: number;
  rewardLabel: string;
  level: number;
  suggestions: SuggestedLineup[];
  warnings: string[];
}

export function generateSuggestions({
  entry,
  cards,
  settings,
  playerIntel,
}: GenerateInput): GenerateOutput | null {
  const target = resolveTarget(entry, settings.targetLevelOffset);

  // Build the starter-prob map from player intel (values are 0-100).
  const starterProbs: Record<string, number | null> = {};
  if (playerIntel) {
    for (const [slug, intel] of Object.entries(playerIntel)) {
      starterProbs[slug] = intel.starterProbability;
    }
  }

  const eligible = filterEligible(
    cards,
    entry.mainRarityType,
    entry.leagueName,
    settings.excludeDoubtful,
    starterProbs,
  );

  const warnings: string[] = [];
  if (eligible.length < 5) {
    warnings.push(
      `Only ${eligible.length} eligible cards for ${entry.leagueName} ${entry.mainRarityType}. Suggestions may be thin.`,
    );
  }

  const level = mapThresholdToLevel(target.score);
  const modes = modesForCount(settings.lineupCount);
  const suggestions: SuggestedLineup[] = [];

  for (const mode of modes) {
    const weights = RISK_PROFILE_WEIGHTS[mode];
    // `balanced` uses the level-keyed LEVEL_WEIGHTS via an undefined override;
    // the sentinel in RISK_PROFILE_WEIGHTS.balanced is only for the popover UI.
    const weightOverride = mode === "balanced" ? undefined : weights;
    const scored = scoreCardsWithStrategy(
      eligible,
      level,
      starterProbs,
      playerIntel,
      weightOverride,
    );
    const selected = pickFiveWithDiversity(scored);
    if (selected.length === 0) continue;

    const captainSlug = pickCaptain(selected);
    const { expectedTotal, successProbability } = estimateLineupProbability(
      selected,
      level,
    );

    suggestions.push({
      strategy: mode,
      cards: selected,
      captainSlug,
      expectedTotal,
      successProbability,
    });
  }

  return {
    targetScore: target.score,
    rewardLabel: target.rewardLabel,
    level: target.level,
    suggestions,
    warnings,
  };
}
