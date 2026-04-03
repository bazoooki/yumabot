"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  Trophy, TrendingUp, Clock, Shield, Zap, Crown,
  AlertTriangle, Target, ChevronRight, Flame,
} from "lucide-react";
import { cn, groupByKickoffWindow, getMergeWindowForLevel, formatKickoffTime, formatKickoffDate, getKickoffUrgency } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import {
  scoreCardsWithStrategy,
  evaluateTimeBatch,
  evaluate4PlayerViability,
  getStrategyMode,
  getStrategyRecommendation,
  getEditionInfo,
} from "@/lib/ai-lineup";
import type { SorareCard, Position, StrategyTag, ScoredCardWithStrategy } from "@/lib/types";

interface StrategyDashboardProps {
  cards: SorareCard[];
}

// --- Sub-components ---

function SectionHeader({ icon: Icon, title, subtitle, color = "text-purple-400" }: {
  icon: typeof Trophy;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("p-2 rounded-lg bg-zinc-800/80", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}

const STRATEGY_TAG_COLORS: Record<StrategyTag, { text: string; bg: string; border: string }> = {
  SAFE: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  BALANCED: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  CEILING: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  RISKY: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

// --- Main Component ---

export function StrategyDashboard({ cards }: StrategyDashboardProps) {
  const { currentLevel, mergeWindow, setMergeWindow } = useLineupStore();
  const mode = getStrategyMode(currentLevel);
  const effectiveMergeWindow = mergeWindow ?? getMergeWindowForLevel(currentLevel);

  // Score all cards at current level
  const scoredCards = useMemo(() => scoreCardsWithStrategy(cards, currentLevel), [cards, currentLevel]);

  // Top 15 players
  const topPlayers = useMemo(() => {
    const seen = new Set<string>();
    const unique: ScoredCardWithStrategy[] = [];
    for (const sc of scoredCards) {
      const slug = sc.card.anyPlayer?.slug;
      if (!slug || seen.has(slug)) continue;
      if (!sc.hasGame) continue;
      seen.add(slug);
      unique.push(sc);
      if (unique.length >= 15) break;
    }
    return unique;
  }, [scoredCards]);

  // Game time batches
  const timeBatches = useMemo(() => {
    const wrapped = scoredCards.filter((sc) => sc.hasGame);
    const groups = groupByKickoffWindow(wrapped, effectiveMergeWindow);
    return groups.map((g) => {
      const batchCards = g.items.map((i) => i.card);
      const { expectedTotal } = evaluateTimeBatch(batchCards, currentLevel);
      return { ...g, expectedTotal, playerCount: batchCards.length };
    });
  }, [scoredCards, currentLevel, effectiveMergeWindow]);

  // Level-by-level playbook
  const playbook = useMemo(() => {
    return STREAK_LEVELS.map((lvl) => {
      const scored = scoreCardsWithStrategy(cards, lvl.level);
      const topForLevel = scored.filter((s) => s.hasGame).slice(0, 5);
      const totalExpected = topForLevel.reduce((s, c) => s + c.strategy.expectedScore, 0);
      // Captain bonus on top scorer
      const captainBonus = topForLevel.length > 0
        ? Math.max(...topForLevel.map((c) => c.strategy.expectedScore)) * 0.5
        : 0;
      const withCaptain = totalExpected + captainBonus;
      const meetsThreshold = withCaptain >= lvl.threshold;
      return {
        ...lvl,
        topCards: topForLevel,
        expectedTotal: Math.round(withCaptain),
        meetsThreshold,
        mode: getStrategyMode(lvl.level),
        recommendation: getStrategyRecommendation(lvl.level),
      };
    });
  }, [cards]);

  // 4-player viability
  const viability = useMemo(() => {
    if (currentLevel > 3) return null;
    const positions: Position[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
    const checks = positions.map((pos) => ({
      skipPosition: pos,
      ...evaluate4PlayerViability(cards, currentLevel, pos),
    }));
    const bestOption = checks.reduce((a, b) => a.expectedTotal > b.expectedTotal ? a : b);
    return { checks, bestOption };
  }, [cards, currentLevel]);

  // EV analysis
  const evAnalysis = useMemo(() => {
    const cumulativeEarned = STREAK_LEVELS
      .filter((l) => l.level < currentLevel)
      .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);
    const currentReward = parseFloat(STREAK_LEVELS[currentLevel - 1].reward.replace(/[$,]/g, ""));
    const remainingRewards = STREAK_LEVELS
      .filter((l) => l.level >= currentLevel)
      .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);

    return { cumulativeEarned, currentReward, remainingRewards };
  }, [currentLevel]);

  // Stats summary
  const stats = useMemo(() => {
    const withGame = scoredCards.filter((sc) => sc.hasGame);
    const avgScore = withGame.length > 0
      ? withGame.reduce((s, c) => s + (c.card.anyPlayer?.averageScore || 0), 0) / withGame.length
      : 0;
    const tagCounts = { SAFE: 0, BALANCED: 0, CEILING: 0, RISKY: 0 };
    for (const sc of withGame.slice(0, 50)) {
      tagCounts[sc.strategy.strategyTag]++;
    }
    return { totalWithGame: withGame.length, avgScore, tagCounts };
  }, [scoredCards]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/60 via-indigo-950/40 to-zinc-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-6 h-6 text-amber-400" />
                <h1 className="text-2xl font-bold text-white">Hot Streak Strategy</h1>
              </div>
              <p className="text-sm text-zinc-400 max-w-lg">
                Your personalized game plan based on {stats.totalWithGame} eligible players and current level {currentLevel} ({STREAK_LEVELS[currentLevel - 1].threshold} pts target).
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              <div className="text-center px-4 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 backdrop-blur-sm">
                <p className="text-2xl font-bold text-white">{stats.totalWithGame}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Players</p>
              </div>
              <div className="text-center px-4 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 backdrop-blur-sm">
                <p className="text-2xl font-bold text-purple-400">{Math.round(stats.avgScore)}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Score</p>
              </div>
              <div className="text-center px-4 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 backdrop-blur-sm">
                <p className={cn(
                  "text-2xl font-bold",
                  mode === "floor" ? "text-green-400" : mode === "balanced" ? "text-blue-400" : "text-amber-400"
                )}>
                  {mode === "floor" ? "FAST" : mode === "balanced" ? "BAL" : "SAFE"}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Mode</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* Row 1: Streak Progression + EV Analysis */}
        <div className="grid grid-cols-3 gap-6">
          {/* Streak Progression */}
          <div className="col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <SectionHeader icon={Trophy} title="Streak Progression" subtitle="Expected performance at each level" color="text-amber-400" />

            <div className="space-y-2">
              {playbook.map((lvl) => {
                const isCurrentLevel = lvl.level === currentLevel;
                const isPast = lvl.level < currentLevel;
                const progressPct = Math.min(100, (lvl.expectedTotal / lvl.threshold) * 100);

                return (
                  <div
                    key={lvl.level}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border transition-all",
                      isCurrentLevel
                        ? "bg-purple-500/5 border-purple-500/30"
                        : isPast
                          ? "bg-green-500/3 border-green-500/10"
                          : "bg-zinc-800/30 border-zinc-800"
                    )}
                  >
                    {/* Level badge */}
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0",
                      isCurrentLevel
                        ? "bg-purple-500 border-purple-400 text-white"
                        : isPast
                          ? "bg-green-500/20 border-green-500/40 text-green-400"
                          : "bg-zinc-800 border-zinc-600 text-zinc-500"
                    )}>
                      {lvl.level}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-300">{lvl.threshold} pts</span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            lvl.mode === "floor" ? "bg-green-500/15 text-green-400" :
                            lvl.mode === "balanced" ? "bg-blue-500/15 text-blue-400" :
                            "bg-amber-500/15 text-amber-400"
                          )}>
                            {lvl.mode === "floor" ? "FAST" : lvl.mode === "balanced" ? "BAL" : "SAFE"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-bold",
                            lvl.meetsThreshold ? "text-green-400" : "text-red-400"
                          )}>
                            ~{lvl.expectedTotal} pts
                          </span>
                          <span className={cn(
                            "text-sm font-bold",
                            isCurrentLevel ? "text-white" : "text-zinc-600"
                          )}>
                            {lvl.reward}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            lvl.meetsThreshold
                              ? "bg-gradient-to-r from-green-500 to-green-400"
                              : progressPct >= 80
                                ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                                : "bg-gradient-to-r from-red-500 to-red-400"
                          )}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {isCurrentLevel && (
                      <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* EV Analysis */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <SectionHeader icon={TrendingUp} title="Expected Value" subtitle="Risk vs reward analysis" color="text-green-400" />

            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Already earned</span>
                  <span className="text-sm font-bold text-green-400">${evAnalysis.cumulativeEarned}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Current level prize</span>
                  <span className="text-sm font-bold text-white">${evAnalysis.currentReward}</span>
                </div>
                <div className="h-px bg-zinc-700" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Remaining potential</span>
                  <span className="text-sm font-bold text-purple-400">${evAnalysis.remainingRewards}</span>
                </div>
              </div>

              {/* Risk warning */}
              <div className={cn(
                "rounded-lg p-4 border",
                currentLevel <= 2
                  ? "bg-green-900/10 border-green-500/20"
                  : currentLevel <= 4
                    ? "bg-yellow-900/10 border-yellow-500/20"
                    : "bg-red-900/10 border-red-500/20"
              )}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={cn(
                    "w-4 h-4 shrink-0 mt-0.5",
                    currentLevel <= 2 ? "text-green-400" : currentLevel <= 4 ? "text-yellow-400" : "text-red-400"
                  )} />
                  <div>
                    <p className={cn(
                      "text-xs font-bold mb-1",
                      currentLevel <= 2 ? "text-green-400" : currentLevel <= 4 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {currentLevel <= 2 ? "Low Risk" : currentLevel <= 4 ? "Moderate Risk" : "High Stakes"}
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {currentLevel <= 2
                        ? `Missing this level only costs $${evAnalysis.cumulativeEarned}. Play fast and aggressive.`
                        : currentLevel <= 4
                          ? `You've earned $${evAnalysis.cumulativeEarned} so far. A miss resets everything. Be careful with player selection.`
                          : `$${evAnalysis.cumulativeEarned} on the line plus $${evAnalysis.currentReward} prize. Only use confirmed starters with high scores.`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Squad composition */}
              <div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Squad Composition</p>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(stats.tagCounts) as [StrategyTag, number][]).map(([tag, count]) => (
                    <div key={tag} className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg border",
                      STRATEGY_TAG_COLORS[tag].bg, STRATEGY_TAG_COLORS[tag].border
                    )}>
                      <span className={cn("text-[11px] font-bold", STRATEGY_TAG_COLORS[tag].text)}>{tag}</span>
                      <span className="text-xs font-bold text-zinc-300">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Squad Power Rankings */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
          <SectionHeader icon={Target} title="Squad Power Rankings" subtitle={`Top 15 players for Level ${currentLevel} (${mode === "floor" ? "FAST" : mode === "balanced" ? "BALANCED" : "SAFE"} mode)`} color="text-purple-400" />

          <div className="grid grid-cols-1 gap-2">
            {topPlayers.map((sc, i) => {
              const player = sc.card.anyPlayer!;
              const editionInfo = getEditionInfo(sc.card);
              const power = parseFloat(sc.card.power) || 1;
              const powerBonus = power > 1 ? `+${Math.round((power - 1) * 100)}%` : null;
              const nextGame = player.activeClub?.upcomingGames?.[0];
              const maxScore = Math.max(...topPlayers.map((p) => p.strategy.expectedScore));
              const barWidth = maxScore > 0 ? (sc.strategy.expectedScore / maxScore) * 100 : 0;
              const tagColors = STRATEGY_TAG_COLORS[sc.strategy.strategyTag];

              return (
                <div
                  key={sc.card.slug}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all group relative overflow-hidden",
                    i < 5 ? "bg-purple-500/3 border-purple-500/10" : "bg-zinc-800/20 border-zinc-800/50"
                  )}
                >
                  {/* Score bar background */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 opacity-[0.04]",
                      i < 5 ? "bg-purple-400" : "bg-zinc-400"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />

                  {/* Rank */}
                  <span className={cn(
                    "text-sm font-bold w-7 text-center shrink-0 relative",
                    i < 3 ? "text-amber-400" : i < 5 ? "text-purple-400" : "text-zinc-500"
                  )}>
                    {i + 1}
                  </span>

                  {/* Card image */}
                  <div className="relative w-10 h-[52px] rounded overflow-hidden bg-zinc-800 shrink-0">
                    <Image
                      src={sc.card.pictureUrl}
                      alt={player.displayName}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>

                  {/* Player info */}
                  <div className="flex-1 min-w-0 relative">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{player.displayName}</span>
                      <span className="text-[10px] text-zinc-500">{player.activeClub?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">
                        {player.cardPositions?.[0]?.slice(0, 3).toUpperCase()}
                      </span>
                      {powerBonus && (
                        <span className="text-[10px] text-purple-400">{powerBonus}</span>
                      )}
                      {editionInfo.bonus > 0 && (
                        <span className="text-[10px] text-blue-400">{editionInfo.label}</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 shrink-0 relative">
                    {/* Floor/Ceiling mini bars */}
                    <div className="flex flex-col gap-0.5 w-16">
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-zinc-600">FLR</span>
                        <span className="text-zinc-400">{Math.round(sc.strategy.floor)}</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500/60 rounded-full"
                          style={{ width: `${Math.min(100, (sc.strategy.floor / 100) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px]">
                        <span className="text-zinc-600">CEIL</span>
                        <span className="text-zinc-400">{Math.round(sc.strategy.ceiling)}</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500/60 rounded-full"
                          style={{ width: `${Math.min(100, (sc.strategy.ceiling / 120) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Expected score */}
                    <div className="text-center w-14">
                      <p className={cn(
                        "text-base font-bold",
                        sc.strategy.expectedScore >= 60 ? "text-green-400" :
                        sc.strategy.expectedScore >= 40 ? "text-yellow-400" : "text-zinc-400"
                      )}>
                        {Math.round(sc.strategy.expectedScore)}
                      </p>
                      <p className="text-[9px] text-zinc-600">EXP PTS</p>
                    </div>

                    {/* Strategy tag */}
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded border",
                      tagColors.bg, tagColors.border, tagColors.text
                    )}>
                      {sc.strategy.strategyTag}
                    </span>

                    {/* Kickoff time */}
                    {nextGame && (
                      <div className="text-right w-14">
                        <p className={cn(
                          "text-[11px] font-bold",
                          getKickoffUrgency(nextGame.date) === "imminent" ? "text-green-400" :
                          getKickoffUrgency(nextGame.date) === "soon" ? "text-yellow-300" : "text-zinc-400"
                        )}>
                          {formatKickoffTime(nextGame.date)}
                        </p>
                        <p className="text-[9px] text-zinc-600">{formatKickoffDate(nextGame.date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3: Game Timeline + 4-Player Viability */}
        <div className="grid grid-cols-3 gap-6">
          {/* Game Day Timeline */}
          <div className="col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <SectionHeader icon={Clock} title="Game Day Planner" subtitle="Submit batches to chain rewards faster" color="text-blue-400" />
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-500">Merge window:</span>
                <input
                  type="range"
                  min={15}
                  max={480}
                  step={15}
                  value={effectiveMergeWindow}
                  onChange={(e) => setMergeWindow(Number(e.target.value))}
                  className="w-24 h-1 accent-blue-500 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:appearance-none"
                />
                <span className="text-[10px] font-bold text-zinc-300 w-10">
                  {effectiveMergeWindow >= 60 ? `${(effectiveMergeWindow / 60).toFixed(1)}h` : `${effectiveMergeWindow}m`}
                </span>
                {mergeWindow !== null && (
                  <button
                    onClick={() => setMergeWindow(null)}
                    className="text-[9px] text-zinc-500 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700"
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>

            {timeBatches.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No upcoming games in your collection</p>
            ) : (
              <div className="space-y-3">
                {timeBatches.map((batch, i) => {
                  const streakLevel = STREAK_LEVELS[currentLevel - 1];
                  const meetsTarget = batch.expectedTotal >= streakLevel.threshold;
                  const urgency = batch.kickoffTime.getTime() > 0
                    ? getKickoffUrgency(batch.kickoffTime.toISOString())
                    : "later";

                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border p-4 relative overflow-hidden",
                        meetsTarget
                          ? "bg-green-900/5 border-green-500/20"
                          : "bg-zinc-800/30 border-zinc-700/50"
                      )}
                    >
                      {/* Urgency strip */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
                        urgency === "imminent" ? "bg-green-400" :
                        urgency === "soon" ? "bg-yellow-400" : "bg-zinc-600"
                      )} />

                      <div className="pl-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {urgency === "imminent" && (
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            )}
                            <span className="text-sm font-bold text-white">{batch.windowLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {meetsTarget && (
                              <span className="text-[10px] font-bold text-green-400 bg-green-500/15 px-2 py-0.5 rounded">
                                CAN CLEAR L{currentLevel}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-[11px]">
                          <div>
                            <span className="text-zinc-500">Players: </span>
                            <span className="text-white font-semibold">{batch.playerCount}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Best 5 estimate: </span>
                            <span className={cn(
                              "font-bold",
                              meetsTarget ? "text-green-400" : "text-zinc-300"
                            )}>
                              ~{batch.expectedTotal} pts
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Target: </span>
                            <span className="text-zinc-400">{streakLevel.threshold} pts</span>
                          </div>
                        </div>

                        {/* Player avatars */}
                        <div className="flex items-center gap-1 mt-2">
                          {batch.items.slice(0, 8).map((sc) => (
                            <div
                              key={sc.card.slug}
                              className="relative w-8 h-8 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700"
                              title={sc.card.anyPlayer?.displayName}
                            >
                              <Image
                                src={sc.card.pictureUrl}
                                alt={sc.card.anyPlayer?.displayName || ""}
                                fill
                                className="object-cover"
                                sizes="32px"
                              />
                            </div>
                          ))}
                          {batch.items.length > 8 && (
                            <span className="text-[10px] text-zinc-500 ml-1">
                              +{batch.items.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4-Player + Captain & Level Playbook */}
          <div className="space-y-6">
            {/* 4-Player Viability */}
            {viability && (
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
                <SectionHeader icon={Crown} title="4-Player Hack" subtitle="Skip a position, use captain" color="text-amber-400" />

                <div className="space-y-2">
                  {viability.checks.map((check) => {
                    const isBest = check.skipPosition === viability.bestOption.skipPosition;
                    return (
                      <div
                        key={check.skipPosition}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-lg border",
                          check.viable && isBest
                            ? "bg-green-900/10 border-green-500/20"
                            : check.viable
                              ? "bg-green-900/5 border-green-500/10"
                              : "bg-zinc-800/30 border-zinc-700/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {isBest && check.viable && <Crown className="w-3 h-3 text-amber-400" />}
                          <span className="text-xs text-zinc-400">
                            Skip <span className="font-semibold text-zinc-300">{check.skipPosition}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-bold",
                            check.viable ? "text-green-400" : "text-zinc-600"
                          )}>
                            ~{check.expectedTotal} pts
                          </span>
                          {check.viable && (
                            <span className="text-[9px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">
                              OK
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {viability.bestOption.viable && (
                  <p className="text-[11px] text-zinc-500 mt-3">
                    Best: skip {viability.bestOption.skipPosition} + captain your top scorer = ~{viability.bestOption.expectedTotal} pts
                  </p>
                )}
              </div>
            )}

            {/* Current Level Strategy Card */}
            <div className={cn(
              "rounded-xl border p-5",
              mode === "floor"
                ? "bg-gradient-to-br from-green-950/20 to-zinc-900 border-green-500/20"
                : mode === "balanced"
                  ? "bg-gradient-to-br from-blue-950/20 to-zinc-900 border-blue-500/20"
                  : "bg-gradient-to-br from-amber-950/20 to-zinc-900 border-amber-500/20"
            )}>
              <SectionHeader
                icon={mode === "floor" ? Zap : Shield}
                title={`Level ${currentLevel} Playbook`}
                subtitle={`${STREAK_LEVELS[currentLevel - 1].threshold} pts for ${STREAK_LEVELS[currentLevel - 1].reward}`}
                color={mode === "floor" ? "text-green-400" : mode === "balanced" ? "text-blue-400" : "text-amber-400"}
              />
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {getStrategyRecommendation(currentLevel)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
