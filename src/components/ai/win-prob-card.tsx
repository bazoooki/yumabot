"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WinProbVariant = "safe" | "balanced" | "ceiling";

const ACCENT: Record<
  WinProbVariant,
  { border: string; fill: string; text: string }
> = {
  safe: {
    border: "border-emerald-500/30 bg-emerald-500/10",
    fill: "bg-emerald-500",
    text: "text-emerald-400",
  },
  balanced: {
    border: "border-sky-500/30 bg-sky-500/10",
    fill: "bg-sky-500",
    text: "text-sky-400",
  },
  ceiling: {
    border: "border-pink-500/30 bg-pink-500/10",
    fill: "bg-pink-500",
    text: "text-pink-400",
  },
};

export function getWinProbAccent(variant: WinProbVariant) {
  return ACCENT[variant];
}

export interface WinProbCardProps {
  expected: number;
  successProbability: number; // 0..1
  variant?: WinProbVariant;
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
}

export function WinProbCard({
  expected,
  successProbability,
  variant = "balanced",
  action,
}: WinProbCardProps) {
  const accent = ACCENT[variant];
  const pct = Math.min(100, Math.max(0, Math.round(successProbability * 100)));

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 flex items-center gap-3",
        accent.border,
      )}
    >
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
          Expected
        </span>
        <span className="text-xl font-bold tabular-nums text-zinc-100 leading-none mt-0.5">
          {expected}
        </span>
      </div>
      <div className="h-8 w-px bg-zinc-800" />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
          Win prob.
        </span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums leading-none mt-0.5",
            accent.text,
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden ml-2">
        <div
          className={cn("h-full transition-all", accent.fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-wide hover:opacity-80 flex items-center gap-1 px-2.5 py-1.5 rounded-md border",
            accent.border,
            accent.text,
          )}
        >
          {action.label}
          {action.icon}
        </button>
      )}
    </div>
  );
}
