"use client";

import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";

export function ConnectionStatus() {
  const { connectionStatus, totalOffers } = useMarketStore();

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            isConnected
              ? "bg-green-400 animate-pulse"
              : isConnecting
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-400"
          )}
        />
        <Radio className="w-3.5 h-3.5 text-zinc-500" />
        <span
          className={cn(
            "text-xs font-medium",
            isConnected
              ? "text-green-400"
              : isConnecting
                ? "text-yellow-400"
                : "text-red-400"
          )}
        >
          {isConnected
            ? "Live"
            : isConnecting
              ? "Connecting..."
              : connectionStatus === "error"
                ? "Error — Reconnecting..."
                : "Disconnected"}
        </span>
      </div>

      <span className="text-[10px] text-zinc-600">
        {totalOffers} sales tracked
      </span>
    </div>
  );
}
