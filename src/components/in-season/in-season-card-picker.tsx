"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerIntel } from "@/lib/hooks";
import { useInSeasonStore, useSelectedCompetition, useEligibleCards } from "@/lib/in-season-store";
import { scoreCardsWithStrategy } from "@/lib/ai-lineup";
import { GridCard } from "@/components/lineup-builder/grid-card";
import { SLOT_TO_POSITION } from "@/lib/normalization";
import type { SorareCard, ScoredCardWithStrategy } from "@/lib/types";

type SortOption = "score" | "soon" | "power";

export function InSeasonCardPicker({ cards }: { cards: SorareCard[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("score");

  const comp = useSelectedCompetition();
  const slots = useInSeasonStore((s) => s.slots);
  const selectedSlotIndex = useInSeasonStore((s) => s.selectedSlotIndex);
  const addCard = useInSeasonStore((s) => s.addCard);
  const selectSlot = useInSeasonStore((s) => s.selectSlot);
  const setCachedPlayerIntel = useInSeasonStore((s) => s.setCachedPlayerIntel);
  const targetThreshold = useInSeasonStore((s) => s.targetThreshold);

  const eligibleCards = useEligibleCards(cards);
  const playerIntel = usePlayerIntel(eligibleCards);

  // Cache player intel for AI tools
  useEffect(() => {
    if (playerIntel) setCachedPlayerIntel(playerIntel);
  }, [playerIntel, setCachedPlayerIntel]);

  const starterProbs = useMemo(() => {
    if (!playerIntel) return undefined;
    const map: Record<string, number | null> = {};
    for (const [slug, intel] of Object.entries(playerIntel)) {
      map[slug] = intel.starterProbability;
    }
    return map;
  }, [playerIntel]);

  // Cards already in lineup (disable in picker)
  const lineupSlugs = useMemo(
    () => new Set(slots.filter((s) => s.card).map((s) => s.card!.slug)),
    [slots],
  );

  // Position filter from selected slot
  const selectedSlotPosition = selectedSlotIndex !== null ? slots[selectedSlotIndex]?.position : null;
  const positionFilter = selectedSlotPosition ? SLOT_TO_POSITION[selectedSlotPosition] : null;

  // Map threshold to strategy level (1-6)
  const strategyLevel = useMemo(() => {
    const score = targetThreshold?.score ?? 360;
    if (score <= 340) return 1;
    if (score <= 360) return 2;
    if (score <= 380) return 3;
    if (score <= 400) return 4;
    if (score <= 440) return 5;
    return 6;
  }, [targetThreshold]);

  const filteredCards = useMemo(() => {
    let result = eligibleCards;

    // Filter by position when a slot is selected
    if (positionFilter) {
      result = result.filter(
        (c) => c.anyPlayer?.cardPositions?.[0] === positionFilter,
      );
    } else if (selectedSlotPosition === "EX") {
      result = result.filter(
        (c) => c.anyPlayer?.cardPositions?.[0] !== "Goalkeeper",
      );
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.anyPlayer?.displayName?.toLowerCase().includes(q) ||
          c.anyPlayer?.activeClub?.name?.toLowerCase().includes(q),
      );
    }

    const scored = scoreCardsWithStrategy(result, strategyLevel, starterProbs, playerIntel);

    if (sort === "soon") {
      return scored.sort((a, b) => {
        const aDate = a.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
        const bDate = b.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
    }

    if (sort === "power") {
      return scored.sort(
        (a, b) =>
          (parseFloat(b.card.power) || 1) - (parseFloat(a.card.power) || 1),
      );
    }

    // Default "score" sort — already sorted by strategyScore
    return scored;
  }, [eligibleCards, search, sort, positionFilter, selectedSlotPosition, strategyLevel, starterProbs, playerIntel]);

  function handleCardClick(card: SorareCard) {
    if (lineupSlugs.has(card.slug)) return;

    if (selectedSlotIndex !== null && !slots[selectedSlotIndex].card) {
      addCard(selectedSlotIndex, card);
    } else {
      // Find next empty slot
      const emptyIdx = slots.findIndex((s) => !s.card);
      if (emptyIdx !== -1) {
        addCard(emptyIdx, card);
      }
    }
  }

  if (!comp) return null;

  return (
    <div className="flex flex-col h-full border-l border-zinc-800">
      {/* Filters */}
      <div className="px-3 py-2.5 border-b border-zinc-800 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* In-season badge */}
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
            {comp.mainRarityType.replace("_", " ").toUpperCase()}
          </span>

          <div className="relative flex-1 min-w-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300 pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-zinc-500"
            >
              <option value="score">Strategy Score</option>
              <option value="soon">Playing Soon</option>
              <option value="power">Power</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search player, club..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-7 py-1.5 bg-zinc-800/50 border border-zinc-700 rounded-lg text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredCards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-zinc-500">
              {search ? "No matching cards" : "No eligible cards"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-1.5">
            {filteredCards.map((sc: ScoredCardWithStrategy) => {
              const playerSlug = sc.card.anyPlayer?.slug;
              const intel = playerSlug && playerIntel ? playerIntel[playerSlug] : undefined;
              const isInSeason = sc.card.inSeasonEligible;

              return (
                <div key={sc.card.slug} className="relative">
                  <GridCard
                    card={sc.card}
                    strategy={sc.strategy}
                    starterProbability={intel?.starterProbability}
                    playerIntel={intel}
                    disabled={lineupSlugs.has(sc.card.slug)}
                    onClick={() => handleCardClick(sc.card)}
                  />
                  {/* In-season badge */}
                  {isInSeason && (
                    <span className="absolute bottom-[42px] left-1 text-[7px] font-bold bg-green-600 text-white px-1 rounded z-10">
                      IS
                    </span>
                  )}
                  {!isInSeason && (
                    <span className="absolute bottom-[42px] left-1 text-[7px] font-bold bg-yellow-600 text-white px-1 rounded z-10">
                      !IS
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800 shrink-0">
        <p className="text-[10px] text-zinc-500">
          {filteredCards.length} eligible
          {positionFilter ? ` ${positionFilter.toLowerCase()}s` : ""}
        </p>
      </div>
    </div>
  );
}
