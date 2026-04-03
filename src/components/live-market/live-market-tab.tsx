"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useMarketStream } from "@/lib/market/use-market-stream";
import { useMarketStore } from "@/lib/market/market-store";
import { ConnectionStatus } from "./connection-status";
import { OfferFeed } from "./offer-feed";
import { AlertPanel } from "./alert-panel";
import { cn } from "@/lib/utils";

export function LiveMarketTab() {
  useMarketStream();

  const { soundEnabled, toggleSound } = useMarketStore();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ConnectionStatus />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Offer feed — left 60% */}
        <div className="w-[60%] overflow-hidden">
          <OfferFeed />
        </div>

        {/* Alert panel — right 40% */}
        <div className="w-[40%] overflow-hidden">
          <AlertPanel />
        </div>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className={cn(
            "absolute bottom-4 right-4 p-2 rounded-full transition-colors z-10",
            soundEnabled
              ? "bg-purple-600/80 text-white hover:bg-purple-500"
              : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
          )}
          title={soundEnabled ? "Mute alerts" : "Enable alert sound"}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
