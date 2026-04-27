"use client";

import { Sparkles, Zap, Crosshair, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlayMode = "auto" | "fast" | "balanced" | "safe";

const MODES: ReadonlyArray<{
  key: PlayMode;
  label: string;
  icon: typeof Zap;
  bg: string;
  color: string;
}> = [
  {
    key: "auto",
    label: "AUTO",
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/15 border-purple-500/30",
  },
  {
    key: "fast",
    label: "FAST",
    icon: Zap,
    color: "text-green-400",
    bg: "bg-green-500/15 border-green-500/30",
  },
  {
    key: "balanced",
    label: "BAL",
    icon: Crosshair,
    color: "text-blue-400",
    bg: "bg-blue-500/15 border-blue-500/30",
  },
  {
    key: "safe",
    label: "SAFE",
    icon: Shield,
    color: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/30",
  },
];

export interface PlayModeChipsProps {
  selected: PlayMode;
  /** When `selected` is "auto", this is the resolved mode used downstream. */
  effective?: PlayMode;
  /** Called with the clicked mode key. Consumer decides toggle behavior. */
  onChange: (mode: PlayMode) => void;
}

export function PlayModeChips({
  selected,
  effective,
  onChange,
}: PlayModeChipsProps) {
  return (
    <div className="flex gap-1">
      {MODES.map((m) => {
        const isSelected = selected === m.key;
        const isEffective =
          selected === "auto" && m.key !== "auto" && effective === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold border transition-colors",
              isSelected
                ? m.bg + " " + m.color
                : isEffective
                  ? m.bg + " " + m.color + " opacity-60"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300",
            )}
          >
            <m.icon className="w-3 h-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
