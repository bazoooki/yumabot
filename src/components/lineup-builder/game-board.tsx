"use client";

import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";

export function GameBoard() {
  const { currentLevel, setCurrentLevel } = useLineupStore();

  return (
    <div className="px-4 py-2.5 border-b border-zinc-800">
      <div className="relative flex items-center">
        {/* Connecting line */}
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px bg-zinc-700 z-0" />
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 h-px bg-purple-500 z-0 transition-all duration-300"
          style={{
            width: `${((currentLevel - 1) / (STREAK_LEVELS.length - 1)) * 100}%`,
            maxWidth: "calc(100% - 24px)",
          }}
        />

        {STREAK_LEVELS.map((lvl) => {
          const isActive = lvl.level === currentLevel;
          const isPast = lvl.level < currentLevel;
          const isFinal = lvl.level === 6;

          return (
            <button
              key={lvl.level}
              onClick={() => setCurrentLevel(lvl.level)}
              className={cn(
                "relative z-10 flex-1 flex flex-col items-center gap-0.5 py-1 rounded transition-all",
                "hover:bg-zinc-800/50",
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  isActive
                    ? "bg-purple-500 border-purple-400 text-white shadow-md shadow-purple-500/30"
                    : isPast
                      ? "bg-purple-500/30 border-purple-500/50 text-purple-300"
                      : "bg-zinc-800 border-zinc-600 text-zinc-500",
                  isFinal && isActive && "bg-amber-500 border-amber-400 shadow-amber-500/30"
                )}
              >
                {lvl.level}
              </div>
              <span className={cn(
                "text-[10px] font-semibold",
                isActive ? "text-white" : "text-zinc-600"
              )}>
                {lvl.threshold}
              </span>
              <span className={cn(
                "text-[9px] font-medium",
                isActive ? (isFinal ? "text-amber-400" : "text-green-400") : "text-zinc-700"
              )}>
                {lvl.reward}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
