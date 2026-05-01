"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  InSeasonCompetition,
  RarityType,
  SorareCard,
} from "@/lib/types";
import {
  useHotStreakEntries,
  type HotStreakEntry,
} from "./use-hot-streak-entries";
import { AISuggestionRow } from "./ai-suggestion-row";
import { SuggestionSettings } from "./suggestion-settings";
import { isCardEligibleFor } from "@/lib/in-season/eligibility";
import { nextTargetForEntry } from "@/lib/in-season/streak-target";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Trophy,
  Bot,
  Lock,
} from "lucide-react";

const RARITY_LABEL: Record<string, string> = {
  limited: "Limited",
  rare: "Rare",
  super_rare: "SR",
  unique: "Unique",
};
const RARITY_CLASS: Record<string, string> = {
  limited: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  rare: "bg-red-500/15 text-red-400 border-red-500/20",
  super_rare: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  unique: "bg-zinc-100/15 text-zinc-100 border-zinc-100/20",
};

const RARITY_TAB_ORDER: ReadonlyArray<RarityType> = [
  "limited",
  "rare",
  "super_rare",
  "unique",
];
const DEFAULT_SELECTED_RARITIES: ReadonlyArray<RarityType> = [
  "limited",
  "rare",
];

const MIN_ELIGIBLE_CARDS = 4;

interface AISuggestionsPanelProps {
  liveCompetitions: InSeasonCompetition[] | undefined;
  liveLoading: boolean;
  liveGameWeek: number | undefined;
  userSlug: string;
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
}

export function AISuggestionsPanel({
  liveCompetitions,
  liveLoading,
  liveGameWeek,
  userSlug,
  cards,
  onNavigate,
}: AISuggestionsPanelProps) {
  const { entries, gameWeek, loading } = useHotStreakEntries({
    liveCompetitions,
    liveLoading,
    liveGameWeek,
    userSlug,
  });

  const [selectedRarities, setSelectedRarities] = useState<Set<RarityType>>(
    () => new Set(DEFAULT_SELECTED_RARITIES),
  );

  // Per-rarity total of cards in the gallery — only the four streak-ladder
  // rarities matter for the tabs; commons / custom-series aren't part of
  // the in-season streak system.
  const cardsByRarity = useMemo(() => {
    const counts: Record<string, number> = {
      limited: 0,
      rare: 0,
      super_rare: 0,
      unique: 0,
    };
    for (const c of cards) {
      const r = c.rarityTyped;
      if (r in counts) counts[r]++;
    }
    return counts;
  }, [cards]);

  const visibleEntries = useMemo(
    () => entries.filter((e) => selectedRarities.has(e.mainRarityType)),
    [entries, selectedRarities],
  );

  const toggleRarity = (r: RarityType) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) {
        // Don't allow zero-selection — keep at least one tab on.
        if (next.size > 1) next.delete(r);
      } else {
        next.add(r);
      }
      return next;
    });
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-bold text-white">
          Next GW{gameWeek ? ` (${gameWeek})` : ""} AI Suggestions
        </h2>
        <span className="text-[10px] text-zinc-500">
          {visibleEntries.length}
          {visibleEntries.length !== entries.length && ` / ${entries.length}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <SuggestionSettings />
          <button
            onClick={() => onNavigate("in-season")}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
          >
            In Season <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Rarity tabs — multi-select. The card-count chip helps the user see
          at a glance which rarities they actually own (an empty rarity stays
          enabled so they can still inspect comps, but the count makes it
          obvious why everything is disabled in there). */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {RARITY_TAB_ORDER.map((r) => {
          const isOn = selectedRarities.has(r);
          const count = cardsByRarity[r];
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggleRarity(r)}
              className={cn(
                "mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all flex items-center gap-1.5",
                isOn
                  ? RARITY_CLASS[r]
                  : "bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700",
              )}
            >
              <span>{RARITY_LABEL[r]}</span>
              <span
                className={cn(
                  "tabular-nums text-[9px]",
                  isOn ? "opacity-80" : "opacity-50",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
        </div>
      ) : visibleEntries.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">
          {entries.length === 0
            ? "No competitions to suggest lineups for."
            : "No competitions match the selected rarities."}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleEntries.map((entry) => (
            <SuggestionRowShell
              key={entry.key}
              entry={entry}
              cards={cards}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRowShell({
  entry,
  cards,
  onNavigate,
}: {
  entry: HotStreakEntry;
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const rarity = entry.mainRarityType as RarityType;
  const rarityLabel = RARITY_LABEL[rarity] ?? rarity;
  const rarityClass =
    RARITY_CLASS[rarity] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";

  // Count cards the user could field for this comp+rarity. This drives the
  // disabled-state below — Sorare's in-season rule requires ≥4 in-season
  // cards in the lineup, so anything under that ceiling can't produce a
  // valid suggestion.
  const eligibleCount = useMemo(
    () =>
      cards.reduce((n, c) => {
        const ok = isCardEligibleFor(c, {
          mainRarityType: entry.mainRarityType,
          leagueName: entry.leagueName,
          seasonality: "IN_SEASON",
        });
        return ok ? n + 1 : n;
      }, 0),
    [cards, entry.mainRarityType, entry.leagueName],
  );

  const target = nextTargetForEntry(entry);
  const isEnabled = eligibleCount >= MIN_ELIGIBLE_CARDS;
  // Distinguish authoritative streak data (from LIVE) from the heuristic
  // floor — when we don't actually know the user's level, hint that the
  // displayed level is a fallback rather than implying it's their current
  // progression.
  const hasRealStreak =
    !!entry.streak && entry.streak.thresholds.length > 0;

  const handleToggle = () => {
    if (!isEnabled) return;
    setExpanded((v) => !v);
  };

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-opacity",
        isEnabled
          ? "bg-zinc-800/40 border-zinc-700/40"
          : "bg-zinc-900/40 border-zinc-800/60 opacity-70",
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={!isEnabled}
        className={cn(
          "w-full text-left px-3 py-2.5 transition-colors",
          isEnabled
            ? "hover:bg-zinc-800/60 cursor-pointer"
            : "cursor-not-allowed",
        )}
      >
        {/* Top line — competition identity + manager metrics. */}
        <div className="flex items-center gap-2">
          {entry.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.iconUrl}
              alt=""
              className="w-5 h-5 rounded shrink-0"
            />
          ) : (
            <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {entry.leagueName}
          </span>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0",
              rarityClass,
            )}
          >
            {rarityLabel}
          </span>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {!isEnabled ? (
              <Lock className="w-3.5 h-3.5 text-zinc-600" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400/60" />
            )}
            <ChevronDown
              className={cn(
                "w-4 h-4 text-zinc-500 transition-transform shrink-0",
                expanded && "rotate-180",
                !isEnabled && "opacity-40",
              )}
            />
          </div>
        </div>

        {/* Second line — manager metrics: level, target, reward, eligible
            card count. This is what the user wants visible without having
            to expand each row. */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                hasRealStreak
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "bg-zinc-800 text-zinc-400",
              )}
              title={
                hasRealStreak
                  ? "Your next streak target"
                  : "Heuristic — actual level not yet loaded"
              }
            >
              Lv.{target.level}
            </span>
            <span className="mono text-[10px] tabular-nums font-bold text-zinc-200">
              {target.score}
              <span className="text-zinc-500 font-normal"> pts</span>
            </span>
          </div>
          {/* Only surface cash rewards in the collapsed row — essence /
              coin / card rewards add visual noise without driving the
              manager's "ship this lineup or not" decision. The full
              reward breakdown still shows when the row is expanded. */}
          {/^\$/.test(target.reward) && (
            <span className="mono text-[10px] font-bold text-emerald-400">
              {target.reward}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {isEnabled ? (
              <span
                className="mono text-[9px] uppercase tracking-wider text-zinc-500"
                title="In-season eligible cards in your gallery"
              >
                {eligibleCount} eligible
              </span>
            ) : (
              <span className="mono text-[9px] uppercase tracking-wider text-amber-500/80">
                Need {MIN_ELIGIBLE_CARDS}+ ({eligibleCount} eligible)
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && isEnabled && (
        <AISuggestionRow
          entry={entry}
          cards={cards}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
