"use client";

import { useMemo, useRef, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import { OfferCard } from "./offer-card";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RarityType, Position } from "@/lib/types";

const POSITIONS: { key: Position; label: string }[] = [
  { key: "Goalkeeper", label: "GK" },
  { key: "Defender", label: "DEF" },
  { key: "Midfielder", label: "MID" },
  { key: "Forward", label: "FWD" },
];

const RARITIES: RarityType[] = [
  "limited",
  "rare",
  "super_rare",
  "unique",
];

export function OfferFeed() {
  const { offers, filters, setFilters } = useMarketStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new offers
  useEffect(() => {
    if (scrollRef.current && scrollRef.current.scrollTop < 100) {
      scrollRef.current.scrollTop = 0;
    }
  }, [offers.length]);

  const filtered = useMemo(() => {
    return offers.filter((o) => {
      if (
        filters.playerSearch &&
        !o.playerName
          .toLowerCase()
          .includes(filters.playerSearch.toLowerCase())
      )
        return false;
      if (filters.rarity && o.rarity !== filters.rarity) return false;
      if (
        filters.position &&
        o.position?.toLowerCase() !==
          filters.position.toLowerCase().slice(0, 3)
      )
        return false;
      if (
        filters.minPriceEth !== null &&
        o.priceEth < filters.minPriceEth
      )
        return false;
      if (
        filters.maxPriceEth !== null &&
        o.priceEth > filters.maxPriceEth
      )
        return false;
      return true;
    });
  }, [offers, filters]);

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

        <Filter className="w-3.5 h-3.5 text-zinc-600" />

        {/* Rarity filters */}
        {RARITIES.map((r) => {
          const conf = RARITY_CONFIG[r];
          return (
            <button
              key={r}
              onClick={() =>
                setFilters({ rarity: filters.rarity === r ? null : r })
              }
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                filters.rarity === r
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span
                className={cn("w-1.5 h-1.5 rounded-full", conf.dotColor)}
              />
              {conf.label}
            </button>
          );
        })}

        {/* Position filters */}
        {POSITIONS.map((p) => (
          <button
            key={p.key}
            onClick={() =>
              setFilters({
                position: filters.position === p.key ? null : p.key,
              })
            }
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
      </div>

      {/* Offer list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-zinc-600">
              {offers.length === 0
                ? "Waiting for offers..."
                : "No offers match filters"}
            </p>
          </div>
        ) : (
          filtered.map((o, i) => <OfferCard key={`${o.offerId}-${i}`} offer={o} />)
        )}
      </div>
    </div>
  );
}
