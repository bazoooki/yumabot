"use client";

import { useMemo } from "react";
import { Search, Filter, Briefcase, ArrowUpDown } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import { lookupOwned } from "@/lib/market/portfolio-utils";
import type { PortfolioIndex } from "@/lib/market/portfolio-utils";
import { PlayerRow } from "./offer-card";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RarityType, Position } from "@/lib/types";
import type { MarketSort, TradeType } from "@/lib/market/types";

const POSITIONS: { key: Position; label: string }[] = [
  { key: "Goalkeeper", label: "GK" },
  { key: "Defender", label: "DEF" },
  { key: "Midfielder", label: "MID" },
  { key: "Forward", label: "FWD" },
];

const RARITIES: RarityType[] = ["limited", "rare", "super_rare", "unique"];

const TRADE_TYPES: { key: TradeType; label: string }[] = [
  { key: "sale", label: "Sales" },
  { key: "swap", label: "Swaps" },
  { key: "mixed", label: "Mixed" },
];

const SORT_OPTIONS: { key: MarketSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "sales", label: "Most Sales" },
  { key: "price_high", label: "Price ↑" },
  { key: "price_low", label: "Price ↓" },
  { key: "score", label: "Avg Score" },
];

const FRESH_MS = 3000;

export function OfferFeed({ portfolio }: { portfolio: PortfolioIndex }) {
  const { players, totalOffers, filters, setFilters, expandedPlayer, toggleExpanded } = useMarketStore();

  const sorted = useMemo(() => {
    const now = Date.now();
    let list = Object.values(players);

    // Only players with 2+ sales (skip single-sale noise)
    list = list.filter((p) => p.saleCount >= 2);

    // My Players filter
    if (filters.myPlayersOnly) {
      list = list.filter((p) => !!lookupOwned(portfolio, p.playerSlug, p.playerName));
    }

    if (filters.playerSearch) {
      const q = filters.playerSearch.toLowerCase();
      list = list.filter((p) => p.playerName.toLowerCase().includes(q));
    }
    if (filters.rarity) {
      list = list.filter((p) => p.rarity === filters.rarity);
    }
    if (filters.position) {
      const posPrefix = filters.position.toLowerCase().slice(0, 3);
      list = list.filter((p) => p.position?.toLowerCase().startsWith(posPrefix));
    }
    if (filters.tradeType) {
      list = list.filter((p) => p.tradeTypes.has(filters.tradeType!));
    }
    if (filters.minPriceEth !== null) {
      list = list.filter((p) => p.latestPriceEth >= filters.minPriceEth!);
    }
    if (filters.maxPriceEth !== null) {
      list = list.filter((p) => p.latestPriceEth <= filters.maxPriceEth!);
    }

    switch (filters.sort) {
      case "sales":
        list.sort((a, b) => b.saleCount - a.saleCount);
        break;
      case "price_high":
        list.sort((a, b) => b.latestPriceEth - a.latestPriceEth);
        break;
      case "price_low":
        list.sort((a, b) => a.latestPriceEth - b.latestPriceEth);
        break;
      case "score":
        list.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
        break;
      case "recent":
      default:
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
    }

    return list.map((p) => ({
      player: p,
      isNew: now - p.updatedAt < FRESH_MS,
      owned: lookupOwned(portfolio, p.playerSlug, p.playerName),
    }));
  }, [players, filters, portfolio]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Search player..."
            value={filters.playerSearch}
            onChange={(e) => setFilters({ playerSearch: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        {/* My Players toggle */}
        <button
          onClick={() => setFilters({ myPlayersOnly: !filters.myPlayersOnly })}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
            filters.myPlayersOnly
              ? "bg-purple-600/30 text-purple-300 border border-purple-500/50"
              : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Briefcase className="w-3 h-3" />
          My Players
        </button>

        <Filter className="w-3.5 h-3.5 text-zinc-600" />

        {RARITIES.map((r) => {
          const conf = RARITY_CONFIG[r];
          return (
            <button
              key={r}
              onClick={() => setFilters({ rarity: filters.rarity === r ? null : r })}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                filters.rarity === r
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", conf.dotColor)} />
              {conf.label}
            </button>
          );
        })}

        {POSITIONS.map((p) => (
          <button
            key={p.key}
            onClick={() => setFilters({ position: filters.position === p.key ? null : p.key })}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-mono font-medium transition-colors",
              filters.position === p.key
                ? "bg-zinc-700 text-white"
                : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {p.label}
          </button>
        ))}

        {TRADE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilters({ tradeType: filters.tradeType === t.key ? null : t.key })}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              filters.tradeType === t.key
                ? "bg-zinc-700 text-white"
                : "text-zinc-600 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}

        <span className="text-zinc-700 mx-0.5">|</span>
        <ArrowUpDown className="w-3 h-3 text-zinc-600" />
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilters({ sort: s.key })}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              filters.sort === s.key
                ? "bg-zinc-700 text-white"
                : "text-zinc-600 hover:text-zinc-300"
            )}
          >
            {s.label}
          </button>
        ))}

        <span className="text-[10px] text-zinc-600 ml-auto">
          {Object.keys(players).length} players &middot; {totalOffers} sales
        </span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-zinc-600">
              {totalOffers === 0
                ? "Waiting for market activity..."
                : "No players match filters"}
            </p>
          </div>
        ) : (
          sorted.map(({ player, isNew, owned }) => (
            <PlayerRow
              key={player.playerSlug}
              player={player}
              isNew={isNew}
              isExpanded={expandedPlayer === player.playerSlug}
              onToggle={() => toggleExpanded(player.playerSlug)}
              owned={owned}
            />
          ))
        )}
      </div>
    </div>
  );
}
