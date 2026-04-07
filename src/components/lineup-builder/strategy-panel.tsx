"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { cn, groupByKickoffWindow, getMergeWindowForLevel, formatKickoffTime, getKickoffUrgency } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS, type PlayMode } from "@/lib/lineup-store";
import {
  getStrategyRecommendation,
  evaluateTimeBatch,
  evaluate4PlayerViability,
  estimateTotalScore,
  getStrategyMode,
  scoreCardsWithStrategy,
} from "@/lib/ai-lineup";
import { usePlayerIntel } from "@/lib/hooks";
import type { SorareCard, Position, StrategyTag, ScoredCardWithStrategy } from "@/lib/types";
import { STRATEGY_TAG_STYLES } from "@/lib/ui-config";
import { Sparkles, Clock, Shield, AlertTriangle, Crown, Zap, Crosshair, SlidersHorizontal, TrendingUp, ChevronDown, ChevronRight, Users, Target, CheckCircle2 } from "lucide-react";

interface StrategyPanelProps {
  cards: SorareCard[];
}

export function StrategyPanel({ cards }: StrategyPanelProps) {
  const {
    slots, currentLevel, targetScore, lineupProbability,
    autoFillWithStrategy, mergeWindow, setMergeWindow,
    playMode, setPlayMode,
  } = useLineupStore();
  const effectiveMergeWindow = mergeWindow ?? getMergeWindowForLevel(currentLevel);
  const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
  const mode = getStrategyMode(currentLevel);
  const recommendation = getStrategyRecommendation(currentLevel);

  const effectiveMode = playMode !== "auto" ? playMode : (currentLevel <= 2 ? "fast" : currentLevel <= 3 ? "balanced" : "safe");

  // Player intel for warnings
  const playerIntel = usePlayerIntel(cards);

  const captainIndex = slots.findIndex((s) => s.isCaptain);
  const filledCards = slots.map((s) => s.card);
  const filledCount = filledCards.filter(Boolean).length;
  const totalEstimate = estimateTotalScore(filledCards, captainIndex >= 0 ? captainIndex : undefined);

  // Expanded batch tracking
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);

  // EV
  const cumulativeEarned = STREAK_LEVELS
    .filter((l) => l.level < currentLevel)
    .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);
  const currentReward = parseFloat(STREAK_LEVELS[currentLevel - 1].reward.replace(/[$,]/g, ""));

  // Time batches with best 5 players
  const timeBatches = useMemo(() => {
    const wrapped = cards
      .filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.[0])
      .map((card) => ({ card }));
    const groups = groupByKickoffWindow(wrapped, effectiveMergeWindow);

    return groups.map((group) => {
      const groupCards = group.items.map((i) => i.card);
      const { expectedTotal, bestCards } = evaluateTimeBatch(groupCards, currentLevel);
      const viable = bestCards.length >= 4 && expectedTotal >= targetScore;

      // Get unique games in this batch
      const games = new Map<string, { home: string; away: string; date: string; competition: string }>();
      for (const item of group.items) {
        const g = item.card.anyPlayer?.activeClub?.upcomingGames?.[0];
        if (!g) continue;
        const key = `${g.homeTeam.code}-${g.awayTeam.code}`;
        if (!games.has(key)) {
          games.set(key, { home: g.homeTeam.code, away: g.awayTeam.code, date: g.date, competition: g.competition.name });
        }
      }

      // All scored cards for this batch (for the expanded view)
      const allScored = scoreCardsWithStrategy(groupCards, currentLevel);
      // Dedup by player
      const seen = new Set<string>();
      const uniqueScored = allScored.filter((sc) => {
        const slug = sc.card.anyPlayer?.slug;
        if (!slug || seen.has(slug)) return false;
        seen.add(slug);
        return true;
      });

      // Position breakdown
      const posCount = { Goalkeeper: 0, Defender: 0, Midfielder: 0, Forward: 0 };
      for (const sc of uniqueScored) {
        const pos = sc.card.anyPlayer?.cardPositions?.[0];
        if (pos && pos in posCount) posCount[pos as keyof typeof posCount]++;
      }

      return {
        ...group,
        expectedTotal,
        playerCount: uniqueScored.length,
        viable,
        bestCards,
        allPlayers: uniqueScored,
        games: Array.from(games.values()),
        posCount,
      };
    });
  }, [cards, currentLevel, targetScore, effectiveMergeWindow]);

  // 4-player viability
  const viabilityChecks = useMemo(() => {
    if (currentLevel > 3) return [];
    const positions: Position[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
    return positions.map((pos) => {
      const result = evaluate4PlayerViability(cards, currentLevel, pos);
      return { skipPosition: pos, ...result };
    });
  }, [cards, currentLevel]);

  // Warnings + confirmed count
  const { lineupWarnings, confirmedCount } = useMemo(() => {
    const warnings: string[] = [];
    let confirmed = 0;
    if (captainIndex < 0 && filledCount > 0) {
      warnings.push("No captain assigned -- tap the crown on a player");
    }
    for (const slot of slots) {
      if (!slot.card) continue;
      const player = slot.card.anyPlayer;
      if (!player?.activeClub?.upcomingGames?.length) {
        warnings.push(`${player?.displayName || "Unknown"} has no upcoming game`);
      }
      const intel = player?.slug && playerIntel ? playerIntel[player.slug] : undefined;
      if (intel) {
        if (intel.fieldStatus === "INJURED") {
          warnings.push(`${player?.displayName} is INJURED — will score 0 pts`);
        } else if (intel.fieldStatus === "SUSPENDED") {
          warnings.push(`${player?.displayName} is SUSPENDED — will score 0 pts`);
        } else if (intel.fieldStatus === "NOT_IN_SQUAD") {
          warnings.push(`${player?.displayName} is NOT IN SQUAD`);
        } else if (intel.fieldStatus === "BENCH") {
          warnings.push(`${player?.displayName} may start on BENCH — lower score expected`);
        }
        if (intel.reliability === "HIGH" && intel.fieldStatus === "ON_FIELD") {
          confirmed++;
        }
      }
    }
    return { lineupWarnings: warnings, confirmedCount: confirmed };
  }, [slots, captainIndex, filledCount, playerIntel]);

  const handleFillFromBatch = async (batchCards: SorareCard[]) => {
    await autoFillWithStrategy(batchCards, playerIntel);
  };

  const PLAY_MODES: { key: PlayMode; label: string; icon: typeof Zap; color: string; bg: string }[] = [
    { key: "auto", label: "AUTO", icon: Sparkles, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
    { key: "fast", label: "FAST", icon: Zap, color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
    { key: "balanced", label: "BAL", icon: Crosshair, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
    { key: "safe", label: "SAFE", icon: Shield, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Controls</h3>
        </div>

        {/* Play Mode */}
        <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Play Mode</p>
          <div className="flex gap-1">
            {PLAY_MODES.map((m) => {
              const isActive = playMode === m.key || (playMode === "auto" && m.key !== "auto" && effectiveMode === m.key);
              const isSelected = playMode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setPlayMode(playMode === m.key ? "auto" : m.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold border transition-colors",
                    isSelected
                      ? m.bg + " " + m.color
                      : isActive
                        ? m.bg + " " + m.color + " opacity-60"
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Merge Window */}
        <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Merge Window</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-white">
                {effectiveMergeWindow >= 60 ? `${(effectiveMergeWindow / 60).toFixed(1)}h` : `${effectiveMergeWindow}m`}
              </span>
              {mergeWindow !== null && (
                <button
                  onClick={() => setMergeWindow(null)}
                  className="text-[9px] text-purple-400 hover:text-purple-300 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20"
                >
                  Auto
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={15}
            max={480}
            step={15}
            value={effectiveMergeWindow}
            onChange={(e) => setMergeWindow(Number(e.target.value))}
            className="w-full h-1.5 accent-purple-500 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:appearance-none"
          />
          <div className="flex justify-between text-[9px] text-zinc-600">
            <span>15m</span>
            <span>1h</span>
            <span>2h</span>
            <span>4h</span>
            <span>8h</span>
          </div>
        </div>
      </div>

      {/* Level Assessment */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Level {currentLevel}</h3>
        </div>

        <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{streakLevel?.threshold} pts</span>
            <span className={cn(
              "text-sm font-bold",
              currentLevel === 6 ? "text-amber-400" : "text-green-400"
            )}>
              {streakLevel?.reward}
            </span>
          </div>

          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-bold",
            mode === "floor" ? "bg-green-500/10 border-green-500/20 text-green-400" :
            mode === "balanced" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
            "bg-amber-500/10 border-amber-500/20 text-amber-400"
          )}>
            {mode === "floor" ? <Zap className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            {mode === "floor" ? "FAST MODE" : mode === "balanced" ? "BALANCED MODE" : "SAFE MODE"}
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed">{recommendation}</p>

          <div className="flex items-center gap-3 pt-2 border-t border-zinc-700/50">
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">Earned</p>
              <p className="text-xs font-bold text-green-400">${cumulativeEarned}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">At Stake</p>
              <p className="text-xs font-bold text-white">${currentReward}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">Risk</p>
              <p className={cn(
                "text-xs font-bold",
                currentLevel <= 2 ? "text-green-400" : currentLevel <= 4 ? "text-yellow-400" : "text-red-400"
              )}>
                {currentLevel <= 2 ? "Low" : currentLevel <= 4 ? "Medium" : "High"}
              </p>
            </div>
          </div>

          {filledCount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
              <span className="text-[11px] text-zinc-500">Lineup estimate</span>
              <span className={cn(
                "text-sm font-bold",
                totalEstimate >= targetScore ? "text-green-400" : "text-red-400"
              )}>
                ~{Math.round(totalEstimate)} / {targetScore}
              </span>
            </div>
          )}

          {lineupProbability && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">Success probability</span>
              <span className={cn(
                "text-sm font-bold",
                lineupProbability.confidenceLevel === "high" ? "text-green-400" :
                lineupProbability.confidenceLevel === "medium" ? "text-yellow-400" : "text-red-400"
              )}>
                {Math.round(lineupProbability.successProbability * 100)}%
              </span>
            </div>
          )}

          {/* Confirmed lineups indicator */}
          {filledCount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Confirmed starters
              </span>
              <span className={cn(
                "text-sm font-bold",
                confirmedCount === filledCount ? "text-green-400" :
                confirmedCount > 0 ? "text-yellow-400" : "text-zinc-500"
              )}>
                {confirmedCount}/{filledCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Game Batches — Interactive */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Game Batches</h3>
          <span className="text-[10px] text-zinc-600 ml-auto">{timeBatches.length} batches</span>
        </div>

        {timeBatches.length === 0 ? (
          <p className="text-[11px] text-zinc-500 px-2">No upcoming games found</p>
        ) : (
          <div className="space-y-2">
            {timeBatches.map((batch, i) => {
              const isExpanded = expandedBatch === i;
              const urgency = batch.kickoffTime.getTime() > 0
                ? getKickoffUrgency(batch.kickoffTime.toISOString())
                : "later";

              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border overflow-hidden transition-all",
                    batch.viable
                      ? "border-green-500/20"
                      : "border-zinc-700/50",
                    isExpanded ? "bg-zinc-800/60" : "bg-zinc-800/30"
                  )}
                >
                  {/* Batch Header — clickable */}
                  <button
                    onClick={() => setExpandedBatch(isExpanded ? null : i)}
                    className="w-full text-left p-3 hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {/* Urgency dot */}
                      {urgency === "imminent" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                      {urgency === "soon" && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />}

                      {/* Expand icon */}
                      {isExpanded
                        ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                      }

                      <span className="text-[11px] font-semibold text-zinc-300 flex-1">
                        {batch.windowLabel}
                      </span>

                      {batch.viable && (
                        <span className="text-[9px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded shrink-0">
                          VIABLE
                        </span>
                      )}
                    </div>

                    {/* Summary stats row */}
                    <div className="flex items-center gap-3 mt-1.5 ml-7">
                      <span className="text-[10px] text-zinc-500">
                        <Users className="w-3 h-3 inline mr-0.5" />{batch.playerCount}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        GK:{batch.posCount.Goalkeeper} DF:{batch.posCount.Defender} MD:{batch.posCount.Midfielder} FW:{batch.posCount.Forward}
                      </span>
                      <span className={cn(
                        "text-[11px] font-bold ml-auto",
                        batch.expectedTotal >= targetScore ? "text-green-400" : "text-zinc-400"
                      )}>
                        ~{batch.expectedTotal} pts
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-700/40 px-3 pb-3 space-y-3">

                      {/* Games in this batch */}
                      <div className="pt-2">
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">Matches</p>
                        <div className="space-y-1">
                          {batch.games.map((game, gi) => (
                            <div key={gi} className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50 text-[11px]">
                              <span className="font-semibold text-zinc-300">{game.home}</span>
                              <span className="text-zinc-600">vs</span>
                              <span className="font-semibold text-zinc-300">{game.away}</span>
                              <span className="text-zinc-600 ml-auto text-[10px]">{game.competition}</span>
                              <span className={cn(
                                "font-bold text-[10px]",
                                getKickoffUrgency(game.date) === "imminent" ? "text-green-400" :
                                getKickoffUrgency(game.date) === "soon" ? "text-yellow-300" : "text-zinc-500"
                              )}>
                                {formatKickoffTime(game.date)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Best 5 for this batch */}
                      <div>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">
                          <Target className="w-3 h-3 inline mr-0.5" />Best 5 for this batch
                        </p>
                        <div className="space-y-1">
                          {batch.bestCards.slice(0, 5).map((sc, pi) => {
                            const player = sc.card.anyPlayer!;
                            const pos = player.cardPositions?.[0]?.slice(0, 3).toUpperCase() || "???";
                            return (
                              <div key={sc.card.slug} className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50">
                                <span className={cn(
                                  "text-[10px] font-bold w-4 text-center",
                                  pi < 3 ? "text-amber-400" : "text-zinc-500"
                                )}>
                                  {pi + 1}
                                </span>
                                <div className="relative w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                                  <Image src={sc.card.pictureUrl} alt="" fill className="object-cover" sizes="24px" />
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1 rounded">{pos}</span>
                                <span className="text-[11px] font-semibold text-zinc-200 truncate flex-1">
                                  {player.displayName}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold",
                                  sc.strategy.expectedScore >= 60 ? "text-green-400" :
                                  sc.strategy.expectedScore >= 40 ? "text-yellow-400" : "text-zinc-400"
                                )}>
                                  {Math.round(sc.strategy.expectedScore)}
                                </span>
                                <span className={cn(
                                  "text-[9px] font-bold px-1 py-0.5 rounded",
                                  `${STRATEGY_TAG_STYLES[sc.strategy.strategyTag].text} ${STRATEGY_TAG_STYLES[sc.strategy.strategyTag].bg}`
                                )}>
                                  {sc.strategy.strategyTag}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* All players preview */}
                      {batch.allPlayers.length > 5 && (
                        <div>
                          <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">
                            All {batch.playerCount} players
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {batch.allPlayers.slice(0, 20).map((sc) => (
                              <div
                                key={sc.card.slug}
                                className="relative w-7 h-7 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700"
                                title={`${sc.card.anyPlayer?.displayName} (${Math.round(sc.strategy.expectedScore)} pts)`}
                              >
                                <Image src={sc.card.pictureUrl} alt="" fill className="object-cover" sizes="28px" />
                              </div>
                            ))}
                            {batch.allPlayers.length > 20 && (
                              <span className="text-[10px] text-zinc-500 self-center ml-1">
                                +{batch.allPlayers.length - 20}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fill button */}
                      {batch.playerCount >= 4 && (
                        <button
                          onClick={() => handleFillFromBatch(batch.items.map((item) => item.card))}
                          className={cn(
                            "w-full text-[11px] font-semibold rounded-lg py-2 transition-colors",
                            batch.viable
                              ? "text-green-300 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20"
                              : "text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20"
                          )}
                        >
                          Fill lineup from this batch
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4-Player Viability */}
      {viabilityChecks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">4-Player + Captain</h3>
          </div>
          <div className="space-y-1.5">
            {viabilityChecks.map((check) => (
              <div
                key={check.skipPosition}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border text-[11px]",
                  check.viable
                    ? "bg-green-900/10 border-green-500/20"
                    : "bg-zinc-800/30 border-zinc-700/30"
                )}
              >
                <span className="text-zinc-400">
                  Skip <span className="font-semibold text-zinc-300">{check.skipPosition}</span>
                </span>
                <span className={cn(
                  "font-bold",
                  check.viable ? "text-green-400" : "text-zinc-500"
                )}>
                  ~{check.expectedTotal} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {lineupWarnings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Warnings</h3>
          </div>
          <div className="space-y-1.5">
            {lineupWarnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-900/10 border border-yellow-500/20"
              >
                <span className="text-[11px] text-yellow-300">{warning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
