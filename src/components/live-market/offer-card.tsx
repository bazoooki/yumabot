"use client";

import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/types";
import type { PlayerActivity, OfferEvent } from "@/lib/market/market-store";
import type { OwnedPlayerInfo } from "@/lib/market/portfolio-utils";
import { ChevronDown, TrendingUp, TrendingDown, Minus, ArrowRightLeft, Briefcase, CalendarDays } from "lucide-react";

function timeAgo(iso: string | undefined): string {
  if (!iso) return "\u2014";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "\u2014";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

function priceTrend(prices: number[]): "up" | "down" | "flat" {
  if (prices.length < 2) return "flat";
  const recent = prices.slice(-3);
  const older = prices.slice(-6, -3);
  if (older.length === 0) return "flat";
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const change = (recentAvg - olderAvg) / olderAvg;
  if (change > 0.1) return "up";
  if (change < -0.1) return "down";
  return "flat";
}

function formatEth(eth: number): string {
  if (!eth || eth <= 0 || isNaN(eth)) return "\u2014";
  if (eth < 0.001) return "<0.001";
  if (eth < 1) return eth.toFixed(4);
  return eth.toFixed(3);
}

function formatGameChip(player: PlayerActivity): string | null {
  const game = player.upcomingGame;
  if (!game) return null;
  const days = Math.ceil((new Date(game.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  const club = player.clubName || "";
  const isHome = game.homeTeam.name?.toLowerCase().includes(club.toLowerCase().slice(0, 4));
  const opponent = isHome ? game.awayTeam.code : game.homeTeam.code;
  const ha = isHome ? "H" : "A";
  const when = days === 0 ? "today" : days === 1 ? "tmrw" : `${days}d`;
  return `${isHome ? "vs" : "@"} ${opponent} (${ha}) \u00b7 ${when}`;
}

function formatPower(power: string | null): string | null {
  if (!power) return null;
  const n = parseFloat(power);
  if (isNaN(n) || n <= 1) return null;
  return `${n.toFixed(2)}x`;
}

function OfferDetailRow({ event }: { event: OfferEvent }) {
  const rarityConf = RARITY_CONFIG[event.rarity] || RARITY_CONFIG.common;

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border/30 last:border-0">
      <span className={cn("w-2 h-2 rounded-full shrink-0", rarityConf.dotColor)} />
      <span className="text-foreground font-semibold w-24 shrink-0">{formatEth(event.priceEth)} ETH</span>
      <span className="flex items-center gap-1.5 text-muted-foreground flex-1 min-w-0 truncate">
        <span className="truncate">{event.sellerSlug || "?"}</span>
        <ArrowRightLeft className="w-3 h-3 shrink-0 text-muted-foreground/50" />
        <span className="truncate">{event.buyerSlug || "?"}</span>
      </span>
      <span className="text-muted-foreground/60 shrink-0 text-[10px]">{timeAgo(event.receivedAt)}</span>
    </div>
  );
}

export function PlayerRow({
  player,
  isNew,
  isExpanded,
  onToggle,
  owned,
}: {
  player: PlayerActivity;
  isNew: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  owned?: OwnedPlayerInfo;
}) {
  const rarityConf = RARITY_CONFIG[player.rarity] || RARITY_CONFIG.common;
  const posShort = player.position
    ? player.position.slice(0, 3).toUpperCase()
    : "\u2014";
  const trend = priceTrend(player.prices);
  const gameChip = formatGameChip(player);

  return (
    <div className={cn(
      "border-b border-border/30 transition-all duration-300",
      isNew && "bg-primary/5",
      owned && "border-l-2 border-l-primary",
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 md:gap-3 px-3 py-3 md:px-4 hover:bg-secondary/30 transition-all duration-200 cursor-pointer text-left min-h-[44px]"
      >
        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", rarityConf.dotColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {player.playerName}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-secondary/50 text-muted-foreground font-mono shrink-0 border border-border/30">
              {posShort}
            </span>
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              {player.clubName || ""}
            </span>
            {owned && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0 border border-primary/20">
                <Briefcase className="w-3 h-3" />
                {owned.cardCount}x
              </span>
            )}
          </div>
          {(gameChip || owned) && (
            <div className="flex items-center gap-2 mt-1">
              {gameChip && (
                <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  <CalendarDays className="w-3 h-3" />
                  {gameChip}
                </span>
              )}
              {owned && (
                <span className="text-[10px] text-primary/60">
                  {owned.rarities.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sale count pill */}
        <div className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 border",
          player.saleCount >= 5
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : player.saleCount >= 3
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20",
        )}>
          {player.saleCount} sale{player.saleCount !== 1 ? "s" : ""}
        </div>

        {/* Price + trend pill */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg shrink-0",
          trend === "up" ? "bg-green-500/10" :
          trend === "down" ? "bg-red-500/10" :
          "bg-secondary/30"
        )}>
          {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-green-400" />}
          {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          {trend === "flat" && player.prices.length >= 2 && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-sm font-bold text-foreground tabular-nums">
            {formatEth(player.latestPriceEth)}
          </span>
          <span className="text-[10px] text-muted-foreground">ETH</span>
        </div>

        <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0 w-8 text-right tabular-nums">
          {timeAgo(player.lastSeen)}
        </span>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 hidden sm:block",
          isExpanded && "rotate-180",
        )} />
      </button>

      {isExpanded && player.recentOffers.length > 0 && (
        <div className="bg-secondary/20 border-t border-border/30">
          {player.recentOffers.map((e) => (
            <OfferDetailRow key={`${e.offerId}-${e.offerStatus}`} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
