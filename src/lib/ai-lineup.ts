import type {
  SorareCard,
  Position,
  StrategyTag,
  StrategyMode,
  CardStrategyMetrics,
  ScoredCardWithStrategy,
  LineupProbability,
  PlayerGameScore,
  PlayerIntel,
  InSeasonCompetition,
} from "./types";
import { pickInSeasonLineup } from "./in-season/lineup-picker";
import { isEligibleForCompetition } from "./in-season/eligibility";

export interface ScoredCard {
  card: SorareCard;
  expectedPoints: number;
  editionBonus: number;
  editionLabel: string;
  hasGame: boolean;
  isHome: boolean;
  isInjured: boolean;
}

export interface EditionInfo {
  bonus: number;
  label: string;
  tier: "base" | "shiny" | "holo" | "legendary";
  variation: string | null;
}

export function getEditionInfo(card: SorareCard): EditionInfo {
  const edition = (card.cardEditionName || "").toLowerCase();

  // Check variations first (they include the base edition bonus)
  if (edition.includes("signed")) {
    return { bonus: 0.40, label: "Signed +40%", tier: "legendary", variation: "Signed" };
  }
  if (edition.includes("meteor")) {
    return { bonus: 0.25, label: "Meteor +25%", tier: "shiny", variation: "Meteor Striker" };
  }
  if (edition.includes("jersey")) {
    return { bonus: 0.20, label: "Jersey +20%", tier: "shiny", variation: "Jersey" };
  }

  // Base editions
  if (edition.includes("legendary")) {
    return { bonus: 0.30, label: "Legendary +30%", tier: "legendary", variation: null };
  }
  if (edition.includes("holo")) {
    return { bonus: 0.10, label: "Holo +10%", tier: "holo", variation: null };
  }
  if (edition.includes("shiny")) {
    return { bonus: 0.05, label: "Shiny +5%", tier: "shiny", variation: null };
  }

  return { bonus: 0, label: "Base", tier: "base", variation: null };
}

function getExpectedPoints(card: SorareCard, fieldStatus?: string | null): ScoredCard {
  const player = card.anyPlayer;
  if (!player) {
    return { card, expectedPoints: 0, editionBonus: 0, editionLabel: "Base", hasGame: false, isHome: false, isInjured: false };
  }

  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const upcomingGames = player.activeClub?.upcomingGames || [];
  const hasGame = upcomingGames.length > 0;
  const clubCode = player.activeClub?.code;
  const editionInfo = getEditionInfo(card);
  const isInjured = fieldStatus === "INJURED" || fieldStatus === "SUSPENDED" || fieldStatus === "NOT_IN_SQUAD";

  // Check if home game
  const isHome = hasGame && upcomingGames[0]?.homeTeam?.code === clubCode;

  let expectedPoints = avgScore * power * (1 + editionInfo.bonus);

  // No game or injured = 0 points
  if (!hasGame || isInjured) {
    expectedPoints = 0;
  }

  // Home game bonus (+5%)
  if (isHome && !isInjured) {
    expectedPoints *= 1.05;
  }

  return {
    card,
    expectedPoints,
    editionBonus: editionInfo.bonus,
    editionLabel: editionInfo.label,
    hasGame,
    isHome,
    isInjured,
  };
}

export function scoreCards(cards: SorareCard[]): ScoredCard[] {
  return cards.map((card) => getExpectedPoints(card)).sort((a, b) => b.expectedPoints - a.expectedPoints);
}

export function recommendLineup(cards: SorareCard[], count = 5): SorareCard[] {
  const scored = scoreCards(cards);

  // Try to ensure positional diversity: at least 1 GK, 1 DEF, 1 MID, 1 FWD
  const positionMap: Record<string, ScoredCard[]> = {
    Goalkeeper: [],
    Defender: [],
    Midfielder: [],
    Forward: [],
  };

  for (const sc of scored) {
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos && positionMap[pos]) {
      positionMap[pos].push(sc);
    }
  }

  const selected: ScoredCard[] = [];
  const usedPlayerSlugs = new Set<string>();

  // Pick best from each position first (dedup by player, not card edition)
  for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward"]) {
    const playerSlug = (sc: ScoredCard) => sc.card.anyPlayer?.slug ?? sc.card.slug;
    const best = positionMap[pos].find((sc) => !usedPlayerSlugs.has(playerSlug(sc)));
    if (best && selected.length < count) {
      selected.push(best);
      usedPlayerSlugs.add(playerSlug(best));
    }
  }

  // Fill remaining slots with best available
  for (const sc of scored) {
    if (selected.length >= count) break;
    const playerSlug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (!usedPlayerSlugs.has(playerSlug)) {
      selected.push(sc);
      usedPlayerSlugs.add(playerSlug);
    }
  }

  return selected.map((sc) => sc.card);
}

export function estimateTotalScore(
  cards: (SorareCard | null)[],
  captainIndex?: number | null,
): number {
  return cards.reduce((total, card, i) => {
    if (!card) return total;
    const sc = getExpectedPoints(card);
    const multiplier = captainIndex != null && i === captainIndex ? 1.5 : 1;
    return total + sc.expectedPoints * multiplier;
  }, 0);
}

// --- Level-Aware Strategy System ---

export interface StrategyWeights {
  expectedScore: number;
  floor: number;
  ceiling: number;
  consistency: number;
  startProb: number;
  /**
   * 0-1 weight on `minutesDepth` — boosts cards whose recent appearances
   * trend toward full 90s vs early subs. Optional so legacy callers and
   * preset bundles keep their existing five-term shape; defaults to 0.
   */
  minutesDepth?: number;
  /**
   * 0-1 weight on `setPieceBonus` — flat boost when the player regularly
   * takes set-pieces / penalties. Optional, defaults to 0.
   */
  setPieceTaker?: number;
}

/**
 * Risk-profile overrides for the AI Suggestions panel. These deliberately
 * diverge from LEVEL_WEIGHTS so the three suggested lineups land on visibly
 * different card sets even at the same target threshold.
 */
export const RISK_PROFILE_WEIGHTS: Record<
  "safe" | "balanced" | "ceiling",
  StrategyWeights
> = {
  safe: { expectedScore: 0.05, floor: 0.30, ceiling: 0.00, consistency: 0.15, startProb: 0.50 },
  // BALANCED uses LEVEL_WEIGHTS[level] at call time; sentinel kept for symmetry.
  balanced: { expectedScore: 0.35, floor: 0.15, ceiling: 0.15, consistency: 0.15, startProb: 0.20 },
  ceiling: { expectedScore: 0.30, floor: 0.05, ceiling: 0.50, consistency: 0.00, startProb: 0.15 },
};

const LEVEL_WEIGHTS: Record<number, StrategyWeights> = {
  1: { expectedScore: 0.30, floor: 0.35, ceiling: 0.05, consistency: 0.20, startProb: 0.10 },
  2: { expectedScore: 0.30, floor: 0.30, ceiling: 0.05, consistency: 0.20, startProb: 0.15 },
  3: { expectedScore: 0.35, floor: 0.15, ceiling: 0.15, consistency: 0.15, startProb: 0.20 },
  4: { expectedScore: 0.25, floor: 0.05, ceiling: 0.35, consistency: 0.10, startProb: 0.25 },
  5: { expectedScore: 0.20, floor: 0.00, ceiling: 0.45, consistency: 0.05, startProb: 0.30 },
  6: { expectedScore: 0.15, floor: 0.00, ceiling: 0.50, consistency: 0.05, startProb: 0.30 },
};

const POSITION_DEFAULT_STDDEV: Record<string, number> = {
  Goalkeeper: 10,
  Defender: 12,
  Midfielder: 14,
  Forward: 18,
};

export function getStrategyMode(level: number): StrategyMode {
  if (level <= 2) return "floor";
  if (level <= 3) return "balanced";
  return "ceiling";
}

const GRADE_MULTIPLIERS: Record<string, number> = {
  A: 1.15,
  B: 1.05,
  C: 1.00,
  D: 0.90,
  F: 0.75,
};

export function computeStrategyMetrics(
  card: SorareCard,
  scoreHistory?: number[] | null,
  startProbability?: number | null,
  projectionGrade?: string | null,
  projectedScore?: number | null,
  /**
   * Full per-game history. When provided, used to derive `minutesDepth` and
   * `setPieceBonus`. Pass alongside `scoreHistory` when richer data is on
   * hand — both are sourced from the same `/api/player-scores` payload.
   */
  gameHistory?: PlayerGameScore[] | null,
): CardStrategyMetrics {
  const player = card.anyPlayer;
  const avgScore = player?.averageScore || 0;
  const position = player?.cardPositions?.[0] || "Midfielder";
  const upcomingGames = player?.activeClub?.upcomingGames || [];
  const hasGame = upcomingGames.length > 0;
  const power = parseFloat(card.power) || 1;
  const editionInfo = getEditionInfo(card);
  const clubCode = player?.activeClub?.code;
  const isHome = hasGame && upcomingGames[0]?.homeTeam?.code === clubCode;

  // If Sorare provides a projected score for the upcoming game, blend it with avgScore
  // (70% projected, 30% average) — Sorare's model accounts for opponent, form, etc.
  const baseScore = projectedScore && projectedScore > 0
    ? projectedScore * 0.7 + avgScore * 0.3
    : avgScore;

  let expectedScore = baseScore * power * (1 + editionInfo.bonus);
  if (!hasGame) expectedScore = 0;
  if (isHome) expectedScore *= 1.05;

  // Apply projection grade multiplier (A → +15%, D → −10%, etc.). When no
  // grade is available (intel missing), treat the card as slightly below C
  // rather than neutral — otherwise unrated cards outrank real A/B-graded
  // cards whose matchup intel happens to lower their score.
  const gradeMult = projectionGrade
    ? (GRADE_MULTIPLIERS[projectionGrade.toUpperCase()] ?? 1)
    : 0.85;
  expectedScore *= gradeMult;

  const isDetailed = !!scoreHistory && scoreHistory.length >= 3;
  let stdDev: number;
  let floor: number;
  let ceiling: number;

  if (isDetailed) {
    const mean = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;
    const variance = scoreHistory.reduce((a, b) => a + (b - mean) ** 2, 0) / scoreHistory.length;
    stdDev = Math.sqrt(variance);
    const sorted = [...scoreHistory].sort((a, b) => a - b);
    const p5Index = Math.max(0, Math.floor(sorted.length * 0.05));
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    floor = sorted[p5Index] * power * (1 + editionInfo.bonus) * gradeMult;
    ceiling = sorted[p95Index] * power * (1 + editionInfo.bonus) * gradeMult;
  } else {
    stdDev = POSITION_DEFAULT_STDDEV[position] || 14;
    floor = Math.max(0, (baseScore - 1.65 * stdDev)) * power * (1 + editionInfo.bonus) * gradeMult;
    ceiling = (baseScore + 1.65 * stdDev) * power * (1 + editionInfo.bonus) * gradeMult;
  }

  if (!hasGame) {
    floor = 0;
    ceiling = 0;
  }

  const consistencyScore = stdDev > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (stdDev / avgScore) * 100)))
    : 0;

  // Default to 0.5 (not 0.75) when intel is missing — a no-intel card should
  // NOT be treated as a near-certain starter; otherwise it sails to the top
  // of the sort over real graded players with known 60–80% start rates.
  const startProb = startProbability ?? (hasGame ? 0.5 : 0);

  // Scale expected score and floor by start probability.
  // A 0% starter has ~0 expected value; a 10% starter keeps ~10%.
  // Ceiling stays unscaled (represents upside IF they play).
  expectedScore *= startProb;
  floor *= startProb;

  // Classify strategy tag
  const gradeLabel = projectionGrade ? ` (Grade ${projectionGrade})` : "";
  let strategyTag: StrategyTag;
  let strategyReason: string;

  if (!hasGame || startProb < 0.3) {
    strategyTag = "RISKY";
    strategyReason = !hasGame ? "No upcoming game" : "Low start probability";
  } else if (consistencyScore >= 65 && startProb >= 0.7) {
    strategyTag = "SAFE";
    strategyReason = `Consistent pick — low variance${gradeLabel}`;
  } else if (ceiling >= baseScore * 1.4 * power) {
    strategyTag = "CEILING";
    strategyReason = `High upside — can explode${gradeLabel}`;
  } else {
    strategyTag = "BALANCED";
    strategyReason = `Solid pick — moderate variance${gradeLabel}`;
  }

  // Minutes-played depth — among games where the player actually appeared,
  // average minsPlayed. Cards whose recent appearances trend toward full 90s
  // get a higher score than ones routinely subbed at 60'. Filtering on
  // `minsPlayed > 0` keeps benched/squad-not-named games from dragging the
  // mean toward zero (those signals are already captured by start
  // probability — minutesDepth is specifically about how *deep* they play
  // when they DO start). Falls back to 0 when no history is available.
  let minutesDepth = 0;
  if (gameHistory && gameHistory.length > 0) {
    const appearances = gameHistory
      .map((g) => g.anyPlayerGameStats?.minsPlayed ?? 0)
      .filter((m) => m > 0);
    if (appearances.length > 0) {
      const avgMins = appearances.reduce((a, b) => a + b, 0) / appearances.length;
      minutesDepth = Math.max(0, Math.min(100, Math.round((avgMins / 90) * 100)));
    }
  }

  // Set-piece / penalty taker — flat 0/100 indicator. We treat the player as
  // a regular taker if either avg setPieces taken per appearance ≥ 0.5
  // (corner / FK duty most games) or any penalty has been taken in recent
  // history (penalty kicks are rare events; one is enough signal).
  let setPieceBonus = 0;
  if (gameHistory && gameHistory.length > 0) {
    const appearances = gameHistory.filter(
      (g) => (g.anyPlayerGameStats?.minsPlayed ?? 0) > 0,
    );
    if (appearances.length > 0) {
      const avgSetPieces =
        appearances.reduce(
          (s, g) => s + (g.anyPlayerGameStats?.setPieceTaken ?? 0),
          0,
        ) / appearances.length;
      const totalPenalties = appearances.reduce(
        (s, g) => s + (g.anyPlayerGameStats?.penaltyTaken ?? 0),
        0,
      );
      if (avgSetPieces >= 0.5 || totalPenalties > 0) {
        setPieceBonus = 100;
      }
    }
  }

  return {
    expectedScore,
    floor,
    ceiling,
    stdDev,
    consistencyScore,
    startProbability: startProb,
    minutesDepth,
    setPieceBonus,
    strategyTag,
    strategyReason,
    isDetailedTier: isDetailed,
  };
}

export function computeStrategyScore(
  metrics: CardStrategyMetrics,
  level: number,
  weightOverride?: StrategyWeights,
): number {
  const weights = weightOverride ?? LEVEL_WEIGHTS[level] ?? LEVEL_WEIGHTS[3];

  const normalizedExpected = metrics.expectedScore;
  const normalizedFloor = metrics.floor;
  const normalizedCeiling = metrics.ceiling;
  const normalizedConsistency = metrics.consistencyScore;
  const normalizedStartProb = metrics.startProbability * 100;

  let score =
    weights.expectedScore * normalizedExpected +
    weights.floor * normalizedFloor +
    weights.ceiling * normalizedCeiling +
    weights.consistency * normalizedConsistency +
    weights.startProb * normalizedStartProb +
    (weights.minutesDepth ?? 0) * metrics.minutesDepth +
    (weights.setPieceTaker ?? 0) * metrics.setPieceBonus;

  // Non-starter penalty — aggressive to avoid picking players who won't play
  if (metrics.startProbability < 0.5) {
    // 0% start → score *= 0.02, 10% → ~0.05, 30% → ~0.20, 49% → ~0.50
    score *= Math.max(0.02, metrics.startProbability ** 1.5 * 2);
  }

  return score;
}

export function scoreCardsWithStrategy(
  cards: SorareCard[],
  level: number,
  starterProbs?: Record<string, number | null> | null,
  playerIntelMap?: Record<string, PlayerIntel> | null,
  weightOverride?: StrategyWeights,
  /**
   * Optional per-player history map. When provided, history is fed into
   * `computeStrategyMetrics` so floor/ceiling, consistency, minutesDepth,
   * and setPieceBonus reflect real recent games rather than position
   * defaults.
   */
  historyMap?: Record<string, PlayerGameScore[]> | null,
): ScoredCardWithStrategy[] {
  console.log("[SCORE] scoreCardsWithStrategy called with starterProbs:", starterProbs ? Object.keys(starterProbs).length + " players" : "NONE", "playerIntelMap:", playerIntelMap ? Object.keys(playerIntelMap).length + " players" : "NONE", "historyMap:", historyMap ? Object.keys(historyMap).length + " players" : "NONE");
  return cards
    .map((card) => {
      const playerSlug = card.anyPlayer?.slug;
      const intel = playerSlug ? playerIntelMap?.[playerSlug] : undefined;
      const history = playerSlug ? historyMap?.[playerSlug] : undefined;
      const base = getExpectedPoints(card, intel?.fieldStatus);
      // Use real starter probability if available (value is 0-100 from batch fetch)
      const realProb = playerSlug && starterProbs?.[playerSlug] != null
        ? starterProbs[playerSlug]! / 100
        : undefined;
      const scoreValues = history
        ? history.filter((g) => g.score > 0).map((g) => g.score)
        : null;
      const strategy = computeStrategyMetrics(
        card,
        scoreValues,
        realProb ?? null,
        intel?.projectionGrade,
        intel?.projectedScore,
        history ?? null,
      );
      // Force RISKY for unavailable players
      if (base.isInjured) {
        strategy.strategyTag = "RISKY";
        strategy.strategyReason = intel?.fieldStatus === "INJURED" ? "Player is injured"
          : intel?.fieldStatus === "SUSPENDED" ? "Player is suspended"
          : "Player not in squad";
        strategy.startProbability = 0;
      }
      const strategyScore = computeStrategyScore(strategy, level, weightOverride);
      return { ...base, strategy, strategyScore };
    })
    .sort((a, b) => b.strategyScore - a.strategyScore);
}

async function fetchPlayerScores(
  slug: string,
  position: string,
): Promise<PlayerGameScore[]> {
  const res = await fetch(
    `/api/player-scores?slug=${encodeURIComponent(slug)}&position=${encodeURIComponent(position)}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.scores ?? [];
}

export async function recommendLineupWithStrategy(
  cards: SorareCard[],
  level: number,
  count = 5,
  playerIntelMap?: Record<string, PlayerIntel> | null,
): Promise<{ lineup: ScoredCardWithStrategy[]; probability: LineupProbability }> {
  // Build starterProbs from playerIntelMap for scoreCardsWithStrategy
  const starterProbs: Record<string, number | null> | undefined = playerIntelMap
    ? Object.fromEntries(
        Object.entries(playerIntelMap).map(([slug, intel]) => [slug, intel.starterProbability]),
      )
    : undefined;

  // Tier 1: score all cards with real starter data, take top candidates
  const tier1 = scoreCardsWithStrategy(cards, level, starterProbs, playerIntelMap);
  const candidates = tier1.slice(0, 15);

  // Tier 2: fetch real score history for top candidates
  const enriched = await Promise.allSettled(
    candidates.map(async (sc) => {
      const player = sc.card.anyPlayer;
      if (!player) return sc;

      const position = player.cardPositions?.[0] || "Goalkeeper";
      const scores = await fetchPlayerScores(player.slug, position);

      if (scores.length < 3) return sc;

      const scoreValues = scores
        .filter((s) => s.score > 0)
        .map((s) => s.score);

      // Use real-time starter probability from playerIntelMap (upcoming game odds)
      // Fall back to historical average only if no real-time data
      const intelProb = player.slug ? playerIntelMap?.[player.slug]?.starterProbability : undefined;
      let startProb: number;
      if (intelProb != null) {
        startProb = intelProb / 100;
      } else {
        const gamesWithStats = scores.filter((s) => s.anyPlayerGameStats);
        if (gamesWithStats.length > 0) {
          startProb = gamesWithStats
            .map((s) => (s.anyPlayerGameStats?.footballPlayingStatusOdds?.starterOddsBasisPoints ?? 5000) / 10000)
            .reduce((a, b) => a + b, 0) / gamesWithStats.length;
        } else {
          startProb = 0.75;
        }
      }

      const intelData = player.slug ? playerIntelMap?.[player.slug] : undefined;
      const strategy = computeStrategyMetrics(sc.card, scoreValues, startProb, intelData?.projectionGrade, intelData?.projectedScore);
      const strategyScore = computeStrategyScore(strategy, level);
      return { ...sc, strategy, strategyScore };
    }),
  );

  const enrichedCards = enriched.map((result, i) =>
    result.status === "fulfilled" ? result.value : candidates[i],
  );

  // Sort by strategy score and pick with positional diversity
  enrichedCards.sort((a, b) => b.strategyScore - a.strategyScore);

  const selected: ScoredCardWithStrategy[] = [];
  const usedPlayerSlugs = new Set<string>();

  const positionMap: Record<string, ScoredCardWithStrategy[]> = {
    Goalkeeper: [],
    Defender: [],
    Midfielder: [],
    Forward: [],
  };

  for (const sc of enrichedCards) {
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos && positionMap[pos]) {
      positionMap[pos].push(sc);
    }
  }

  // Pick best from each position first
  for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward"]) {
    const playerSlug = (sc: ScoredCardWithStrategy) => sc.card.anyPlayer?.slug ?? sc.card.slug;
    const best = positionMap[pos].find((sc) => !usedPlayerSlugs.has(playerSlug(sc)));
    if (best && selected.length < count) {
      selected.push(best);
      usedPlayerSlugs.add(playerSlug(best));
    }
  }

  // Fill remaining
  for (const sc of enrichedCards) {
    if (selected.length >= count) break;
    const playerSlug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (!usedPlayerSlugs.has(playerSlug)) {
      selected.push(sc);
      usedPlayerSlugs.add(playerSlug);
    }
  }

  const probability = estimateLineupProbability(
    selected,
    (LEVEL_WEIGHTS[level] ? level : 3),
  );

  return { lineup: selected, probability };
}

export function estimateLineupProbability(
  cards: ScoredCardWithStrategy[],
  level: number,
): LineupProbability {
  const thresholds: Record<number, number> = {
    1: 280, 2: 320, 3: 360, 4: 400, 5: 440, 6: 480,
  };
  const threshold = thresholds[level] || 360;

  const totalMean = cards.reduce((s, c) => s + c.strategy.expectedScore, 0);
  const totalVariance = cards.reduce((s, c) => s + c.strategy.stdDev ** 2, 0);
  const totalStdDev = Math.sqrt(totalVariance);

  let successProbability = 0.5;
  if (totalStdDev > 0) {
    // Normal CDF approximation: P(X >= threshold)
    const z = (totalMean - threshold) / totalStdDev;
    successProbability = normalCDF(z);
  } else if (totalMean >= threshold) {
    successProbability = 1;
  }

  const confidenceLevel: LineupProbability["confidenceLevel"] =
    successProbability >= 0.7 ? "high" :
    successProbability >= 0.4 ? "medium" : "low";

  return {
    expectedTotal: Math.round(totalMean),
    successProbability: Math.round(successProbability * 100) / 100,
    confidenceLevel,
  };
}

export function kickoffTimeFactor(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const hoursUntil = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil <= 0) return 0.3; // already started or past
  if (hoursUntil <= 2) return 1.0;
  if (hoursUntil <= 6) return 0.9;
  if (hoursUntil <= 12) return 0.8;
  if (hoursUntil <= 24) return 0.7;
  if (hoursUntil <= 48) return 0.6;
  return 0.5;
}

export function evaluateTimeBatch(
  cards: SorareCard[],
  level: number,
): { expectedTotal: number; bestCards: ScoredCardWithStrategy[] } {
  const scored = scoreCardsWithStrategy(cards, level);
  const selected: ScoredCardWithStrategy[] = [];
  const usedSlugs = new Set<string>();

  for (const sc of scored) {
    if (selected.length >= 5) break;
    const slug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (!usedSlugs.has(slug)) {
      selected.push(sc);
      usedSlugs.add(slug);
    }
  }

  // Captain on highest scorer
  let captainBonus = 0;
  if (selected.length > 0) {
    const best = selected.reduce((a, b) => a.strategy.expectedScore > b.strategy.expectedScore ? a : b);
    captainBonus = best.strategy.expectedScore * 0.5;
  }

  const expectedTotal = selected.reduce((s, c) => s + c.strategy.expectedScore, 0) + captainBonus;
  return { expectedTotal: Math.round(expectedTotal), bestCards: selected };
}

export function evaluate4PlayerViability(
  cards: SorareCard[],
  level: number,
  skipPosition: Position,
): { viable: boolean; expectedTotal: number; bestCards: ScoredCardWithStrategy[] } {
  const thresholds: Record<number, number> = { 1: 280, 2: 320, 3: 360, 4: 400, 5: 440, 6: 480 };
  const threshold = thresholds[level] || 360;

  const filtered = cards.filter((c) => c.anyPlayer?.cardPositions?.[0] !== skipPosition);
  const scored = scoreCardsWithStrategy(filtered, level);
  const selected: ScoredCardWithStrategy[] = [];
  const usedSlugs = new Set<string>();

  for (const sc of scored) {
    if (selected.length >= 4) break;
    const slug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (usedSlugs.has(slug)) continue;
    if (!sc.hasGame) continue;
    selected.push(sc);
    usedSlugs.add(slug);
  }

  // Captain on highest scorer
  let captainBonus = 0;
  if (selected.length > 0) {
    const best = selected.reduce((a, b) => a.strategy.expectedScore > b.strategy.expectedScore ? a : b);
    captainBonus = best.strategy.expectedScore * 0.5;
  }

  const expectedTotal = Math.round(
    selected.reduce((s, c) => s + c.strategy.expectedScore, 0) + captainBonus
  );

  return { viable: expectedTotal >= threshold, expectedTotal, bestCards: selected };
}

export function getStrategyRecommendation(level: number): string {
  if (level <= 2) {
    return `Level ${level} (${level === 1 ? 280 : 320} pts) — FAST mode recommended. Pick confirmed starters playing soonest. You can clear this with 4 strong players + captain. Collect reward quickly, then submit the next lineup.`;
  }
  if (level === 3) {
    return `Level 3 (360 pts) — BALANCED mode. Pick solid players with good start probability. Captain your highest scorer. Consider waiting for lineup confirmations before submitting.`;
  }
  return `Level ${level} (${level === 4 ? 400 : level === 5 ? 440 : 480} pts) — SAFE mode. High stakes ($${level === 4 ? "50" : level === 5 ? "200" : "1,000"} reward). Use your absolute best 5 players. Wait for confirmed lineups. Captain your highest-ceiling player.`;
}

// --- In-Season Scoring ---

/** Map dynamic threshold score to level 1-6 for weight selection */
export function mapThresholdToLevel(thresholdScore: number): number {
  if (thresholdScore <= 340) return 1;
  if (thresholdScore <= 360) return 2;
  if (thresholdScore <= 380) return 3;
  if (thresholdScore <= 400) return 4;
  if (thresholdScore <= 440) return 5;
  return 6;
}

/**
 * Score cards filtered for in-season competition rules. Uses
 * `isEligibleForCompetition` (the SoT walking `eligibleUpcomingLeagueTracks`)
 * for filtering — covers rarity, league, seasonality, classic-vs-in-season
 * tracks, and Challenger/Contender via `so5LeaderboardType` in one check.
 *
 * Do NOT inline a `domesticLeague.name` filter here — it misses loanees and
 * dual-eligible cards. The whole point of routing through the comp is that
 * Sorare's per-card track list is authoritative.
 */
export function scoreCardsForInSeason(
  cards: SorareCard[],
  comp: InSeasonCompetition,
  targetScore: number,
  starterProbs?: Record<string, number | null> | null,
  playerIntelMap?: Record<string, PlayerIntel> | null,
): ScoredCardWithStrategy[] {
  const eligible = cards.filter((c) => isEligibleForCompetition(c, comp));
  const level = mapThresholdToLevel(targetScore);
  return scoreCardsWithStrategy(eligible, level, starterProbs, playerIntelMap);
}

/**
 * Recommend best 5 cards for an in-season competition.
 *
 * Takes the full `InSeasonCompetition` rather than a derived `requirements`
 * blob so callers don't pre-compute league restrictions or cross-league
 * flags — all of that is encoded in the comp itself (`so5LeaderboardType`,
 * `leagueName`, `mainRarityType`, `seasonality`). The shared eligibility
 * helper handles every case (single-league + Challenger/Contender) uniformly.
 *
 * Sorare's hard rule: min 4 of 5 cards must be in-season (max 1 classic).
 * `pickInSeasonLineup` enforces this via a classic budget; we still emit a
 * warning if the available pool can't satisfy it (e.g. user owns < 4
 * in-season cards in this league).
 */
export async function recommendInSeasonLineup(
  cards: SorareCard[],
  comp: InSeasonCompetition,
  targetScore: number,
  playerIntelMap?: Record<string, PlayerIntel> | null,
  usedCardSlugs?: Set<string>,
): Promise<{ lineup: ScoredCardWithStrategy[]; warnings: string[]; probability: LineupProbability }> {
  const MIN_IN_SEASON = 4;
  const starterProbs: Record<string, number | null> | undefined = playerIntelMap
    ? Object.fromEntries(
        Object.entries(playerIntelMap).map(([slug, intel]) => [
          slug,
          intel.starterProbability,
        ]),
      )
    : undefined;

  const scored = scoreCardsForInSeason(
    cards,
    comp,
    targetScore,
    starterProbs,
    playerIntelMap,
  );

  // Exclude cards used in other teams
  const available = usedCardSlugs
    ? scored.filter((sc) => !usedCardSlugs.has(sc.card.slug))
    : scored;

  // Take top candidates for tier 2 enrichment
  const candidates = available.slice(0, 15);

  // Tier 2: fetch real score history
  const enriched = await Promise.allSettled(
    candidates.map(async (sc) => {
      const player = sc.card.anyPlayer;
      if (!player) return sc;

      const position = player.cardPositions?.[0] || "Goalkeeper";
      const res = await fetch(
        `/api/player-scores?slug=${encodeURIComponent(player.slug)}&position=${encodeURIComponent(position)}`,
      );
      if (!res.ok) return sc;
      const data = await res.json();
      const scores: PlayerGameScore[] = data.scores ?? [];

      if (scores.length < 3) return sc;

      const scoreValues = scores.filter((s) => s.score > 0).map((s) => s.score);
      const intelProb = playerIntelMap?.[player.slug]?.starterProbability;
      const startProb = intelProb != null ? intelProb / 100 : 0.75;

      const intelData = playerIntelMap?.[player.slug];
      const strategy = computeStrategyMetrics(sc.card, scoreValues, startProb, intelData?.projectionGrade, intelData?.projectedScore);
      const level = mapThresholdToLevel(targetScore);
      const strategyScore = computeStrategyScore(strategy, level);
      return { ...sc, strategy, strategyScore };
    }),
  );

  const enrichedCards = enriched.map((result, i) =>
    result.status === "fulfilled" ? result.value : candidates[i],
  );

  enrichedCards.sort((a, b) => b.strategyScore - a.strategyScore);

  const selected = pickInSeasonLineup(enrichedCards);
  const warnings: string[] = [];

  const inSeasonCount = selected.filter(
    (sc) => sc.card.inSeasonEligible,
  ).length;
  if (inSeasonCount < MIN_IN_SEASON) {
    warnings.push(
      `Only ${inSeasonCount}/${MIN_IN_SEASON} in-season eligible cards available`,
    );
  }

  const level = mapThresholdToLevel(targetScore);
  const probability = estimateLineupProbability(selected, level);

  return { lineup: selected, warnings, probability };
}

// Approximation of standard normal CDF
export function normalCDF(z: number): number {
  if (z > 6) return 1;
  if (z < -6) return 0;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}
