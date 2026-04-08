"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Radio, HelpCircle, X } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";

export function ConnectionStatus() {
  const { connectionStatus, totalOffers, filters, setFilters } = useMarketStore();
  const [showHelp, setShowHelp] = useState(false);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-card/30">
      {/* Status pill */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300",
        isConnected
          ? "bg-green-500/10 border-green-500/20"
          : isConnecting
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-red-500/10 border-red-500/20"
      )}>
        <span className="relative flex h-2 w-2">
          {(isConnected || isConnecting) && (
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isConnected ? "bg-green-400" : "bg-amber-400"
            )} />
          )}
          <span className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            isConnected ? "bg-green-400" : isConnecting ? "bg-amber-400" : "bg-red-400"
          )} />
        </span>
        <span className={cn(
          "text-xs font-semibold",
          isConnected ? "text-green-400" : isConnecting ? "text-amber-400" : "text-red-400"
        )}>
          {isConnected
            ? "Live"
            : isConnecting
              ? "Connecting..."
              : connectionStatus === "error"
                ? "Reconnecting..."
                : "Disconnected"}
        </span>
        {connectionStatus === "error" && (
          <span className="text-[10px] text-red-400/60 ml-1">auto-retry</span>
        )}
      </div>

      {/* Sales counter */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/30 border border-border/50">
        <Radio className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <span className="text-foreground font-semibold">{totalOffers}</span> sales tracked
        </span>
      </div>

      {/* Min sales stepper */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">show min</span>
        <div className="flex items-center rounded-lg bg-secondary/30 border border-border/50">
          <button
            onClick={() => setFilters({ minSales: Math.max(1, filters.minSales - 1) })}
            className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            -
          </button>
          <span className="px-1.5 py-0.5 text-xs font-bold text-foreground tabular-nums min-w-[20px] text-center">
            {filters.minSales}
          </span>
          <button
            onClick={() => setFilters({ minSales: filters.minSales + 1 })}
            className="px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            +
          </button>
        </div>
        <span className="text-xs text-muted-foreground">sales</span>
      </div>

      {/* Help button */}
      <div className="relative ml-auto">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            showHelp
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
          title="How to use Live Market"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {showHelp && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
            <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl bg-card border border-border/50 shadow-xl shadow-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Live Market</h4>
                <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  <span className="text-foreground font-semibold">Real-time feed</span> of all accepted sales on
                  Sorare. Players are grouped and ranked by activity.
                </p>
                <p>
                  <span className="text-foreground font-semibold">Min sales filter</span> controls the minimum
                  number of sales a player must have to appear in the feed. Raise it to focus on
                  high-activity players.
                </p>
                <p>
                  <span className="text-foreground font-semibold">Alerts</span> fire automatically when your
                  portfolio players are being traded or when unusual accumulation/dump patterns are
                  detected before upcoming matches.
                </p>
                <p>
                  <span className="text-foreground font-semibold">Tips:</span> Use the{" "}
                  <span className="font-mono bg-secondary/50 px-1 rounded">Mine</span> filter to see only
                  players you own. Click any row to expand sale details. Enable{" "}
                  <span className="font-mono bg-secondary/50 px-1 rounded">Advanced</span> for listing
                  analytics and lineup lock signals.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
