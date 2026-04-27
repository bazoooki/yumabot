"use client";

import { useMemo } from "react";
import { cn, groupByKickoffWindow, getMergeWindowForLevel } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import {
  getStrategyRecommendation,
  evaluateTimeBatch,
  evaluate4PlayerViability,
  estimateTotalScore,
  getStrategyMode,
  scoreCardsWithStrategy,
} from "@/lib/ai-lineup";
import { usePlayerIntel } from "@/lib/hooks";
import type { SorareCard, Position } from "@/lib/types";
import { PlayModeChips } from "@/components/ai/play-mode-chips";
import { TargetRewardBar } from "@/components/ai/target-reward-bar";
import { LineupWarnings } from "@/components/ai/lineup-warnings";
import { GameBatchList, type GameBatchEntry } from "@/components/ai/game-batch-list";
import { Crown, SlidersHorizontal } from "lucide-react";

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

  // EV
  const cumulativeEarned = STREAK_LEVELS
    .filter((l) => l.level < currentLevel)
    .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);
  const currentReward = parseFloat(STREAK_LEVELS[currentLevel - 1].reward.replace(/[$,]/g, ""));

  // Time batches with best 5 players
  const batchEntries = useMemo<GameBatchEntry[]>(() => {
    const wrapped = cards
      .filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.[0])
      .map((card) => ({ card }));
    const groups = groupByKickoffWindow(wrapped, effectiveMergeWindow);

    return groups.map((group) => {
      const groupCards = group.items.map((i) => i.card);
      const { expectedTotal, bestCards } = evaluateTimeBatch(groupCards, currentLevel);
      const viable = bestCards.length >= 4 && expectedTotal >= targetScore;

      const games = new Map<string, { home: string; away: string; date: string; competition: string }>();
      for (const item of group.items) {
        const g = item.card.anyPlayer?.activeClub?.upcomingGames?.[0];
        if (!g) continue;
        const key = `${g.homeTeam.code}-${g.awayTeam.code}`;
        if (!games.has(key)) {
          games.set(key, { home: g.homeTeam.code, away: g.awayTeam.code, date: g.date, competition: g.competition.name });
        }
      }

      const allScored = scoreCardsWithStrategy(groupCards, currentLevel);
      const seen = new Set<string>();
      const uniqueScored = allScored.filter((sc) => {
        const slug = sc.card.anyPlayer?.slug;
        if (!slug || seen.has(slug)) return false;
        seen.add(slug);
        return true;
      });

      const posCount = { Goalkeeper: 0, Defender: 0, Midfielder: 0, Forward: 0 };
      for (const sc of uniqueScored) {
        const pos = sc.card.anyPlayer?.cardPositions?.[0];
        if (pos && pos in posCount) posCount[pos as keyof typeof posCount]++;
      }

      return {
        windowLabel: group.windowLabel,
        kickoffISO:
          group.kickoffTime.getTime() > 0
            ? group.kickoffTime.toISOString()
            : null,
        expectedTotal,
        playerCount: uniqueScored.length,
        viable,
        posCount,
        games: Array.from(games.values()),
        bestCards,
        allPlayers: uniqueScored,
        fillCards: groupCards,
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
          <PlayModeChips
            selected={playMode}
            effective={effectiveMode}
            onChange={(mode) => setPlayMode(playMode === mode ? "auto" : mode)}
          />
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

      <TargetRewardBar
        thresholdScore={streakLevel?.threshold ?? 0}
        rewardLabel={streakLevel?.reward ?? ""}
        rewardAccent={currentLevel === 6 ? "amber" : "green"}
        mode={mode}
        recommendation={recommendation}
        stats={{
          earnedUsd: cumulativeEarned,
          atStakeUsd: currentReward,
          risk: currentLevel <= 2 ? "Low" : currentLevel <= 4 ? "Medium" : "High",
        }}
        estimate={
          filledCount > 0
            ? { value: totalEstimate, meetsTarget: totalEstimate >= targetScore }
            : null
        }
        probability={lineupProbability}
        confirmed={
          filledCount > 0 ? { confirmedCount, filledCount } : null
        }
      />

      <GameBatchList
        batches={batchEntries}
        targetScore={targetScore}
        playerIntel={playerIntel}
        onFill={handleFillFromBatch}
      />

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

      <LineupWarnings warnings={lineupWarnings} />
    </div>
  );
}
