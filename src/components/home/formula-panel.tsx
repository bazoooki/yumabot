"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Beaker,
  ChevronDown,
  RotateCcw,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  INGREDIENTS,
  INGREDIENT_HINT,
  INGREDIENT_LABEL,
  HISTORY_INGREDIENTS,
  PRESET_FORMULAS,
  formatFormula,
  isModified,
  needsHistory,
  presetFormula,
  type FormulaConfig,
  type FormulaPreset,
  type FormulaWeights,
  type Ingredient,
} from "@/lib/ai-suggestions/formula";

interface FormulaPanelProps {
  /** Currently applied formula — what's actually feeding the engine. */
  applied: FormulaConfig;
  /** Strategy mode the user originally clicked. Used as the reset target. */
  basePreset: FormulaPreset;
  /** Whether history-dependent data is currently being fetched. */
  historyLoading?: boolean;
  /** True when at least one history ingredient is on but data isn't yet ready. */
  historyMissing?: boolean;
  /** Called with the new formula when the user clicks Regenerate. */
  onApply: (next: FormulaConfig) => void;
  /** Called when the user resets to the base preset (also re-applies). */
  onReset: () => void;
}

const PRESET_LABEL: Record<FormulaPreset, string> = {
  safe: "Safe",
  balanced: "Balanced",
  ceiling: "Ceiling",
};

export function FormulaPanel({
  applied,
  basePreset,
  historyLoading,
  historyMissing,
  onApply,
  onReset,
}: FormulaPanelProps) {
  // Staged config — what the user is editing locally. Doesn't take effect
  // until they click Regenerate. Reset on `applied` change so external
  // re-applications (e.g. preset switch) flush local edits.
  const [staged, setStaged] = useState<FormulaConfig>(applied);
  const [tuneOpen, setTuneOpen] = useState(false);

  // When the upstream `applied` changes (preset switch from outside), wipe
  // local staging so the panel always shows the active formula by default.
  useEffect(() => {
    setStaged(applied);
  }, [applied]);

  const stagedDirty = useMemo(() => !weightsEqual(staged.weights, applied.weights), [staged, applied]);
  const stagedModified = isModified(staged);

  const setWeight = (k: Ingredient, w: number) => {
    setStaged((s) => ({
      basePreset: s.basePreset,
      weights: { ...s.weights, [k]: clamp01(w) },
    }));
  };

  const toggleIngredient = (k: Ingredient) => {
    setStaged((s) => {
      const cur = s.weights[k];
      if (cur > 1e-6) {
        // Disable: zero the weight.
        return { ...s, weights: { ...s.weights, [k]: 0 } };
      }
      // Enable: restore preset's value, or fall back to 0.20 if the preset
      // also has it at zero — gives the user a visible non-zero starting
      // point on toggle-on.
      const presetValue = PRESET_FORMULAS[s.basePreset][k];
      const next = presetValue > 1e-6 ? presetValue : 0.2;
      return { ...s, weights: { ...s.weights, [k]: next } };
    });
  };

  const apply = () => onApply(staged);
  const reset = () => {
    setStaged(presetFormula(basePreset));
    onReset();
  };

  const formulaText = formatFormula(staged.weights);
  const stagedNeedsHistory = needsHistory(staged.weights);

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Beaker className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300">
          Formula
        </span>
        {stagedModified ? (
          <span className="mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
            modified
          </span>
        ) : (
          <span className="mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">
            {PRESET_LABEL[staged.basePreset]} preset
          </span>
        )}
        <button
          type="button"
          onClick={reset}
          disabled={!stagedModified && !stagedDirty}
          className={cn(
            "ml-auto p-1 rounded transition-colors",
            stagedModified || stagedDirty
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              : "text-zinc-700 cursor-not-allowed",
          )}
          title={`Reset to ${PRESET_LABEL[basePreset]} preset`}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Ingredient chip toggles */}
      <div className="flex flex-wrap gap-1">
        {INGREDIENTS.map((k) => {
          const on = staged.weights[k] > 1e-6;
          const isHistory = HISTORY_INGREDIENTS.has(k);
          const showLoader = on && isHistory && historyLoading;
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleIngredient(k)}
              title={INGREDIENT_HINT[k]}
              className={cn(
                "mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1",
                on
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                  : "bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700",
              )}
            >
              {showLoader ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
              <span>{INGREDIENT_LABEL[k]}</span>
            </button>
          );
        })}
      </div>

      {/* Live formula readout */}
      <div className="mono text-[10px] text-zinc-400 leading-relaxed break-all">
        <span className="text-zinc-600">score = </span>
        <span className="text-zinc-200">{formulaText}</span>
      </div>

      {/* Tune disclosure */}
      <button
        type="button"
        onClick={() => setTuneOpen((v) => !v)}
        className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            tuneOpen && "rotate-180",
          )}
        />
        Tune weights
      </button>

      {tuneOpen && (
        <div className="space-y-1.5 pt-1 border-t border-zinc-800">
          {INGREDIENTS.map((k) => {
            const value = staged.weights[k];
            const enabled = value > 1e-6;
            return (
              <div key={k} className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] w-24 truncate",
                    enabled ? "text-zinc-300" : "text-zinc-600",
                  )}
                  title={INGREDIENT_HINT[k]}
                >
                  {INGREDIENT_LABEL[k]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={value}
                  onChange={(e) => setWeight(k, parseFloat(e.target.value))}
                  className="flex-1 accent-cyan-500"
                />
                <span
                  className={cn(
                    "mono text-[10px] tabular-nums w-9 text-right",
                    enabled ? "text-zinc-300" : "text-zinc-600",
                  )}
                >
                  {value.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply / Regenerate */}
      <div className="flex items-center gap-2 pt-1">
        {stagedNeedsHistory && historyMissing && (
          <span className="text-[10px] text-amber-400">
            Regenerate will fetch recent games
          </span>
        )}
        <button
          type="button"
          onClick={apply}
          disabled={!stagedDirty}
          className={cn(
            "ml-auto mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border flex items-center gap-1 transition-colors",
            stagedDirty
              ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
              : "bg-zinc-800/60 text-zinc-600 border-zinc-700/60 cursor-not-allowed",
          )}
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </button>
      </div>
    </div>
  );
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function weightsEqual(a: FormulaWeights, b: FormulaWeights): boolean {
  for (const k of INGREDIENTS) {
    if (Math.abs(a[k] - b[k]) > 1e-6) return false;
  }
  return true;
}
