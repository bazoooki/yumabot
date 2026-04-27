"use client";

import { Zap } from "lucide-react";
import type { InSeasonStreak, InSeasonThreshold } from "@/lib/types";
import { STREAK_LEVELS } from "@/lib/lineup-store";
import { cn } from "@/lib/utils";
import { TONE } from "./tones";

interface ThresholdStripProps {
  streak: InSeasonStreak | null;
  targetIdx: number;
  onTargetChange(i: number): void;
}

const FALLBACK_THRESHOLDS: InSeasonThreshold[] = STREAK_LEVELS.map((l) => ({
  level: l.level,
  score: l.threshold,
  reward: l.reward,
  isCleared: false,
  isCurrent: false,
}));

export function ThresholdStrip({
  streak,
  targetIdx,
  onTargetChange,
}: ThresholdStripProps) {
  const thresholds =
    streak?.thresholds && streak.thresholds.length > 0
      ? streak.thresholds
      : FALLBACK_THRESHOLDS;
  const safeIdx = Math.min(Math.max(targetIdx, 0), thresholds.length - 1);

  return (
    <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center gap-2 flex-wrap">
      <Zap className="w-3.5 h-3.5 text-amber-400" />
      <span className="mono text-[10px] uppercase tracking-wider text-zinc-500">
        Target
      </span>
      <div className="flex items-center gap-1">
        {thresholds.map((th, i) => (
          <button
            key={`${th.score}-${i}`}
            type="button"
            onClick={() => onTargetChange(i)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md border mono text-[10px] font-bold tabular-nums transition-all",
              i === safeIdx
                ? `${TONE.pink.border} ${TONE.pink.bg} ${TONE.pink.text}`
                : th.isCleared
                  ? "border-emerald-700/40 bg-emerald-900/10 text-emerald-400/70 hover:text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200",
            )}
            title={
              th.isCleared
                ? "Cleared"
                : th.isCurrent
                  ? "Current target"
                  : undefined
            }
          >
            {th.score}
            <span className="mono text-[9px] text-zinc-500 font-normal">
              {th.reward}
            </span>
          </button>
        ))}
      </div>
      <span className="ml-auto mono text-[10px] text-zinc-500">
        +50% captain · 4 of 5 must be in-season
      </span>
    </div>
  );
}
