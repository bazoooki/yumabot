"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X, TrendingUp, Users, Zap, ChevronDown } from "lucide-react";
import type { MarketAlert } from "@/lib/market/types";

const SEVERITY_STYLES = {
  info: "border-l-blue-400",
  warning: "border-l-amber-400",
  critical: "border-l-red-400 bg-red-950/20",
} as const;

const SEVERITY_LABEL = {
  info: "text-blue-400",
  warning: "text-amber-400",
  critical: "text-red-400",
} as const;

const RULE_ICONS = {
  volume_spike: TrendingUp,
  price_spike: Zap,
  buyer_concentration: Users,
  velocity: TrendingUp,
} as const;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "—";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-zinc-600">{label}</span>
      <span className="text-[10px] text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

export function AlertCard({
  alert,
  onDismiss,
}: {
  alert: MarketAlert;
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = RULE_ICONS[alert.ruleType] || TrendingUp;
  const severityStyle = SEVERITY_STYLES[alert.severity];
  const labelStyle = SEVERITY_LABEL[alert.severity];
  const meta = alert.metadata || {};

  return (
    <div
      className={cn(
        "border-l-2 bg-zinc-900/50 rounded-r transition-opacity",
        severityStyle,
        alert.acknowledged && "opacity-40"
      )}
    >
      {/* Header — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors text-left cursor-pointer"
      >
        <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", labelStyle)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white truncate">
              {alert.title}
            </span>
            <span className={cn("text-[9px] uppercase font-bold", labelStyle)}>
              {alert.severity}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            {alert.description}
          </p>
          <span className="text-[10px] text-zinc-600 mt-1 block">
            {timeAgo(alert.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!alert.acknowledged && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
              className="p-0.5 hover:bg-zinc-800 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn(
            "w-3 h-3 text-zinc-600 transition-transform",
            expanded && "rotate-180",
          )} />
        </div>
      </button>

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-4 pb-2.5 pt-0 border-t border-zinc-800/50">
          <div className="mt-1.5">
            {alert.ruleType === "volume_spike" && (
              <>
                <MetadataRow label="Sales count" value={String(meta.count || "?")} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <MetadataRow label="Avg price" value={`${meta.avgPrice || "?"} ETH`} />
                <MetadataRow label="Player" value={alert.playerName || "?"} />
              </>
            )}
            {alert.ruleType === "price_spike" && (
              <>
                <MetadataRow label="Latest price" value={`${typeof meta.latestPrice === 'number' ? meta.latestPrice.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="Median price" value={`${typeof meta.median === 'number' ? meta.median.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="Spike ratio" value={`${typeof meta.ratio === 'number' ? meta.ratio.toFixed(1) : "?"}x`} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
              </>
            )}
            {alert.ruleType === "buyer_concentration" && (
              <>
                <MetadataRow label="Buyer" value={String(meta.buyer || "?")} />
                <MetadataRow label="Cards bought" value={String(meta.count || "?")} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
              </>
            )}
            {alert.ruleType === "velocity" && (
              <>
                <MetadataRow label="Sales count" value={String(meta.count || "?")} />
                <MetadataRow label="Window" value={String(meta.window || "?")} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
