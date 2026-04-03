"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, X, Sparkles, ChevronDown, Loader2, Zap, Shield, Crosshair, LayoutGrid, List } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn, groupByKickoffWindow, getMergeWindowForLevel } from "@/lib/utils";
import { usePlayerIntel, useLiveScores, usePlayerForm } from "@/lib/hooks";
import { useLineupStore, STREAK_LEVELS, type PlayMode } from "@/lib/lineup-store";
import { scoreCards, scoreCardsWithStrategy, estimateTotalScore, recommendLineup, getStrategyMode } from "@/lib/ai-lineup";
import { LineupCard } from "./lineup-card";
import { GridCard } from "./grid-card";
import { StrategyPanel } from "./strategy-panel";
import { LiveTracker } from "./live-tracker";
import type { SorareCard, LineupPosition, StrategyMode, ScoredCardWithStrategy } from "@/lib/types";
import type { ScoredCard } from "@/lib/ai-lineup";

type SortOption = "score" | "power" | "match" | "soon";

const SLOT_TO_POSITION: Record<LineupPosition, string | null> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
  EX: null, // accepts any position
};

interface CardPickerProps {
  cards: SorareCard[];
}

const PLAY_MODE_CONFIG: Record<Exclude<PlayMode, "auto">, { label: string; icon: typeof Zap; color: string; bg: string }> = {
  fast: { label: "FAST", icon: Zap, color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
  balanced: { label: "BALANCED", icon: Crosshair, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  safe: { label: "SAFE", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
};

function getEffectiveMode(playMode: PlayMode, level: number): Exclude<PlayMode, "auto"> {
  if (playMode !== "auto") return playMode;
  if (level <= 2) return "fast";
  if (level <= 3) return "balanced";
  return "safe";
}

export function CardPicker({ cards }: CardPickerProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("score");
  const [aiBanner, setAiBanner] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState("cards");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const { slots, selectedSlotIndex, selectSlot, addCardToNextEmpty, autoFillWithStrategy, isAutoFilling, lineupProbability, currentLevel, targetScore, playMode, setPlayMode, mergeWindow, setMergeWindow } = useLineupStore();
  const effectiveMergeWindow = mergeWindow ?? getMergeWindowForLevel(currentLevel);
  const { isAnyGameLive } = useLiveScores();
  const playerFormData = usePlayerForm(cards);

  // Auto-switch to Live tab when games start
  useEffect(() => {
    if (isAnyGameLive && sidebarTab !== "live") {
      setSidebarTab("live");
    }
  }, [isAnyGameLive, sidebarTab]);

  const effectiveMode = getEffectiveMode(playMode, currentLevel);

  // When play mode changes, update sort default
  useEffect(() => {
    if (effectiveMode === "fast") {
      setSort("soon");
    } else {
      setSort("score");
    }
  }, [effectiveMode]);

  const handleAutoFill = useCallback(async (allCards: SorareCard[]) => {
    await autoFillWithStrategy(allCards);
    const state = useLineupStore.getState();
    const filledCount = state.slots.filter(s => s.card).length;
    const mode = getEffectiveMode(state.playMode, state.currentLevel);
    const modeLabel = mode === "fast" ? "Fast" : mode === "safe" ? "Safe" : "Balanced";
    setAiBanner(`AI placed ${filledCount} players (${modeLabel} strategy). Review and adjust as needed.`);
    setTimeout(() => setAiBanner(null), 4000);
  }, [autoFillWithStrategy]);

  const lineupSlugs = useMemo(
    () => new Set(slots.filter((s) => s.card).map((s) => s.card!.slug)),
    [slots]
  );

  // Determine position filter from selected slot
  const selectedSlotPosition = selectedSlotIndex !== null ? slots[selectedSlotIndex]?.position : null;
  const positionFilter = selectedSlotPosition ? SLOT_TO_POSITION[selectedSlotPosition] : null;

  // Shared player intel (starter %, fieldStatus, reliability) for all players
  const playerIntel = usePlayerIntel(cards);

  // Extract starter probs for strategy scoring backward compat
  const starterProbs = useMemo(() => {
    if (!playerIntel) return undefined;
    const map: Record<string, number | null> = {};
    for (const [slug, intel] of Object.entries(playerIntel)) {
      map[slug] = intel.starterProbability;
    }
    return map;
  }, [playerIntel]);

  const filteredCards = useMemo(() => {
    let result = cards;

    // Filter by position when a slot is selected (EX = outfield only, no GK)
    if (positionFilter) {
      result = result.filter(
        (c) => c.anyPlayer?.cardPositions?.[0] === positionFilter
      );
    } else if (selectedSlotPosition === "EX") {
      result = result.filter(
        (c) => c.anyPlayer?.cardPositions?.[0] !== "Goalkeeper"
      );
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.anyPlayer?.displayName?.toLowerCase().includes(q) ||
          c.anyPlayer?.activeClub?.name?.toLowerCase().includes(q) ||
          c.anyPlayer?.activeClub?.domesticLeague?.name?.toLowerCase().includes(q)
      );
    }

    // Strategy-aware scoring for "score" sort
    if (sort === "score") {
      return scoreCardsWithStrategy(result, currentLevel, starterProbs, playerIntel);
    }

    // "Playing Soon" sort
    if (sort === "soon") {
      const scored = scoreCardsWithStrategy(result, currentLevel, starterProbs, playerIntel);
      return scored.sort((a, b) => {
        const aDate = a.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
        const bDate = b.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    }

    const scored = scoreCards(result);

    switch (sort) {
      case "power":
        return scored.sort(
          (a, b) =>
            (parseFloat(b.card.power) || 1) - (parseFloat(a.card.power) || 1)
        );
      case "match":
        return scored.sort((a, b) => {
          const aHas = a.hasGame ? 1 : 0;
          const bHas = b.hasGame ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          return b.expectedPoints - a.expectedPoints;
        });
      default:
        return scored;
    }
  }, [cards, search, sort, positionFilter, currentLevel, starterProbs]);

  // Calculate AI suggestion score
  const aiSuggestionScore = useMemo(() => {
    const recommended = recommendLineup(cards);
    return Math.round(estimateTotalScore(recommended));
  }, [cards]);

  const emptySlots = slots.filter((s) => !s.card).length;

  // Group cards for "soon" sort
  const groupedCards = useMemo(() => {
    if (sort !== "soon") return null;
    return groupByKickoffWindow(filteredCards as ScoredCardWithStrategy[], effectiveMergeWindow);
  }, [filteredCards, sort, effectiveMergeWindow]);

  function getCardProps(sc: ScoredCard | ScoredCardWithStrategy) {
    const playerSlug = sc.card.anyPlayer?.slug;
    const intel = playerSlug && playerIntel ? playerIntel[playerSlug] : undefined;
    const form = playerSlug && playerFormData ? playerFormData[playerSlug] : undefined;
    return {
      card: sc.card,
      strategy: "strategy" in sc ? (sc as ScoredCardWithStrategy).strategy : undefined,
      starterProbability: intel?.starterProbability,
      playerIntel: intel,
      playerForm: form,
      disabled: lineupSlugs.has(sc.card.slug),
      onClick: () => {
        if (!lineupSlugs.has(sc.card.slug)) {
          addCardToNextEmpty(sc.card);
        }
      },
    };
  }

  function renderCard(sc: ScoredCard | ScoredCardWithStrategy) {
    const props = getCardProps(sc);
    if (viewMode === "grid") {
      return <GridCard key={sc.card.slug} {...props} />;
    }
    return <LineupCard key={sc.card.slug} {...props} />;
  }

  return (
    <Tabs.Root value={sidebarTab} onValueChange={setSidebarTab} className="flex flex-col h-full">
      {/* Tab bar */}
      <Tabs.List className="flex border-b border-zinc-800 shrink-0">
        <Tabs.Trigger
          value="cards"
          className="flex-1 py-2.5 text-xs font-semibold text-zinc-500 transition-colors data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
        >
          Cards
        </Tabs.Trigger>
        <Tabs.Trigger
          value="strategy"
          className="flex-1 py-2.5 text-xs font-semibold text-zinc-500 transition-colors data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-purple-500"
        >
          Strategy
        </Tabs.Trigger>
        <Tabs.Trigger
          value="live"
          className="flex-1 py-2.5 text-xs font-semibold text-zinc-500 transition-colors data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-green-500"
        >
          Live
          {isAnyGameLive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block ml-1.5" />}
        </Tabs.Trigger>
      </Tabs.List>

      {/* Cards Tab */}
      <Tabs.Content value="cards" className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search player, club, league..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort + AI */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 pl-3 pr-8 py-2 focus:outline-none focus:border-zinc-500"
              >
                <option value="score">Sort by Strategy Score</option>
                <option value="soon">Sort by Playing Soon</option>
                <option value="power">Sort by Power</option>
                <option value="match">Sort by Next Match</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            </div>

            <button
              onClick={() => handleAutoFill(cards)}
              disabled={emptySlots === 0 || isAutoFilling}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0",
                emptySlots > 0 && !isAutoFilling
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {isAutoFilling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isAutoFilling ? "Analyzing..." : "AI Suggest"}
            </button>

            {/* View toggle */}
            <div className="flex border border-zinc-700 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-2 transition-colors", viewMode === "grid" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-2 transition-colors", viewMode === "list" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Play Mode Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPlayMode("auto")}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold border transition-colors",
                playMode === "auto"
                  ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
              )}
            >
              AUTO
            </button>
            {(["fast", "balanced", "safe"] as const).map((m) => {
              const config = PLAY_MODE_CONFIG[m];
              const isActive = playMode === m || (playMode === "auto" && effectiveMode === m);
              const Icon = config.icon;
              return (
                <button
                  key={m}
                  onClick={() => setPlayMode(playMode === m ? "auto" : m)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold border transition-colors",
                    isActive
                      ? config.bg + " " + config.color
                      : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {config.label}
                </button>
              );
            })}
            {lineupProbability && (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold ml-auto",
                lineupProbability.confidenceLevel === "high"
                  ? "bg-green-500/15 border-green-500/30 text-green-400"
                  : lineupProbability.confidenceLevel === "medium"
                    ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400"
                    : "bg-red-500/15 border-red-500/30 text-red-400"
              )}>
                {Math.round(lineupProbability.successProbability * 100)}%
              </div>
            )}
          </div>

          {/* Merge Window Control */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 shrink-0">Window:</span>
            <input
              type="range"
              min={15}
              max={480}
              step={15}
              value={effectiveMergeWindow}
              onChange={(e) => setMergeWindow(Number(e.target.value))}
              className="flex-1 h-1 accent-purple-500 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:appearance-none"
            />
            <span className="text-[10px] font-bold text-zinc-300 w-12 text-right">
              {effectiveMergeWindow >= 60 ? `${(effectiveMergeWindow / 60).toFixed(1)}h` : `${effectiveMergeWindow}m`}
            </span>
            {mergeWindow !== null && (
              <button
                onClick={() => setMergeWindow(null)}
                className="text-[9px] text-zinc-500 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700"
              >
                Auto
              </button>
            )}
          </div>

          {/* Position filter indicator */}
          {selectedSlotPosition && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
                <span className="text-[11px] text-purple-300">
                  Showing: <span className="font-bold text-purple-200">{selectedSlotPosition === "EX" ? "Outfield players" : positionFilter + "s"}</span>
                </span>
              </div>
              <button
                onClick={() => selectSlot(null)}
                className="text-[11px] text-zinc-500 hover:text-white transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* AI Banner */}
          {aiSuggestionScore > 0 && emptySlots > 0 && (() => {
            const meetsTarget = aiSuggestionScore >= targetScore;
            const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
            return (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  meetsTarget
                    ? "bg-green-900/20 border-green-500/20"
                    : "bg-red-900/20 border-red-500/20"
                )}
              >
                <Sparkles
                  className={cn(
                    "w-4 h-4 shrink-0",
                    meetsTarget ? "text-green-400" : "text-red-400"
                  )}
                />
                <p className="text-[11px] text-zinc-300">
                  Level {currentLevel}: Need{" "}
                  <span className="font-bold text-white">{streakLevel?.threshold}</span> pts
                  {" -- AI estimates ~"}
                  <span
                    className={cn(
                      "font-bold",
                      meetsTarget ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {aiSuggestionScore}
                  </span>
                  {" pts"}
                  {!meetsTarget && (
                    <span className="text-red-400/70 ml-1">(risky, consider safer picks)</span>
                  )}
                </p>
              </div>
            );
          })()}
        </div>

        {/* AI Suggest Confirmation */}
        {aiBanner && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-purple-900/30 border border-purple-500/20">
            <p className="text-[11px] text-purple-300">{aiBanner}</p>
          </div>
        )}

        {/* Card List */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredCards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">
                {positionFilter ? `No ${positionFilter.toLowerCase()}s found` : "No cards found"}
              </p>
            </div>
          ) : groupedCards ? (
            // Grouped rendering for "soon" sort
            groupedCards.map((group, gi) => (
              <div key={gi}>
                <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm py-1.5 px-1 -mx-1 mb-2 border-b border-zinc-800">
                  <span className="text-[11px] font-semibold text-zinc-400">
                    {group.windowLabel}
                  </span>
                  <span className="text-[10px] text-zinc-600 ml-2">
                    {group.items.length} player{group.items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-4 xl:grid-cols-5 gap-2 mb-4"
                    : "space-y-2 mb-4"
                )}>
                  {group.items.map((sc) => renderCard(sc))}
                </div>
              </div>
            ))
          ) : (
            // Flat rendering for other sorts
            <div className={cn(
              viewMode === "grid"
                ? "grid grid-cols-4 xl:grid-cols-5 gap-2"
                : "space-y-2"
            )}>
              {filteredCards.map((sc) => renderCard(sc))}
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-500">
            {filteredCards.length} cards{positionFilter ? ` (${positionFilter}s)` : " available"}
          </p>
        </div>
      </Tabs.Content>

      {/* Strategy Tab */}
      <Tabs.Content value="strategy" className="flex-1 flex flex-col overflow-hidden">
        <StrategyPanel cards={cards} />
      </Tabs.Content>

      {/* Live Tab */}
      <Tabs.Content value="live" className="flex-1 flex flex-col overflow-hidden">
        <LiveTracker />
      </Tabs.Content>
    </Tabs.Root>
  );
}
