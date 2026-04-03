"use client";

import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/types";
import type { MarketOffer } from "@/lib/market/types";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function OfferCard({ offer }: { offer: MarketOffer }) {
  const rarityConf = RARITY_CONFIG[offer.rarity] || RARITY_CONFIG.common;
  const posShort = offer.position
    ? offer.position.slice(0, 3).toUpperCase()
    : "?";

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
      {/* Rarity dot */}
      <span
        className={cn("w-2 h-2 rounded-full shrink-0", rarityConf.dotColor)}
      />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {offer.playerName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
            {posShort}
          </span>
          {offer.clubName && (
            <span className="text-[10px] text-zinc-600 truncate hidden sm:inline">
              {offer.clubName}
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <span className="text-sm font-semibold text-white">
          {offer.priceEth < 0.001
            ? "<0.001"
            : offer.priceEth < 1
              ? offer.priceEth.toFixed(4)
              : offer.priceEth.toFixed(3)}{" "}
          <span className="text-zinc-500 text-xs">ETH</span>
        </span>
      </div>

      {/* Buyer / Seller */}
      <div className="text-right shrink-0 w-20 hidden lg:block">
        <p className="text-[10px] text-zinc-600 truncate">
          {offer.buyerSlug || "—"}
        </p>
      </div>

      {/* Time */}
      <span className="text-[10px] text-zinc-600 shrink-0 w-12 text-right">
        {timeAgo(offer.receivedAt)}
      </span>
    </div>
  );
}
