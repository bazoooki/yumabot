"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import { buildPortfolioIndex, lookupOwned } from "@/lib/market/portfolio-utils";
import { ConnectionStatus } from "./connection-status";
import { OfferFeed } from "./offer-feed";
import { AlertPanel } from "./alert-panel";
import { MarketChat } from "./market-chat";
import { CommandBar } from "@/components/command-bar/command-bar";
import { cn } from "@/lib/utils";
import type { SorareCard } from "@/lib/types";

const PORTFOLIO_THRESHOLDS: Record<string, number> = {
  limited: 4,
  rare: 3,
  super_rare: 2,
  unique: 1,
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function LiveMarketTab({ cards, userSlug }: { cards: SorareCard[]; userSlug: string }) {
  const {
    players,
    addAlert,
  } = useMarketStore();
  const [chatOpen, setChatOpen] = useState(false);
  const portfolio = useMemo(() => buildPortfolioIndex(cards), [cards]);

  // --- Portfolio alerts ---
  const alertedPlayers = useRef(new Set<string>());

  useEffect(() => {
    for (const [slug, activity] of Object.entries(players)) {
      if (alertedPlayers.current.has(slug)) continue;

      const owned = lookupOwned(portfolio, slug, activity.playerName);
      if (!owned) continue;

      const threshold = PORTFOLIO_THRESHOLDS[activity.rarity] || 4;
      if (activity.saleCount < threshold) continue;

      alertedPlayers.current.add(slug);

      addAlert({
        id: Date.now(),
        ruleType: "portfolio",
        severity: "warning",
        playerSlug: slug,
        playerName: activity.playerName,
        title: `Your player ${activity.playerName} — ${activity.saleCount} sales`,
        description: `You own ${owned.cardCount}x (${owned.rarities.join(", ")}). Latest price: ${activity.latestPriceEth > 0 ? activity.latestPriceEth.toFixed(4) : "?"} ETH.`,
        metadata: {
          ownedCount: owned.cardCount,
          ownedRarities: owned.rarities.join(", "),
          saleCount: activity.saleCount,
          latestPrice: activity.latestPriceEth,
        },
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }
  }, [players, portfolio, addAlert]);

  // --- Gameweek signals ---
  const signalledPlayers = useRef(new Set<string>());

  useEffect(() => {
    for (const [slug, activity] of Object.entries(players)) {
      if (signalledPlayers.current.has(slug)) continue;
      if (activity.saleCount < 3) continue;

      const game = activity.upcomingGame;
      if (!game) continue;

      const days = daysUntil(game.date);
      if (days < 0 || days > 3) continue;

      const prices = activity.prices;
      let signal: "accumulation" | "dump" = "accumulation";
      if (prices.length >= 3) {
        const recent = prices.slice(-2);
        const older = prices.slice(-4, -2);
        if (older.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          if (recentAvg < olderAvg * 0.85) signal = "dump";
        }
      }

      const threshold = signal === "dump" ? 3 : 5;
      if (activity.saleCount < threshold) continue;

      signalledPlayers.current.add(slug);

      const owned = lookupOwned(portfolio, slug, activity.playerName);
      const isOwned = !!owned;
      const opponent = game.homeTeam.code === (activity.clubName || "")
        ? `vs ${game.awayTeam.code} (H)`
        : `@ ${game.homeTeam.code} (A)`;

      addAlert({
        id: Date.now() + Math.random(),
        ruleType: "gameweek_signal",
        severity: signal === "dump" && isOwned ? "critical" : signal === "dump" ? "warning" : "info",
        playerSlug: slug,
        playerName: activity.playerName,
        title: signal === "accumulation"
          ? `${activity.playerName} being accumulated ${opponent}`
          : `${activity.playerName} being dumped ${opponent}`,
        description: signal === "accumulation"
          ? `${activity.saleCount} sales before match (${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`}).${isOwned ? " You own this player!" : ""}`
          : `${activity.saleCount} sales with falling price before match.${isOwned ? " You own this player!" : ""}`,
        metadata: {
          signal,
          opponent,
          gameDate: game.date,
          saleCount: activity.saleCount,
          isOwned,
          latestPrice: activity.latestPriceEth,
        },
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });
    }
  }, [players, portfolio, addAlert]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <CommandBar activeTab="market" cards={cards} />

      <ConnectionStatus />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        <div className="flex-1 md:w-[60%] overflow-hidden">
          <OfferFeed portfolio={portfolio} />
        </div>

        <div className="hidden md:block md:w-[40%] overflow-hidden relative">
          <AlertPanel />

          {/* Chat bubble */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={cn(
              "absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all z-20",
              chatOpen
                ? "bg-zinc-700 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20",
            )}
          >
            {chatOpen ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
          </button>

          {/* Chat overlay */}
          {chatOpen && (
            <div className="absolute bottom-16 right-4 left-4 h-[280px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 z-20 flex flex-col overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800 shrink-0 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-300">Chat</h3>
              </div>
              <MarketChat userSlug={userSlug} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
