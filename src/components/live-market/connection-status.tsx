"use client";

import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";

export function ConnectionStatus() {
  const { connectionStatus, totalOffers } = useMarketStore();

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
      </div>

      {/* Sales counter */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/30 border border-border/50">
        <Radio className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <span className="text-foreground font-semibold">{totalOffers}</span> sales tracked
        </span>
      </div>
    </div>
  );
}
