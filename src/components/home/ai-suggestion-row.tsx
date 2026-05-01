"use client";

import { useMemo, useState } from "react";
import type { SorareCard } from "@/lib/types";
import { usePlayerHistory, usePlayerIntel } from "@/lib/hooks";
import { isCardEligibleFor } from "@/lib/in-season/eligibility";
import { useAiSuggestionsStore } from "@/lib/ai-suggestions-store";
import { generateSuggestions } from "@/lib/ai-suggestions/generate";
import { buildSuggestedCompetition } from "@/lib/in-season/build-suggested-competition";
import { LineupCard } from "@/components/lineup-card/lineup-card";
import { WinProbCard } from "@/components/ai/win-prob-card";
import {
  StrategyTabStrip,
  type StrategyMode,
} from "@/components/ai/strategy-tab-strip";
import {
  isModified,
  needsHistory,
  presetFormula,
  type FormulaConfig,
} from "@/lib/ai-suggestions/formula";
import { FormulaPanel } from "./formula-panel";
import type { HotStreakEntry } from "./use-hot-streak-entries";
import { AISuggestionLoader } from "./ai-suggestion-loader";
import { TrendingUp, AlertTriangle } from "lucide-react";

export function AISuggestionRow({
  entry,
  cards,
  onNavigate,
}: {
  entry: HotStreakEntry;
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
}) {
  // Pre-filter to cards eligible for THIS entry before asking for intel.
  // Without this, every expanded row asks Sorare for starter odds on the
  // user's entire gallery (often 700+ players) — which is what was bursting
  // through the per-account rate limit and 429-ing unrelated requests.
  const eligibleCards = useMemo(
    () =>
      cards.filter((c) =>
        isCardEligibleFor(c, {
          mainRarityType: entry.mainRarityType,
          leagueName: entry.leagueName,
          seasonality: "IN_SEASON",
          so5LeaderboardType: entry.so5LeaderboardType,
        }),
      ),
    [cards, entry.mainRarityType, entry.leagueName, entry.so5LeaderboardType],
  );

  // Source intel directly from the React Query-backed hook so we don't
  // depend on whether another tab happened to populate the in-season store.
  const playerIntelData = usePlayerIntel(eligibleCards);
  const playerIntel = playerIntelData ?? null;
  // We're "waiting on intel" only when there are eligible cards to fetch
  // intel for and the hook hasn't returned yet. Otherwise (no eligible
  // cards, or intel loaded), the row should render its real result.
  const isIntelLoading =
    eligibleCards.length > 0 && playerIntelData === undefined;
  const settings = useAiSuggestionsStore();

  // Formula override — staged by the FormulaPanel, applied here. `null`
  // means "use preset risk-profile weights" (current behavior). Local row
  // state for now; persistence is deferred (see earlier discussion on
  // caching/persistence layer).
  const [appliedFormula, setAppliedFormula] = useState<FormulaConfig | null>(
    null,
  );

  // Lazy-fetch raw player history when an applied formula needs it. Only
  // gets enabled once the user explicitly clicks Regenerate with a
  // history-dependent ingredient on — never speculatively.
  const historyEnabled =
    !!appliedFormula && needsHistory(appliedFormula.weights);
  const playerHistoryData = usePlayerHistory(eligibleCards, historyEnabled);
  const playerHistory = playerHistoryData ?? null;
  const isHistoryLoading =
    historyEnabled && eligibleCards.length > 0 && playerHistoryData === undefined;

  const result = useMemo(
    () =>
      generateSuggestions({
        entry,
        cards,
        settings: {
          targetLevelOffset: settings.targetLevelOffset,
          lineupCount: settings.lineupCount,
          excludeDoubtful: settings.excludeDoubtful,
          showClaudeTake: settings.showClaudeTake,
        },
        playerIntel,
        playerHistory,
        formulaOverride: appliedFormula?.weights ?? null,
      }),
    [
      entry,
      cards,
      playerIntel,
      playerHistory,
      appliedFormula,
      settings.targetLevelOffset,
      settings.lineupCount,
      settings.excludeDoubtful,
      settings.showClaudeTake,
    ],
  );

  const synthetic = useMemo(
    () =>
      buildSuggestedCompetition({
        leagueName: entry.leagueName,
        mainRarityType: entry.mainRarityType,
        iconUrl: entry.iconUrl,
        targetScore: result?.targetScore ?? 0,
        suggestions: result?.suggestions ?? [],
        playerIntel,
      }),
    [
      entry.leagueName,
      entry.mainRarityType,
      entry.iconUrl,
      result?.targetScore,
      result?.suggestions,
      playerIntel,
    ],
  );

  const suggestionByStrategy = useMemo(() => {
    const map: Partial<Record<StrategyMode, { sug: NonNullable<typeof result>["suggestions"][number]; idx: number }>> = {};
    result?.suggestions.forEach((s, idx) => {
      map[s.strategy] = { sug: s, idx };
    });
    return map;
  }, [result?.suggestions]);

  const availableStrategies = useMemo(
    () => (Object.keys(suggestionByStrategy) as StrategyMode[]),
    [suggestionByStrategy],
  );

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyMode>("balanced");
  const activeStrategy: StrategyMode | null =
    suggestionByStrategy[selectedStrategy]
      ? selectedStrategy
      : availableStrategies[0] ?? null;

  // Intel still in flight — show the lively loader instead of a half-baked
  // lineup. Without this guard, the row would render with null starter
  // probabilities (so `excludeDoubtful` is a no-op and captain selection
  // ignores reliability) and then snap to a different lineup once the
  // requests come back, which felt broken.
  if (isIntelLoading) {
    return <AISuggestionLoader eligibleCards={eligibleCards} />;
  }

  if (!result) {
    return (
      <div className="border-t border-zinc-700/40 bg-zinc-900/40 px-3 py-4 text-center">
        <p className="text-[11px] text-zinc-500">
          No streak data yet — can&apos;t compute a target.
        </p>
      </div>
    );
  }

  const { targetScore, rewardLabel, level, suggestions, warnings } = result;
  const activeEntry = activeStrategy ? suggestionByStrategy[activeStrategy] : null;

  return (
    <div className="border-t border-zinc-700/40 bg-zinc-900/40 px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <span>
          Target:{" "}
          <span className="text-zinc-200 font-semibold tabular-nums">
            Lv.{level} · {targetScore}
          </span>{" "}
          <span className="text-green-400 font-bold">{rewardLabel}</span>
        </span>
      </div>

      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 text-[10px] text-amber-400"
        >
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}

      <FormulaPanel
        applied={appliedFormula ?? presetFormula(selectedStrategy)}
        basePreset={selectedStrategy}
        historyLoading={isHistoryLoading}
        historyMissing={historyEnabled && !playerHistory}
        onApply={(next) => {
          // Snap to preset means clear the override (lets the strategy
          // tabs reactivate); otherwise persist the custom config.
          setAppliedFormula(isModified(next) ? next : null);
        }}
        onReset={() => setAppliedFormula(null)}
      />

      {suggestions.length === 0 ? (
        <p className="text-[11px] text-zinc-500 text-center py-4">
          Not enough eligible cards to build a lineup. Try disabling
          &quot;exclude doubtful&quot; in settings.
        </p>
      ) : (
        <>
          {/* Strategy strip is hidden when a custom formula is applied —
              all three preset modes would collapse to the same lineup, so
              the tabs stop encoding meaningful choices. The formula panel
              IS the strategy in that mode. */}
          {!appliedFormula && (
            <StrategyTabStrip
              active={activeStrategy}
              available={availableStrategies}
              onChange={setSelectedStrategy}
            />
          )}

          {/* Big stats card */}
          {activeEntry && activeStrategy && (
            <WinProbCard
              expected={activeEntry.sug.expectedTotal}
              successProbability={activeEntry.sug.successProbability}
              variant={activeStrategy}
              action={{
                label: "Build",
                icon: <TrendingUp className="w-3 h-3" />,
                onClick: () => onNavigate("in-season"),
              }}
            />
          )}

          {/* Selected strategy lineup */}
          {activeEntry && (
            <LineupCard
              competition={synthetic}
              teamIndex={activeEntry.idx}
              variant="compact"
            />
          )}
        </>
      )}
    </div>
  );
}
