import { useMemo } from "react";
import { groupByKickoffWindow, getMergeWindowForLevel } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import {
  scoreCardsWithStrategy,
  evaluateTimeBatch,
  evaluate4PlayerViability,
  getStrategyMode,
  getStrategyRecommendation,
} from "@/lib/ai-lineup";
import type {
  SorareCard,
  Position,
  StrategyTag,
  ScoredCardWithStrategy,
  StrategyMode,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface StrategyDashboardData {
  /** Current streak level (from store) */
  currentLevel: number;
  /** Strategy mode for the current level */
  mode: StrategyMode;
  /** Effective merge window in minutes */
  effectiveMergeWindow: number;
  /** Raw merge window from store (null = auto) */
  mergeWindow: number | null;
  /** Setter for mergeWindow */
  setMergeWindow: (minutes: number | null) => void;

  /** All cards scored at the current level, sorted by strategy score */
  scoredCards: ScoredCardWithStrategy[];

  /** Top 15 unique players with upcoming games */
  topPlayers: ScoredCardWithStrategy[];

  /** Game-time batch groups with expected totals */
  timeBatches: TimeBatch[];

  /** Level-by-level playbook for all streak levels */
  playbook: PlaybookEntry[];

  /** 4-player viability analysis (null when level > 3) */
  viability: ViabilityResult | null;

  /** Expected-value analysis for current level */
  evAnalysis: EVAnalysis;

  /** Aggregate stats across scored cards */
  stats: StatsSnapshot;
}

export interface TimeBatch {
  windowLabel: string;
  kickoffTime: Date;
  gameCount: number;
  items: ScoredCardWithStrategy[];
  expectedTotal: number;
  playerCount: number;
}

export interface PlaybookEntry {
  level: number;
  threshold: number;
  reward: string;
  topCards: ScoredCardWithStrategy[];
  expectedTotal: number;
  meetsThreshold: boolean;
  mode: StrategyMode;
  recommendation: string;
}

export interface ViabilityCheck {
  skipPosition: Position;
  viable: boolean;
  expectedTotal: number;
  bestCards: ScoredCardWithStrategy[];
}

export interface ViabilityResult {
  checks: ViabilityCheck[];
  bestOption: ViabilityCheck;
}

export interface EVAnalysis {
  cumulativeEarned: number;
  currentReward: number;
  remainingRewards: number;
}

export interface StatsSnapshot {
  totalWithGame: number;
  avgScore: number;
  tagCounts: Record<StrategyTag, number>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStrategyDashboard(cards: SorareCard[]): StrategyDashboardData {
  const { currentLevel, mergeWindow, setMergeWindow } = useLineupStore();
  const mode = getStrategyMode(currentLevel);
  const effectiveMergeWindow = mergeWindow ?? getMergeWindowForLevel(currentLevel);

  // Score all cards at current level
  const scoredCards = useMemo(
    () => scoreCardsWithStrategy(cards, currentLevel),
    [cards, currentLevel],
  );

  // Top 15 unique players with upcoming games
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
  const timeBatches: TimeBatch[] = useMemo(() => {
    const wrapped = scoredCards.filter((sc) => sc.hasGame);
    const groups = groupByKickoffWindow(wrapped, effectiveMergeWindow);
    return groups.map((g) => {
      const batchCards = g.items.map((i) => i.card);
      const { expectedTotal } = evaluateTimeBatch(batchCards, currentLevel);
      return { ...g, expectedTotal, playerCount: batchCards.length };
    });
  }, [scoredCards, currentLevel, effectiveMergeWindow]);

  // Level-by-level playbook
  const playbook: PlaybookEntry[] = useMemo(() => {
    return STREAK_LEVELS.map((lvl) => {
      const scored = scoreCardsWithStrategy(cards, lvl.level);
      const topForLevel = scored.filter((s) => s.hasGame).slice(0, 5);
      const totalExpected = topForLevel.reduce((s, c) => s + c.strategy.expectedScore, 0);
      // Captain bonus on top scorer
      const captainBonus =
        topForLevel.length > 0
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
  const viability: ViabilityResult | null = useMemo(() => {
    if (currentLevel > 3) return null;
    const positions: Position[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
    const checks: ViabilityCheck[] = positions.map((pos) => ({
      skipPosition: pos,
      ...evaluate4PlayerViability(cards, currentLevel, pos),
    }));
    const bestOption = checks.reduce((a, b) =>
      a.expectedTotal > b.expectedTotal ? a : b,
    );
    return { checks, bestOption };
  }, [cards, currentLevel]);

  // EV analysis
  const evAnalysis: EVAnalysis = useMemo(() => {
    const cumulativeEarned = STREAK_LEVELS.filter((l) => l.level < currentLevel).reduce(
      (s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")),
      0,
    );
    const currentReward = parseFloat(
      STREAK_LEVELS[currentLevel - 1].reward.replace(/[$,]/g, ""),
    );
    const remainingRewards = STREAK_LEVELS.filter((l) => l.level >= currentLevel).reduce(
      (s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")),
      0,
    );

    return { cumulativeEarned, currentReward, remainingRewards };
  }, [currentLevel]);

  // Stats summary
  const stats: StatsSnapshot = useMemo(() => {
    const withGame = scoredCards.filter((sc) => sc.hasGame);
    const avgScore =
      withGame.length > 0
        ? withGame.reduce((s, c) => s + (c.card.anyPlayer?.averageScore || 0), 0) /
          withGame.length
        : 0;
    const tagCounts: Record<StrategyTag, number> = { SAFE: 0, BALANCED: 0, CEILING: 0, RISKY: 0 };
    for (const sc of withGame.slice(0, 50)) {
      tagCounts[sc.strategy.strategyTag]++;
    }
    return { totalWithGame: withGame.length, avgScore, tagCounts };
  }, [scoredCards]);

  return {
    currentLevel,
    mode,
    effectiveMergeWindow,
    mergeWindow,
    setMergeWindow,
    scoredCards,
    topPlayers,
    timeBatches,
    playbook,
    viability,
    evAnalysis,
    stats,
  };
}
