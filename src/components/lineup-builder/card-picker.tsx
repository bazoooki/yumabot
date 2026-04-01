"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { scoreCards, estimateTotalScore, recommendLineup } from "@/lib/ai-lineup";
import { LineupCard } from "./lineup-card";
import type { SorareCard, LineupPosition } from "@/lib/types";

type SortOption = "score" | "power" | "match";

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
  const [aiBanner, setAiBanner] = useState<string | null>(null);
  const { slots, selectedSlotIndex, selectSlot, addCardToNextEmpty, autoFill, currentLevel, targetScore } = useLineupStore();

  const handleAutoFill = useCallback((allCards: SorareCard[]) => {
    autoFill(allCards);
    const filledCount = useLineupStore.getState().slots.filter(s => s.card).length;
    setAiBanner(`AI placed ${filledCount} players on the pitch. Review and adjust as needed.`);
    setTimeout(() => setAiBanner(null), 2500);
  }, [autoFill]);

  const lineupSlugs = useMemo(
    () => new Set(slots.filter((s) => s.card).map((s) => s.card!.slug)),
    [slots]
  );

  // Determine position filter from selected slot
  const selectedSlotPosition = selectedSlotIndex !== null ? slots[selectedSlotIndex]?.position : null;
  const positionFilter = selectedSlotPosition ? SLOT_TO_POSITION[selectedSlotPosition] : null;

  const filteredCards = useMemo(() => {
    let result = cards;

    // Filter by position when a slot is selected (EX = show all)
    if (positionFilter) {
      result = result.filter(
        (c) => c.anyPlayer?.cardPositions?.[0] === positionFilter
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

    const scored = scoreCards(result);

    switch (sort) {
      case "score":
        return scored.sort((a, b) => b.expectedPoints - a.expectedPoints);
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
  }, [cards, search, sort, positionFilter]);

  // Calculate AI suggestion score
  const aiSuggestionScore = useMemo(() => {
    const recommended = recommendLineup(cards);
    return Math.round(estimateTotalScore(recommended));
  }, [cards]);

  const emptySlots = slots.filter((s) => !s.card).length;

  return (
    <div className="flex flex-col h-full">
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
              <option value="score">Sort by Average Score</option>
              <option value="power">Sort by Power</option>
              <option value="match">Sort by Next Match</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>

          <button
            onClick={() => handleAutoFill(cards)}
            disabled={emptySlots === 0}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0",
              emptySlots > 0
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Suggest
          </button>
        </div>

        {/* Position filter indicator */}
        {selectedSlotPosition && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
              <span className="text-[11px] text-purple-300">
                Showing: <span className="font-bold text-purple-200">{selectedSlotPosition === "EX" ? "All positions" : positionFilter + "s"}</span>
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
                {" — AI estimates ~"}
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
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-500">
              {positionFilter ? `No ${positionFilter.toLowerCase()}s found` : "No cards found"}
            </p>
          </div>
        ) : (
          filteredCards.map((sc) => (
            <LineupCard
              key={sc.card.slug}
              card={sc.card}
              disabled={lineupSlugs.has(sc.card.slug)}
              onClick={() => {
                if (!lineupSlugs.has(sc.card.slug)) {
                  addCardToNextEmpty(sc.card);
                }
              }}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-zinc-800">
        <p className="text-[11px] text-zinc-500">
          {filteredCards.length} cards{positionFilter ? ` (${positionFilter}s)` : " available"}
        </p>
      </div>
    </div>
  );
}
