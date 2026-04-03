"use client";

import { cn } from "@/lib/utils";
import { X, TrendingUp, Users, Zap, Activity } from "lucide-react";
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
  velocity: Activity,
} as const;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function AlertCard({
  alert,
  onDismiss,
}: {
  alert: MarketAlert;
  onDismiss: (id: number) => void;
}) {
  const Icon = RULE_ICONS[alert.ruleType] || Activity;
  const severityStyle = SEVERITY_STYLES[alert.severity];
  const labelStyle = SEVERITY_LABEL[alert.severity];

  return (
    <div
      className={cn(
        "border-l-2 px-3 py-2.5 bg-zinc-900/50 rounded-r transition-opacity",
        severityStyle,
        alert.acknowledged && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
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

        {!alert.acknowledged && (
          <button
            onClick={() => onDismiss(alert.id)}
            className="p-0.5 hover:bg-zinc-800 rounded text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
