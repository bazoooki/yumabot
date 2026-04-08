"use client";

import { useMemo } from "react";
import { Search, Briefcase, ArrowUpDown, Sparkles } from "lucide-react";
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
  { key: "price_high", label: "Price \u2191" },
  { key: "price_low", label: "Price \u2193" },
  { key: "score", label: "Avg Score" },
];

const FRESH_MS = 3000;

export function OfferFeed({ portfolio }: { portfolio: PortfolioIndex }) {
  const { players, totalOffers, filters, setFilters, expandedPlayer, toggleExpanded } = useMarketStore();

  const sorted = useMemo(() => {
    const now = Date.now();
    let list = Object.values(players);

    list = list.filter((p) => p.saleCount >= filters.minSales);

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
      {/* Row 1: Search + Filters */}
      <div className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 border-b border-border/50 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[120px] md:min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search player..."
            value={filters.playerSearch}
            onChange={(e) => setFilters({ playerSearch: e.target.value })}
            className="w-full pl-10 pr-3 py-2 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* My Players */}
        <button
          onClick={() => setFilters({ myPlayersOnly: !filters.myPlayersOnly })}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border",
            filters.myPlayersOnly
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-secondary/30 text-muted-foreground border-border/50 hover:bg-secondary/50"
          )}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Mine
        </button>

        <div className="hidden md:block w-px h-6 bg-border/50" />

        {/* Rarity group */}
        <div className="hidden md:flex items-center gap-0.5 p-1 rounded-xl bg-secondary/30 border border-border/50">
          {RARITIES.map((r) => {
            const conf = RARITY_CONFIG[r];
            return (
              <button
                key={r}
                onClick={() => setFilters({ rarity: filters.rarity === r ? null : r })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                  filters.rarity === r
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", conf.dotColor)} />
                {conf.label}
              </button>
            );
          })}
        </div>

        {/* Position group */}
        <div className="hidden md:flex items-center gap-0.5 p-1 rounded-xl bg-secondary/30 border border-border/50">
          {POSITIONS.map((p) => (
            <button
              key={p.key}
              onClick={() => setFilters({ position: filters.position === p.key ? null : p.key })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-200",
                filters.position === p.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Trade types */}
        {TRADE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilters({ tradeType: filters.tradeType === t.key ? null : t.key })}
            className={cn(
              "hidden md:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              filters.tradeType === t.key
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Row 2: Sort + Min Sales + Stats */}
      <div className="flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 border-b border-border/50 overflow-x-auto">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilters({ sort: s.key })}
            className={cn(
              "px-2 py-1 rounded-lg text-xs transition-all duration-200",
              filters.sort === s.key
                ? "text-foreground font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}

        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} players &middot; {totalOffers} sales
        </span>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-secondary/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {totalOffers === 0
                ? "Waiting for market activity..."
                : "No players match filters"}
            </p>
            <p className="text-xs text-muted-foreground/60">
              {totalOffers === 0
                ? "Sales will appear here in real-time"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          sorted.map(({ player, isNew, owned }) => (
            <div key={player.playerSlug} className={isNew ? "slide-enter" : undefined}>
              <PlayerRow
                player={player}
                isNew={isNew}
                isExpanded={expandedPlayer === player.playerSlug}
                onToggle={() => toggleExpanded(player.playerSlug)}
                owned={owned}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
