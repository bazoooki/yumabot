"use client";

import { useMemo, useEffect, useRef } from "react";
import { Volume2, VolumeX, BarChart3 } from "lucide-react";
import { useMarketStream } from "@/lib/market/use-market-stream";
import { useMarketStore } from "@/lib/market/market-store";
import { buildPortfolioIndex, lookupOwned } from "@/lib/market/portfolio-utils";
import { ConnectionStatus } from "./connection-status";
import { OfferFeed } from "./offer-feed";
import { AlertPanel } from "./alert-panel";
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

export function LiveMarketTab({ cards }: { cards: SorareCard[] }) {
  useMarketStream();

  const {
    soundEnabled,
    toggleSound,
    players,
    addAlert,
    advancedAnalytics,
    toggleAdvancedAnalytics,
  } = useMarketStore();
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

      <div className="flex flex-1 overflow-hidden relative">
        <div className="w-[60%] overflow-hidden">
          <OfferFeed portfolio={portfolio} />
        </div>

        <div className="w-[40%] overflow-hidden">
          <AlertPanel />
        </div>

        {/* Bottom-right control buttons */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
          <button
            onClick={toggleAdvancedAnalytics}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200",
              advancedAnalytics
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary hover:text-foreground"
            )}
            title={advancedAnalytics ? "Disable advanced analytics" : "Enable advanced analytics"}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Advanced
          </button>

          <button
            onClick={toggleSound}
            className={cn(
              "p-2 rounded-xl transition-all duration-200",
              soundEnabled
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-secondary/50 text-muted-foreground border border-border/50 hover:bg-secondary hover:text-foreground"
            )}
            title={soundEnabled ? "Mute alerts" : "Enable alert sound"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
