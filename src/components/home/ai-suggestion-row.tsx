"use client";

import { useMemo, useState } from "react";
import type { SorareCard } from "@/lib/types";
import { usePlayerIntel } from "@/lib/hooks";
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
import type { HotStreakEntry } from "./use-hot-streak-entries";
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
        }),
      ),
    [cards, entry.mainRarityType, entry.leagueName],
  );

  // Source intel directly from the React Query-backed hook so we don't
  // depend on whether another tab happened to populate the in-season store.
  const playerIntel = usePlayerIntel(eligibleCards) ?? null;
  const settings = useAiSuggestionsStore();

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
      }),
    [
      entry,
      cards,
      playerIntel,
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

      {suggestions.length === 0 ? (
        <p className="text-[11px] text-zinc-500 text-center py-4">
          Not enough eligible cards to build a lineup. Try disabling
          &quot;exclude doubtful&quot; in settings.
        </p>
      ) : (
        <>
          <StrategyTabStrip
            active={activeStrategy}
            available={availableStrategies}
            onChange={setSelectedStrategy}
          />

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
