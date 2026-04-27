"use client";

import { Shield, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrategyMode = "safe" | "balanced" | "ceiling";

const LABELS: Record<StrategyMode, string> = {
  safe: "SAFE",
  balanced: "BALANCED",
  ceiling: "CEILING",
};

const ICONS: Record<StrategyMode, typeof Shield> = {
  safe: Shield,
  balanced: Target,
  ceiling: Zap,
};

const ACTIVE_CLASS: Record<StrategyMode, string> = {
  safe: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40",
  balanced: "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/40",
  ceiling: "bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/40",
};

export interface StrategyTabStripProps {
  active: StrategyMode | null;
  available: ReadonlyArray<StrategyMode> | ReadonlySet<StrategyMode>;
  onChange: (mode: StrategyMode) => void;
}

export function StrategyTabStrip({
  active,
  available,
  onChange,
}: StrategyTabStripProps) {
  const isAvailable = (mode: StrategyMode) =>
    Array.isArray(available)
      ? (available as ReadonlyArray<StrategyMode>).includes(mode)
      : (available as ReadonlySet<StrategyMode>).has(mode);

  return (
    <div className="flex items-stretch gap-1 p-1 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
      {(["safe", "balanced", "ceiling"] as StrategyMode[]).map((mode) => {
        const Icon = ICONS[mode];
        const available = isAvailable(mode);
        const isActive = mode === active;
        return (
          <button
            key={mode}
            type="button"
            disabled={!available}
            onClick={() => onChange(mode)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all",
              isActive
                ? ACTIVE_CLASS[mode]
                : available
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-zinc-700 cursor-not-allowed",
            )}
          >
            <Icon className="w-3 h-3" />
            {LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
