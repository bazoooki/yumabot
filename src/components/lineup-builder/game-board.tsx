"use client";

import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";

export function GameBoard() {
  const { currentLevel, setCurrentLevel } = useLineupStore();

  return (
    <div className="px-5 py-4 border-b border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Hot Streak Board
        </h3>
        <span className="text-[11px] text-zinc-500">
          Click a level to set your current position
        </span>
      </div>

      {/* 6-level progression */}
      <div className="relative flex items-center gap-1">
        {/* Connecting line */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-700 z-0" />
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-purple-500 to-purple-400 z-0 transition-all duration-300"
          style={{
            width: `${((currentLevel - 1) / (STREAK_LEVELS.length - 1)) * 100}%`,
            maxWidth: "calc(100% - 32px)",
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
                "relative z-10 flex-1 flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all",
                "hover:bg-zinc-800/50",
                isActive && "scale-105"
              )}
            >
              {/* Node */}
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                  isActive
                    ? "bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/40"
                    : isPast
                      ? "bg-purple-500/30 border-purple-500/50 text-purple-300"
                      : "bg-zinc-800 border-zinc-600 text-zinc-400",
                  isFinal && isActive && "bg-amber-500 border-amber-400 shadow-amber-500/40"
                )}
              >
                {lvl.level}
              </div>

              {/* Threshold */}
              <span
                className={cn(
                  "text-xs font-semibold",
                  isActive ? "text-white" : "text-zinc-500"
                )}
              >
                {lvl.threshold}
              </span>

              {/* Reward */}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isActive
                    ? isFinal
                      ? "text-amber-400"
                      : "text-purple-400"
                    : "text-zinc-600"
                )}
              >
                {lvl.reward}
              </span>
              {/* Mode label */}
              <span className={cn(
                "text-[9px] font-bold",
                lvl.level <= 2 ? "text-green-500/60" : lvl.level <= 3 ? "text-blue-500/60" : "text-amber-500/60",
                isActive && (lvl.level <= 2 ? "text-green-400" : lvl.level <= 3 ? "text-blue-400" : "text-amber-400"),
              )}>
                {lvl.level <= 2 ? "FAST" : lvl.level <= 3 ? "BAL" : "SAFE"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current level summary */}
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-xs text-zinc-400">
          Level <span className="text-white font-bold">{currentLevel}</span>
          {" — Need "}
          <span className="text-white font-bold">
            {STREAK_LEVELS[currentLevel - 1].threshold}
          </span>
          {" pts to claim "}
          <span
            className={cn(
              "font-bold",
              currentLevel === 6 ? "text-amber-400" : "text-green-400"
            )}
          >
            {STREAK_LEVELS[currentLevel - 1].reward}
          </span>
        </span>
        {currentLevel > 1 && (
          <span className="text-[11px] text-red-400/70">
            Miss = reset to Level 1
          </span>
        )}
      </div>
    </div>
  );
}
