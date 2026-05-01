/**
 * AI suggestion formula config — exposed as a per-row control panel.
 *
 * Each ingredient maps to one term in `computeStrategyScore`. Weights are 0-1
 * and are NOT auto-normalized — the user controls the relative magnitude
 * directly. Disabling an ingredient sets its weight to zero (we keep the last
 * non-zero weight in `lastWeights` so re-enabling restores the previous value).
 */

// Strategy modes here match the AI Suggestions panel keys
// ("safe" | "balanced" | "ceiling"), which is what `RISK_PROFILE_WEIGHTS`
// and the strategy tab strip use. (The legacy `types.ts::FormulaPreset` uses
// "floor" instead of "safe" for historical reasons — don't pull from there.)
export type FormulaPreset = "safe" | "balanced" | "ceiling";

export type Ingredient =
  | "expectedScore"
  | "floor"
  | "ceiling"
  | "consistency"
  | "startProb"
  | "minutesDepth"
  | "setPieceTaker";

export const INGREDIENTS: Ingredient[] = [
  "expectedScore",
  "floor",
  "ceiling",
  "consistency",
  "startProb",
  "minutesDepth",
  "setPieceTaker",
];

export const INGREDIENT_LABEL: Record<Ingredient, string> = {
  expectedScore: "Expected",
  floor: "Floor",
  ceiling: "Ceiling",
  consistency: "Consistency",
  startProb: "Starter prob.",
  minutesDepth: "Minutes depth",
  setPieceTaker: "Set-pieces",
};

export const INGREDIENT_HINT: Record<Ingredient, string> = {
  expectedScore: "avg × power × edition × home × grade × startProb",
  floor: "p5 of recent scores — downside protection",
  ceiling: "p95 of recent scores — upside potential",
  consistency: "100 − cv% (lower variance = higher score)",
  startProb: "Sorare's odds the player starts the upcoming game",
  minutesDepth: "Avg minutes played / 90 — full-90 starters score higher",
  setPieceTaker: "Boost when the player regularly takes set-pieces / penalties",
};

/** Ingredients that need score history to compute. */
export const HISTORY_INGREDIENTS: ReadonlySet<Ingredient> = new Set<Ingredient>([
  "floor",
  "ceiling",
  "consistency",
  "minutesDepth",
  "setPieceTaker",
]);

export type FormulaWeights = Record<Ingredient, number>;

export interface FormulaConfig {
  /** Which strategy preset this formula was last reset to. */
  basePreset: FormulaPreset;
  /** Active weights — what actually feeds the scoring engine. */
  weights: FormulaWeights;
}

/**
 * Risk-profile presets. These are the same numbers as
 * `RISK_PROFILE_WEIGHTS` in `ai-lineup.ts`, plus zero-defaults for the new
 * ingredients so existing behavior is preserved when no user touches the
 * panel. Tweak `minutesDepth` / `setPieceTaker` here to give them a sensible
 * non-zero starting weight per preset.
 */
export const PRESET_FORMULAS: Record<FormulaPreset, FormulaWeights> = {
  safe: {
    expectedScore: 0.05,
    floor: 0.30,
    ceiling: 0.00,
    consistency: 0.15,
    startProb: 0.50,
    minutesDepth: 0.10,
    setPieceTaker: 0.00,
  },
  balanced: {
    expectedScore: 0.35,
    floor: 0.15,
    ceiling: 0.15,
    consistency: 0.15,
    startProb: 0.20,
    minutesDepth: 0.05,
    setPieceTaker: 0.05,
  },
  ceiling: {
    expectedScore: 0.30,
    floor: 0.05,
    ceiling: 0.50,
    consistency: 0.00,
    startProb: 0.15,
    minutesDepth: 0.00,
    setPieceTaker: 0.15,
  },
};

export function presetFormula(preset: FormulaPreset): FormulaConfig {
  return {
    basePreset: preset,
    weights: { ...PRESET_FORMULAS[preset] },
  };
}

export function isModified(config: FormulaConfig): boolean {
  const preset = PRESET_FORMULAS[config.basePreset];
  return INGREDIENTS.some((k) => Math.abs(config.weights[k] - preset[k]) > 1e-6);
}

/** True when at least one history-dependent ingredient has non-zero weight. */
export function needsHistory(weights: FormulaWeights): boolean {
  for (const k of HISTORY_INGREDIENTS) {
    if (weights[k] > 1e-6) return true;
  }
  return false;
}

/**
 * Render the live formula as a one-liner. Skips zero-weighted terms.
 * Format: `0.35·expected + 0.20·startProb + 0.15·form`.
 */
export function formatFormula(weights: FormulaWeights): string {
  const SHORT: Record<Ingredient, string> = {
    expectedScore: "expected",
    floor: "floor",
    ceiling: "ceiling",
    consistency: "consistency",
    startProb: "startProb",
    minutesDepth: "minutes",
    setPieceTaker: "setPiece",
  };
  const parts: string[] = [];
  for (const k of INGREDIENTS) {
    const w = weights[k];
    if (w <= 1e-6) continue;
    parts.push(`${w.toFixed(2)}·${SHORT[k]}`);
  }
  return parts.length === 0 ? "—" : parts.join(" + ");
}
