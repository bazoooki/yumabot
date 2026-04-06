"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown, LayoutGrid, List } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn, groupByKickoffWindow, getMergeWindowForLevel } from "@/lib/utils";
import { usePlayerIntel, useLiveScores, usePlayerForm } from "@/lib/hooks";
import { useLineupStore } from "@/lib/lineup-store";
import { scoreCards, scoreCardsWithStrategy } from "@/lib/ai-lineup";
import { LineupCard } from "./lineup-card";
import { GridCard } from "./grid-card";
import { StrategyPanel } from "./strategy-panel";
import { LiveTracker } from "./live-tracker";
import { CommandBar } from "@/components/command-bar/command-bar";
import type { SorareCard, RarityType, LineupPosition, ScoredCardWithStrategy } from "@/lib/types";
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


export function CardPicker({ cards }: CardPickerProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("score");
  const [rarityFilter, setRarityFilter] = useState<RarityType>("common");
  const [sidebarTab, setSidebarTab] = useState("cards");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const { slots, selectedSlotIndex, selectSlot, addCardToNextEmpty, currentLevel, mergeWindow } = useLineupStore();
  const effectiveMergeWindow = mergeWindow ?? getMergeWindowForLevel(currentLevel);
  const { isAnyGameLive } = useLiveScores();
  const playerFormData = usePlayerForm(cards);

  // Auto-switch to Live tab when games start
  useEffect(() => {
    if (isAnyGameLive && sidebarTab !== "live") {
      setSidebarTab("live");
    }
  }, [isAnyGameLive, sidebarTab]);

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

  // Cards filtered by rarity (used for display)
  // "common" filter = Stellar edition only (cardEditionName contains "stellar")
  const rarityCards = useMemo(
    () =>
      cards.filter((c) => {
        if (rarityFilter === "common") {
          return (
            c.rarityTyped === "common" &&
            (c.cardEditionName || "").toLowerCase().includes("stellar")
          );
        }
        return c.rarityTyped === rarityFilter;
      }),
    [cards, rarityFilter],
  );

  const filteredCards = useMemo(() => {
    let result = rarityCards;

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
  }, [rarityCards, search, sort, positionFilter, currentLevel, starterProbs]);

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
        {/* AI Command Bar (hero section) */}
        <div className="shrink-0">
          <CommandBar activeTab="lineup" cards={cards} />
        </div>

        {/* Card Filters */}
        <div className="px-4 py-3 border-b border-zinc-800 space-y-2.5 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search player, club, league..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
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

          {/* Rarity + Sort + View in one row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { value: "common", label: "Stellar", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", enabled: true },
                  { value: "limited", label: "Limited", color: "text-amber-500", bg: "bg-amber-500/15 border-amber-500/30", enabled: false },
                  { value: "rare", label: "Rare", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", enabled: false },
                  { value: "super_rare", label: "SR", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", enabled: false },
                  { value: "unique", label: "Unique", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30", enabled: false },
                ] as const
              ).map((r) => (
                <button
                  key={r.value}
                  onClick={() => r.enabled && setRarityFilter(r.value)}
                  disabled={!r.enabled}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold border transition-colors",
                    !r.enabled
                      ? "border-zinc-800 text-zinc-700 cursor-not-allowed"
                      : rarityFilter === r.value
                        ? `${r.bg} ${r.color}`
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-zinc-500"
              >
                <option value="score">Strategy Score</option>
                <option value="soon">Playing Soon</option>
                <option value="power">Power</option>
                <option value="match">Next Match</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex border border-zinc-700 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Position filter indicator */}
          {selectedSlotPosition && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30">
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
        </div>

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
        <div className="px-4 py-2 border-t border-zinc-800 shrink-0">
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
