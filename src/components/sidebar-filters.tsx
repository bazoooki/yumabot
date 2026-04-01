"use client";

import { Search, X } from "lucide-react";
import { useFilterStore } from "@/lib/store";
import {
  RARITY_CONFIG,
  type SorareCard,
  type FacetCounts,
  type GalleryFilters,
  type Position,
  type RarityType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface SidebarFiltersProps {
  cards: SorareCard[];
  filteredCount: number;
}

function getLeagueName(card: SorareCard): string {
  return card.anyPlayer?.activeClub?.domesticLeague?.name || "Unknown";
}

function getPositionLabel(card: SorareCard): string {
  return card.anyPlayer?.cardPositions?.[0] || "Unknown";
}

function getTier(card: SorareCard): number {
  if (!card.grade && card.grade !== 0) return 1;
  return Math.min(5, Math.max(1, Math.ceil(card.grade / 20)));
}

export function computeFacets(cards: SorareCard[]): FacetCounts {
  const facets: FacetCounts = {
    rarities: {},
    tournaments: {},
    positions: {},
    tiers: {},
    cardSets: {},
  };

  for (const card of cards) {
    const r = card.rarityTyped || "common";
    facets.rarities[r] = (facets.rarities[r] || 0) + 1;

    const league = getLeagueName(card);
    if (league !== "Unknown") {
      facets.tournaments[league] = (facets.tournaments[league] || 0) + 1;
    }

    const pos = getPositionLabel(card);
    if (pos !== "Unknown") {
      facets.positions[pos] = (facets.positions[pos] || 0) + 1;
    }

    const tier = getTier(card);
    facets.tiers[tier] = (facets.tiers[tier] || 0) + 1;
  }

  return facets;
}

export function applyFilters(
  cards: SorareCard[],
  filters: GalleryFilters
): SorareCard[] {
  let result = cards;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.anyPlayer?.displayName?.toLowerCase().includes(q) ||
        c.anyPlayer?.activeClub?.name?.toLowerCase().includes(q)
    );
  }

  if (filters.rarity) {
    result = result.filter((c) => c.rarityTyped === filters.rarity);
  }

  if (filters.tournaments.length > 0) {
    result = result.filter((c) =>
      filters.tournaments.includes(getLeagueName(c))
    );
  }

  if (filters.positions.length > 0) {
    result = result.filter((c) =>
      filters.positions.includes(getPositionLabel(c) as Position)
    );
  }

  if (filters.tiers.length > 0) {
    result = result.filter((c) => filters.tiers.includes(getTier(c)));
  }

  if (filters.duplicatesOnly) {
    const playerCount: Record<string, number> = {};
    for (const c of cards) {
      const name = c.anyPlayer?.slug || c.slug;
      playerCount[name] = (playerCount[name] || 0) + 1;
    }
    result = result.filter(
      (c) => (playerCount[c.anyPlayer?.slug || c.slug] || 0) > 1
    );
  }

  return result;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export function SidebarFilters({ cards, filteredCount }: SidebarFiltersProps) {
  const { filters, setSearch, setRarity, toggleTournament, togglePosition, toggleTier, setDuplicatesOnly, clearAll } =
    useFilterStore();

  const facets = useMemo(() => computeFacets(cards), [cards]);

  const sortedTournaments = useMemo(
    () =>
      Object.entries(facets.tournaments)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8),
    [facets.tournaments]
  );

  const sortedPositions = useMemo(
    () =>
      ["Goalkeeper", "Defender", "Midfielder", "Forward"].map((p) => ({
        name: p,
        count: facets.positions[p] || 0,
      })),
    [facets.positions]
  );

  const hasActiveFilters =
    filters.search ||
    filters.rarity ||
    filters.tournaments.length > 0 ||
    filters.positions.length > 0 ||
    filters.tiers.length > 0 ||
    filters.duplicatesOnly;

  return (
    <aside className="w-[280px] shrink-0 border-r border-zinc-800 overflow-y-auto h-full">
      <div className="p-4 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by player or team"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Result count */}
        <p className="text-sm text-zinc-400">
          {filteredCount} results
        </p>

        {/* Stellar badge */}
        <div className="px-3 py-2 rounded-lg border bg-purple-900/40 border-purple-500/40 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
            Stellar Nights
          </span>
        </div>

        {/* Rarity Summary */}
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(RARITY_CONFIG).map(([key, config]) => {
            const count = facets.rarities[key] || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setRarity(key as RarityType)}
                className={cn(
                  "flex items-center gap-1.5 text-sm transition-opacity",
                  filters.rarity && filters.rarity !== key
                    ? "opacity-40"
                    : "opacity-100"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full", config.dotColor)} />
                <span className="text-white font-semibold">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Duplicate Toggle */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-zinc-700 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
                <rect x="2" y="6" width="13" height="13" rx="2" />
                <rect x="9" y="2" width="13" height="13" rx="2" />
              </svg>
            </div>
            <span className="text-sm text-zinc-300">Duplicate</span>
          </div>
          <button
            onClick={() => setDuplicatesOnly(!filters.duplicatesOnly)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              filters.duplicatesOnly ? "bg-purple-500" : "bg-zinc-700"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                filters.duplicatesOnly ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {/* Tournament */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Tournament
          </h3>
          <div className="space-y-1">
            {sortedTournaments.map(([name, count]) => (
              <label
                key={name}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-800/50 cursor-pointer group"
              >
                <input type="checkbox" checked={filters.tournaments.includes(name)} onChange={() => toggleTournament(name)} className="sr-only" />
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  filters.tournaments.includes(name) ? "bg-purple-500 border-purple-500" : "border-zinc-600 group-hover:border-zinc-400"
                )}>
                  {filters.tournaments.includes(name) && <CheckIcon />}
                </div>
                <span className="text-sm text-zinc-300 flex-1 truncate">{name}</span>
                <span className="text-xs text-zinc-500">{count}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Position */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Position
          </h3>
          <div className="space-y-1">
            {sortedPositions.map(({ name, count }) => (
              <label
                key={name}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-800/50 cursor-pointer group"
              >
                <input type="checkbox" checked={filters.positions.includes(name as Position)} onChange={() => togglePosition(name as Position)} className="sr-only" />
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  filters.positions.includes(name as Position) ? "bg-purple-500 border-purple-500" : "border-zinc-600 group-hover:border-zinc-400"
                )}>
                  {filters.positions.includes(name as Position) && <CheckIcon />}
                </div>
                <span className="text-sm text-zinc-300 flex-1">{name}</span>
                <span className="text-xs text-zinc-500">{count}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Tier */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Tier
          </h3>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((tier) => {
              const count = facets.tiers[tier] || 0;
              if (count === 0) return null;
              return (
                <label
                  key={tier}
                  className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-800/50 cursor-pointer group"
                >
                  <input type="checkbox" checked={filters.tiers.includes(tier)} onChange={() => toggleTier(tier)} className="sr-only" />
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                    filters.tiers.includes(tier) ? "bg-purple-500 border-purple-500" : "border-zinc-600 group-hover:border-zinc-400"
                  )}>
                    {filters.tiers.includes(tier) && <CheckIcon />}
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: tier }).map((_, i) => (
                      <StarIcon key={i} />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-500 ml-auto">{count}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="w-full py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    </aside>
  );
}
