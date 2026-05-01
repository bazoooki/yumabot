import {
  estimateLineupProbability,
  mapThresholdToLevel,
  RISK_PROFILE_WEIGHTS,
  scoreCardsWithStrategy,
  type StrategyWeights,
} from "@/lib/ai-lineup";
import { isCardEligibleFor } from "@/lib/in-season/eligibility";
import { pickInSeasonLineup } from "@/lib/in-season/lineup-picker";
import { nextTargetForEntry } from "@/lib/in-season/streak-target";
import type {
  PlayerGameScore,
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
import type { FormulaWeights } from "@/lib/ai-suggestions/formula";

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
  so5LeaderboardType: string | null,
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
        so5LeaderboardType,
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
  /**
   * Optional per-row history (slug → recent games). When provided, fed
   * through to `scoreCardsWithStrategy` so floor/ceiling/consistency/
   * minutesDepth/setPieceBonus reflect real history.
   */
  playerHistory?: Record<string, PlayerGameScore[]> | null;
  /**
   * Custom weight bundle from the formula panel. When set, replaces the
   * preset RISK_PROFILE_WEIGHTS for ALL strategy modes — the row collapses
   * to a single lineup since safe/balanced/ceiling tabs no longer encode
   * different weights. The caller should hide the strategy strip in this
   * case.
   */
  formulaOverride?: FormulaWeights | null;
}

export interface GenerateOutput {
  targetScore: number;
  rewardLabel: string;
  level: number;
  suggestions: SuggestedLineup[];
  warnings: string[];
}

function toStrategyWeights(w: FormulaWeights): StrategyWeights {
  return {
    expectedScore: w.expectedScore,
    floor: w.floor,
    ceiling: w.ceiling,
    consistency: w.consistency,
    startProb: w.startProb,
    minutesDepth: w.minutesDepth,
    setPieceTaker: w.setPieceTaker,
  };
}

export function generateSuggestions({
  entry,
  cards,
  settings,
  playerIntel,
  playerHistory,
  formulaOverride,
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
    entry.so5LeaderboardType,
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
  // When the user has a custom formula, all three strategy presets would
  // collapse to the same lineup — render a single "balanced" suggestion
  // instead of three identical tabs.
  const modes = formulaOverride
    ? (["balanced"] as Array<"safe" | "balanced" | "ceiling">)
    : modesForCount(settings.lineupCount);
  const suggestions: SuggestedLineup[] = [];

  for (const mode of modes) {
    let weightOverride: StrategyWeights | undefined;
    if (formulaOverride) {
      weightOverride = toStrategyWeights(formulaOverride);
    } else if (mode !== "balanced") {
      // `balanced` falls back to the level-keyed LEVEL_WEIGHTS via undefined;
      // safe/ceiling use their RISK_PROFILE_WEIGHTS bundle.
      weightOverride = RISK_PROFILE_WEIGHTS[mode];
    }
    const scored = scoreCardsWithStrategy(
      eligible,
      level,
      starterProbs,
      playerIntel,
      weightOverride,
      playerHistory ?? null,
    );
    const selected = pickInSeasonLineup(scored);
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
