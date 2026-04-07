"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { useLiveScores } from "@/lib/hooks";
import { POSITION_SHORT } from "@/lib/ui-config";
import { Clock, CheckCircle2, Radio, Crown, Trophy, XCircle } from "lucide-react";

export function LiveTracker() {
  const { slots, targetScore, currentLevel } = useLineupStore();
  const { scores, isAnyGameLive, allGamesFinished, actualTotal, projectedTotal, filledCount } = useLiveScores();
  const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
  const prevFinished = useRef(false);

  // Browser notification on completion
  useEffect(() => {
    if (allGamesFinished && !prevFinished.current && filledCount > 0) {
      prevFinished.current = true;
      if ("Notification" in window && Notification.permission === "granted") {
        const success = actualTotal >= targetScore;
        new Notification("Hot Streak Update", {
          body: success
            ? `${targetScore} cleared! ${actualTotal} pts. Submit next lineup!`
            : `Missed by ${targetScore - actualTotal} pts. Streak resets.`,
        });
      }
    }
    if (!allGamesFinished) {
      prevFinished.current = false;
    }
  }, [allGamesFinished, actualTotal, targetScore, currentLevel, filledCount]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default" && isAnyGameLive) {
      Notification.requestPermission();
    }
  }, [isAnyGameLive]);

  const filledSlots = slots.filter((s) => s.card);
  const progressPct = targetScore > 0 ? Math.min(100, (projectedTotal / targetScore) * 100) : 0;
  const actualPct = targetScore > 0 ? Math.min(100, (actualTotal / targetScore) * 100) : 0;

  const statusLabel = projectedTotal >= targetScore
    ? "ON TRACK"
    : projectedTotal >= targetScore * 0.85
      ? "AT RISK"
      : "UNLIKELY";

  const statusColor = statusLabel === "ON TRACK"
    ? "text-green-400 bg-green-500/15 border-green-500/30"
    : statusLabel === "AT RISK"
      ? "text-yellow-400 bg-yellow-500/15 border-yellow-500/30"
      : "text-red-400 bg-red-500/15 border-red-500/30";

  if (filledCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Radio className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-500">No lineup set</p>
          <p className="text-xs text-zinc-600">Fill your lineup in the Cards tab, then come here to track live scores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Completion Banner */}
      {allGamesFinished && (
        <div className={cn(
          "rounded-xl border p-4 text-center space-y-2",
          actualTotal >= targetScore
            ? "bg-green-900/20 border-green-500/30"
            : "bg-red-900/20 border-red-500/30"
        )}>
          {actualTotal >= targetScore ? (
            <>
              <Trophy className="w-8 h-8 text-green-400 mx-auto" />
              <p className="text-sm font-bold text-green-400">{targetScore} CLEARED!</p>
              <p className="text-xs text-zinc-400">
                {actualTotal} pts — Earned {streakLevel?.reward}. Submit your next lineup now!
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-bold text-red-400">MISSED BY {targetScore - actualTotal} PTS</p>
              <p className="text-xs text-zinc-400">
                {actualTotal} / {targetScore} pts. Streak resets to Level 1.
              </p>
            </>
          )}
        </div>
      )}

      {/* Score Progress */}
      <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAnyGameLive && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded border",
              statusColor
            )}>
              {statusLabel}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            Target: {targetScore} pts
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-zinc-900 rounded-full overflow-hidden">
          {/* Projected (lighter) */}
          <div
            className="absolute inset-y-0 left-0 bg-green-500/30 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
          {/* Actual (solid) */}
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${actualPct}%` }}
          />
          {/* Target marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/60"
            style={{ left: `${Math.min(100, (targetScore / Math.max(targetScore, projectedTotal) * 100))}%` }}
          />
        </div>

        {/* Numbers */}
        <div className="flex items-center justify-between text-[11px]">
          <div>
            <span className="text-zinc-500">Actual: </span>
            <span className="font-bold text-white">{actualTotal}</span>
            {projectedTotal > actualTotal && (
              <>
                <span className="text-zinc-600"> + </span>
                <span className="text-zinc-400">~{projectedTotal - actualTotal}</span>
              </>
            )}
          </div>
          <div>
            <span className="text-zinc-500">= </span>
            <span className={cn(
              "font-bold",
              projectedTotal >= targetScore ? "text-green-400" : "text-red-400"
            )}>
              ~{projectedTotal}
            </span>
            <span className="text-zinc-600"> / {targetScore}</span>
          </div>
        </div>
      </div>

      {/* Per-Player Rows */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider px-1">Player Scores</p>

        {filledSlots.map((slot) => {
          const player = slot.card!.anyPlayer!;
          const slug = player.slug;
          const ls = scores[slug];
          const position = player.cardPositions?.[0] || "Unknown";
          const posShort = POSITION_SHORT[position] || "??";
          const isCaptain = slot.isCaptain;

          const isPlaying = ls?.scoreStatus === "PLAYING" || ls?.gameStatus === "playing";
          const isFinal = ls?.scoreStatus === "FINAL" || ls?.gameStatus === "played";
          const isScheduled = !isPlaying && !isFinal;

          const displayScore = ls ? ls.score : 0;
          const projScore = ls?.projectedScore;
          const mins = ls?.minsPlayed ?? 0;

          return (
            <div
              key={slot.card!.slug}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                isPlaying
                  ? "bg-green-900/10 border-green-500/20"
                  : isFinal
                    ? "bg-zinc-800/30 border-zinc-700/30"
                    : "bg-zinc-800/50 border-zinc-700/50"
              )}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {isPlaying ? (
                  <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </span>
                ) : isFinal ? (
                  <CheckCircle2 className="w-5 h-5 text-zinc-500" />
                ) : (
                  <Clock className="w-5 h-5 text-zinc-600" />
                )}
              </div>

              {/* Player image */}
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                <Image src={slot.card!.pictureUrl} alt="" fill className="object-cover object-top scale-125" sizes="32px" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-1 rounded">{posShort}</span>
                  <span className="text-[12px] font-semibold text-zinc-200 truncate">{player.displayName}</span>
                  {isCaptain && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
                  {ls && <span>{ls.homeTeam} vs {ls.awayTeam}</span>}
                  {isPlaying && mins > 0 && <span className="text-green-400">{mins}&apos;</span>}
                </div>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                {isScheduled ? (
                  <span className="text-sm text-zinc-600">--</span>
                ) : (
                  <>
                    <span className={cn(
                      "text-base font-bold",
                      isFinal
                        ? displayScore >= 50 ? "text-green-400" : displayScore >= 30 ? "text-yellow-400" : "text-red-400"
                        : "text-white"
                    )}>
                      {Math.round(displayScore * (isCaptain ? 1.5 : 1))}
                    </span>
                    {isCaptain && <span className="text-[9px] text-amber-400 ml-0.5">C</span>}
                    {isPlaying && projScore && (
                      <p className="text-[10px] text-zinc-500">
                        proj ~{Math.round(projScore * (isCaptain ? 1.5 : 1))}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
