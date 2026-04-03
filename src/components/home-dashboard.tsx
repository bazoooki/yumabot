"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { scoreCardsWithStrategy, getStrategyMode, estimateTotalScore } from "@/lib/ai-lineup";
import { useLiveScores } from "@/lib/hooks";
import type { SorareCard } from "@/lib/types";
import {
  Flame, Trophy, Target, Clock, Zap, Shield,
  ChevronRight, Users, Swords, TrendingUp, BarChart3,
} from "lucide-react";
import { formatKickoffTime, getKickoffUrgency, groupByKickoffWindow, getMergeWindowForLevel } from "@/lib/utils";

interface HomeDashboardProps {
  cards: SorareCard[];
  onNavigate: (tab: "lineup" | "strategy" | "gallery") => void;
}

export function HomeDashboard({ cards, onNavigate }: HomeDashboardProps) {
  const { currentLevel, slots, targetScore } = useLineupStore();
  const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
  const mode = getStrategyMode(currentLevel);
  const { isAnyGameLive, allGamesFinished, actualTotal, projectedTotal, filledCount } = useLiveScores();
  const hasLineup = slots.some((s) => s.card);

  // Quick stats
  const stats = useMemo(() => {
    const withGame = cards.filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.length);
    const uniquePlayers = new Set(withGame.map((c) => c.anyPlayer?.slug)).size;
    return { totalCards: cards.length, playersWithGame: uniquePlayers };
  }, [cards]);

  // Next games
  const nextBatches = useMemo(() => {
    const wrapped = cards
      .filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.[0])
      .map((card) => ({ card }));
    const groups = groupByKickoffWindow(wrapped, getMergeWindowForLevel(currentLevel));
    return groups.slice(0, 3);
  }, [cards, currentLevel]);

  // Top 5 players for current level
  const topPlayers = useMemo(() => {
    const scored = scoreCardsWithStrategy(cards, currentLevel);
    const seen = new Set<string>();
    const unique = scored.filter((sc) => {
      const slug = sc.card.anyPlayer?.slug;
      if (!slug || seen.has(slug) || !sc.hasGame) return false;
      seen.add(slug);
      return true;
    });
    return unique.slice(0, 5);
  }, [cards, currentLevel]);

  // EV
  const cumulativeEarned = STREAK_LEVELS
    .filter((l) => l.level < currentLevel)
    .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/60 via-indigo-950/40 to-zinc-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
        <div className="relative px-8 py-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Flame className="w-8 h-8 text-amber-400" />
                <h1 className="text-3xl font-bold text-white">YumaBot</h1>
              </div>
              <p className="text-sm text-zinc-400 max-w-md">
                Your Hot Streak command center. {stats.totalCards} cards, {stats.playersWithGame} players with upcoming games.
              </p>
            </div>

            {/* Current streak status */}
            <div className="text-right">
              <div className="flex items-center gap-3 justify-end mb-2">
                <div className={cn(
                  "px-3 py-1.5 rounded-lg border text-xs font-bold",
                  mode === "floor" ? "bg-green-500/15 border-green-500/30 text-green-400" :
                  mode === "balanced" ? "bg-blue-500/15 border-blue-500/30 text-blue-400" :
                  "bg-amber-500/15 border-amber-500/30 text-amber-400"
                )}>
                  {mode === "floor" ? "FAST" : mode === "balanced" ? "BALANCED" : "SAFE"} MODE
                </div>
              </div>
              <p className="text-2xl font-bold text-white">Level {currentLevel}</p>
              <p className="text-sm text-zinc-400">{streakLevel?.threshold} pts for {streakLevel?.reward}</p>
              {cumulativeEarned > 0 && (
                <p className="text-xs text-green-400 mt-1">Earned so far: ${cumulativeEarned}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Live Status (if active) */}
        {(isAnyGameLive || allGamesFinished) && hasLineup && (
          <div className={cn(
            "rounded-xl border p-5",
            allGamesFinished
              ? actualTotal >= targetScore ? "bg-green-900/10 border-green-500/20" : "bg-red-900/10 border-red-500/20"
              : "bg-green-900/5 border-green-500/20"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isAnyGameLive && <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />}
                <div>
                  <p className="text-sm font-bold text-white">
                    {allGamesFinished
                      ? actualTotal >= targetScore ? "Level Cleared!" : "Streak Reset"
                      : "Games in Progress"
                    }
                  </p>
                  <p className="text-xs text-zinc-400">
                    {actualTotal} pts actual{projectedTotal > actualTotal ? ` + ~${projectedTotal - actualTotal} projected` : ""} / {targetScore} target
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate("lineup")}
                className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                View Live <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate("lineup")}
            className="group p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-purple-500/30 transition-all text-left"
          >
            <Target className="w-6 h-6 text-purple-400 mb-3" />
            <p className="text-sm font-bold text-white">Build Lineup</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {hasLineup ? `${filledCount}/5 players set` : "Pick your 5 players"}
            </p>
            <ChevronRight className="w-4 h-4 text-zinc-600 mt-3 group-hover:text-purple-400 transition-colors" />
          </button>

          <button
            onClick={() => onNavigate("strategy")}
            className="group p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-purple-500/30 transition-all text-left"
          >
            <BarChart3 className="w-6 h-6 text-blue-400 mb-3" />
            <p className="text-sm font-bold text-white">Strategy</p>
            <p className="text-[11px] text-zinc-500 mt-1">Game batches, power rankings, EV analysis</p>
            <ChevronRight className="w-4 h-4 text-zinc-600 mt-3 group-hover:text-blue-400 transition-colors" />
          </button>

          <button
            onClick={() => onNavigate("gallery")}
            className="group p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all text-left"
          >
            <Users className="w-6 h-6 text-zinc-400 mb-3" />
            <p className="text-sm font-bold text-white">Gallery</p>
            <p className="text-[11px] text-zinc-500 mt-1">{stats.totalCards} cards in your collection</p>
            <ChevronRight className="w-4 h-4 text-zinc-600 mt-3 group-hover:text-zinc-400 transition-colors" />
          </button>
        </div>

        {/* Two columns: Streak Progress + Next Games */}
        <div className="grid grid-cols-2 gap-6">
          {/* Streak Progression */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Streak Progress</h2>
            </div>
            <div className="space-y-2">
              {STREAK_LEVELS.map((lvl) => {
                const isCurrent = lvl.level === currentLevel;
                const isPast = lvl.level < currentLevel;
                return (
                  <div
                    key={lvl.level}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg",
                      isCurrent ? "bg-purple-500/10 border border-purple-500/20" : ""
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                      isCurrent ? "bg-purple-500 border-purple-400 text-white" :
                      isPast ? "bg-green-500/20 border-green-500/30 text-green-400" :
                      "bg-zinc-800 border-zinc-700 text-zinc-500"
                    )}>
                      {lvl.level}
                    </div>
                    <span className="text-xs text-zinc-400 flex-1">{lvl.threshold} pts</span>
                    <span className={cn(
                      "text-xs font-bold",
                      isCurrent ? "text-white" : isPast ? "text-green-400/60" : "text-zinc-600"
                    )}>
                      {lvl.reward}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Games */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Next Games</h2>
            </div>
            {nextBatches.length === 0 ? (
              <p className="text-xs text-zinc-500">No upcoming games</p>
            ) : (
              <div className="space-y-3">
                {nextBatches.map((batch, i) => {
                  const urgency = batch.kickoffTime.getTime() > 0
                    ? getKickoffUrgency(batch.kickoffTime.toISOString())
                    : "later";
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
                      {urgency === "imminent" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                      {urgency === "soon" && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />}
                      {urgency === "later" && <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-300 truncate">{batch.windowLabel}</p>
                        <p className="text-[10px] text-zinc-500">{batch.items.length} players available</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top 5 quick view */}
            <div className="mt-5 pt-4 border-t border-zinc-700/50">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <p className="text-xs font-bold text-zinc-300">Best 5 for Level {currentLevel}</p>
              </div>
              <div className="space-y-1.5">
                {topPlayers.map((sc, i) => {
                  const player = sc.card.anyPlayer!;
                  return (
                    <div key={sc.card.slug} className="flex items-center gap-2 text-[11px]">
                      <span className={cn("font-bold w-4 text-center", i < 3 ? "text-amber-400" : "text-zinc-500")}>{i + 1}</span>
                      <span className="text-zinc-300 truncate flex-1">{player.displayName}</span>
                      <span className={cn(
                        "font-bold",
                        sc.strategy.expectedScore >= 60 ? "text-green-400" :
                        sc.strategy.expectedScore >= 40 ? "text-yellow-400" : "text-zinc-400"
                      )}>
                        {Math.round(sc.strategy.expectedScore)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
