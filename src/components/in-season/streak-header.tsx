"use client";

import { Trophy } from "lucide-react";
import type { InSeasonStreak, InSeasonThreshold } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { cn } from "@/lib/utils";

export function StreakHeader({
  streak,
}: {
  streak: InSeasonStreak | null;
}) {
  const targetThreshold = useInSeasonStore((s) => s.targetThreshold);
  const setTargetThreshold = useInSeasonStore((s) => s.setTargetThreshold);

  if (!streak || streak.thresholds.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex gap-1.5 flex-wrap">
        {streak.thresholds.map((t) => {
          const isTarget = targetThreshold?.level === t.level;
          return (
            <button
              key={t.level}
              onClick={() => setTargetThreshold(isTarget ? null : t)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-all border",
                t.isCleared
                  ? "bg-green-500/15 text-green-400 border-green-500/20"
                  : isTarget
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20"
                    : t.isCurrent
                      ? "bg-amber-500/10 text-amber-400/80 border-amber-500/20"
                      : "bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-400",
              )}
            >
              {t.score}
              {t.reward && (
                <span className="ml-1 opacity-70">{t.reward}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
