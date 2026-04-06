"use client";

import { useState } from "react";
import { BarChart3, Lock, ChevronDown } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import type { LineupLockEvent } from "@/lib/market/market-store";
import type { OfferLifecycleEvent } from "@/lib/market/types";
import { cn } from "@/lib/utils";

const RARITY_COLORS: Record<string, string> = {
  limited: "bg-amber-400",
  rare: "bg-red-400",
  super_rare: "bg-blue-400",
  unique: "bg-purple-400",
};

const STATUS_STYLES: Record<string, string> = {
  created: "text-green-400",
  pending: "text-blue-400",
  price_updated: "text-amber-400",
  cancelled: "text-red-400",
  expired: "text-zinc-500",
  rejected: "text-red-400",
  accepted: "text-emerald-400",
};

const STATUS_LABELS: Record<string, string> = {
  created: "LISTED",
  pending: "PENDING",
  price_updated: "PRICE \u2193",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
  rejected: "REJECTED",
  accepted: "SOLD",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "\u2014";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

function EventRow({ event }: { event: OfferLifecycleEvent }) {
  const rarityColor = RARITY_COLORS[event.rarity] || "bg-zinc-400";
  const statusStyle = STATUS_STYLES[event.status] || "text-zinc-400";
  const label = STATUS_LABELS[event.status] || event.status.toUpperCase();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/30 hover:bg-zinc-800/20">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", rarityColor)} />
      <span className={cn("text-[9px] font-bold w-16 shrink-0", statusStyle)}>
        {label}
      </span>
      <span className="text-[11px] text-white truncate flex-1 min-w-0">
        {event.playerName}
      </span>
      {event.priceEth > 0 && (
        <span className="text-[10px] text-zinc-300 tabular-nums shrink-0">
          {event.priceEth.toFixed(4)}
        </span>
      )}
      {event.status === "price_updated" && event.previousPriceEth && event.previousPriceEth > 0 && (
        <span className="text-[9px] text-zinc-600 shrink-0">
          was {event.previousPriceEth.toFixed(4)}
        </span>
      )}
      <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(event.receivedAt)}</span>
    </div>
  );
}

function LineupLockRow({ lock }: { lock: LineupLockEvent }) {
  const rarityColor = RARITY_COLORS[lock.rarity] || "bg-zinc-400";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", rarityColor)} />
      <span className="text-[9px] font-bold text-purple-400 w-16 shrink-0">LOCKED</span>
      <span className="text-[11px] text-white truncate flex-1">{lock.playerName}</span>
      {lock.lineupDetails && (
        <span className="text-[10px] text-zinc-500 truncate max-w-[80px]">
          {lock.lineupDetails.competitionName}
        </span>
      )}
      <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(lock.receivedAt)}</span>
    </div>
  );
}

export function AnalyticsPanel() {
  const { lifecycleEvents, lineupLocks } = useMarketStore();
  const [locksCollapsed, setLocksCollapsed] = useState(false);

  const hasData = lifecycleEvents.length > 0 || lineupLocks.length > 0;

  return (
    <div className="flex flex-col h-full border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
        <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-white">Live Feed</span>
        {lifecycleEvents.length > 0 && (
          <span className="text-[10px] text-zinc-500">
            {lifecycleEvents.length} events
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <BarChart3 className="w-6 h-6 text-zinc-700" />
          <p className="text-xs text-zinc-600">Waiting for data...</p>
          <p className="text-[10px] text-zinc-700 text-center px-4">
            All market events will stream here in real-time
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Lineup Locks (compact, collapsible) */}
          {lineupLocks.length > 0 && (
            <div>
              <button
                onClick={() => setLocksCollapsed(!locksCollapsed)}
                className="w-full flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/30 cursor-pointer hover:bg-zinc-800/30"
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Lineup Locks
                  </span>
                  <span className="text-[10px] text-zinc-600">{lineupLocks.length}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "w-3 h-3 text-zinc-600 transition-transform",
                    locksCollapsed && "-rotate-90"
                  )}
                />
              </button>
              {!locksCollapsed && (
                <div className="divide-y divide-zinc-800/50">
                  {lineupLocks.map((lock, i) => (
                    <LineupLockRow key={`${lock.cardSlug}-${i}`} lock={lock} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Event Feed */}
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/30">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Market Events
            </span>
          </div>
          {lifecycleEvents.map((evt, i) => (
            <EventRow key={`${evt.offerId}-${evt.status}-${i}`} event={evt} />
          ))}
        </div>
      )}
    </div>
  );
}
