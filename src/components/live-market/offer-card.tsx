"use client";

import { cn } from "@/lib/utils";
import { RARITY_CONFIG } from "@/lib/types";
import type { PlayerActivity, OfferEvent } from "@/lib/market/market-store";
import type { OwnedPlayerInfo } from "@/lib/market/portfolio-utils";
import { ChevronDown, TrendingUp, TrendingDown, Minus, ArrowRightLeft, Briefcase, CalendarDays } from "lucide-react";

function timeAgo(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "—";
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
  if (!eth || eth <= 0 || isNaN(eth)) return "—";
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
  return `${isHome ? "vs" : "@"} ${opponent} (${ha}) · ${when}`;
}

const TRADE_BADGE: Record<string, { label: string; cls: string }> = {
  sale: { label: "SALE", cls: "bg-green-500/15 text-green-400" },
  swap: { label: "SWAP", cls: "bg-blue-500/15 text-blue-400" },
  mixed: { label: "MIXED", cls: "bg-purple-500/15 text-purple-400" },
};

function formatPower(power: string | null): string | null {
  if (!power) return null;
  const n = parseFloat(power);
  if (isNaN(n) || n <= 1) return null;
  return `${n.toFixed(2)}x`;
}

function OfferDetailRow({ event }: { event: OfferEvent }) {
  const rarityConf = RARITY_CONFIG[event.rarity] || RARITY_CONFIG.common;
  const badge = TRADE_BADGE[event.tradeType] || TRADE_BADGE.sale;
  const power = formatPower(event.cardPower);

  return (
    <div className="px-4 py-1.5 border-b border-zinc-800/30 last:border-0 space-y-0.5">
      {/* Main row */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", rarityConf.dotColor)} />
        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0", badge.cls)}>
          {badge.label}
        </span>
        <span className="text-zinc-300 font-medium">{formatEth(event.priceEth)} ETH</span>
        <span className="flex items-center gap-1 text-zinc-600 flex-1 min-w-0 truncate">
          {event.sellerSlug || "?"} <ArrowRightLeft className="w-3 h-3 shrink-0" /> {event.buyerSlug || "?"}
        </span>
        <span className="text-zinc-600 shrink-0">{timeAgo(event.receivedAt)}</span>
      </div>
      {/* Card metadata + counter cards */}
      {(event.cardGrade != null || event.cardSeason || power || event.avgScore || event.upcomingGame || event.counterCards) && (
        <div className="flex items-center gap-2 pl-4 text-[10px]">
          {event.avgScore != null && event.avgScore > 0 && (
            <span className={cn(
              "font-semibold px-1 rounded",
              event.avgScore >= 60 ? "bg-green-500/15 text-green-400" :
              event.avgScore >= 40 ? "bg-yellow-500/15 text-yellow-400" :
              "text-zinc-500"
            )}>
              L15: {Math.round(event.avgScore)}
            </span>
          )}
          {event.cardGrade != null && (
            <span className="text-zinc-500">Lv.{event.cardGrade}</span>
          )}
          {power && <span className="text-zinc-500">{power}</span>}
          {event.cardSeason && (
            <span className="text-zinc-500">{event.cardSeason}-{String(event.cardSeason + 1).slice(2)}</span>
          )}
          {event.upcomingGame && (
            <span className="text-green-400/60">
              {event.upcomingGame.homeTeam.code} vs {event.upcomingGame.awayTeam.code}
            </span>
          )}
          {event.counterCards && event.counterCards.length > 0 && (
            <span className="text-blue-400/70 truncate">
              for: {event.counterCards.map((c) => `${c.playerName} (${c.rarity})`).join(", ")}
            </span>
          )}
        </div>
      )}
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
    : "—";
  const trend = priceTrend(player.prices);
  const gameChip = formatGameChip(player);

  return (
    <div className={cn(
      "border-b border-zinc-800/50 transition-colors duration-500",
      isNew && "bg-zinc-800/30",
      owned && "border-l-2 border-l-purple-500",
    )}>
      {/* Main row — clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/20 transition-colors cursor-pointer text-left"
      >
        {/* Rarity dot */}
        <span className={cn("w-2 h-2 rounded-full shrink-0", rarityConf.dotColor)} />

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {player.playerName}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
              {posShort}
            </span>
            <span className="text-[10px] text-zinc-600 truncate hidden sm:inline">
              {player.clubName || ""}
            </span>
            {owned && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold shrink-0">
                <Briefcase className="w-2.5 h-2.5" />
                {owned.cardCount}x
              </span>
            )}
          </div>
          {/* Second line: game chip + owned rarities */}
          {(gameChip || owned) && (
            <div className="flex items-center gap-2 mt-0.5">
              {gameChip && (
                <span className="flex items-center gap-1 text-[10px] text-green-400/80">
                  <CalendarDays className="w-3 h-3" />
                  {gameChip}
                </span>
              )}
              {owned && (
                <span className="text-[10px] text-purple-400/60">
                  {owned.rarities.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sale count */}
        <span className={cn(
          "text-[10px] font-bold tabular-nums shrink-0",
          player.saleCount >= 5 ? "text-red-400" : player.saleCount >= 3 ? "text-amber-400" : "text-green-500/80",
        )}>
          {player.saleCount} sale{player.saleCount !== 1 ? "s" : ""}
        </span>

        {/* Price + trend */}
        <div className="flex items-center gap-1 shrink-0">
          {trend === "up" && <TrendingUp className="w-3 h-3 text-green-400" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-red-400" />}
          {trend === "flat" && player.prices.length >= 2 && <Minus className="w-3 h-3 text-zinc-600" />}
          <span className="text-sm font-semibold text-white tabular-nums">
            {formatEth(player.latestPriceEth)}
          </span>
          <span className="text-[10px] text-zinc-600">ETH</span>
        </div>

        {/* Time + chevron */}
        <span className="text-[10px] text-zinc-600 shrink-0 w-8 text-right tabular-nums">
          {timeAgo(player.lastSeen)}
        </span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-zinc-600 transition-transform shrink-0",
          isExpanded && "rotate-180",
        )} />
      </button>

      {/* Expanded detail */}
      {isExpanded && player.recentOffers.length > 0 && (
        <div className="bg-zinc-900/60 border-t border-zinc-800/50">
          {player.recentOffers.map((e) => (
            <OfferDetailRow key={`${e.offerId}-${e.offerStatus}`} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
