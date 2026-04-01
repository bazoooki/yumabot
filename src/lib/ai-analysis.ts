import type { PlayerGameScore, SorareCard } from "./types";
import { getEditionInfo } from "./ai-lineup";

interface AnalysisInput {
  card: SorareCard;
  scores: PlayerGameScore[];
}

export function generateAnalysis({ card, scores }: AnalysisInput): string {
  const player = card.anyPlayer;
  if (!player || scores.length === 0) {
    return "Insufficient data to generate analysis.";
  }

  const lines: string[] = [];
  const validScores = scores.filter(s => s.scoreStatus === "FINAL" && s.score > 0);

  if (validScores.length === 0) {
    return "No scored games available for analysis.";
  }

  // Form trend: L5 vs L10
  const l5 = validScores.slice(0, Math.min(5, validScores.length));
  const l10 = validScores.slice(0, Math.min(10, validScores.length));
  const l5Avg = l5.reduce((s, g) => s + g.score, 0) / l5.length;
  const l10Avg = l10.reduce((s, g) => s + g.score, 0) / l10.length;

  const diff = l5Avg - l10Avg;
  const trend = diff > 5 ? "trending UP" : diff < -5 ? "trending DOWN" : "stable";
  lines.push(`Form: L5 avg ${l5Avg.toFixed(1)} vs L10 avg ${l10Avg.toFixed(1)} — ${trend}`);

  // Consistency (standard deviation of L10)
  const mean = l10Avg;
  const variance = l10.reduce((sum, g) => sum + Math.pow(g.score - mean, 2), 0) / l10.length;
  const stdDev = Math.sqrt(variance);
  const consistency = stdDev < 10 ? "very consistent (low variance)" :
    stdDev < 18 ? "moderately consistent" : "high variance (risky)";
  lines.push(`Consistency: ${consistency} (std dev ${stdDev.toFixed(1)})`);

  // Home/away context from upcoming game
  const upcomingGames = player.activeClub?.upcomingGames || [];
  if (upcomingGames.length > 0) {
    const game = upcomingGames[0];
    const isHome = game.homeTeam.code === player.activeClub?.code;
    lines.push(`Next game: ${game.homeTeam.code} vs ${game.awayTeam.code} (${isHome ? "HOME" : "AWAY"})`);
  }

  // Playing chance from most recent score with odds data
  const latestWithOdds = scores.find(s => s.anyPlayerGameStats?.footballPlayingStatusOdds);
  if (latestWithOdds?.anyPlayerGameStats?.footballPlayingStatusOdds) {
    const odds = latestWithOdds.anyPlayerGameStats.footballPlayingStatusOdds;
    const pct = (odds.starterOddsBasisPoints / 100).toFixed(0);
    lines.push(`Starting probability: ${pct}% (${odds.reliability} reliability)`);
  }

  // Edition & power bonus
  const editionInfo = getEditionInfo(card);
  const power = parseFloat(card.power) || 1;
  if (editionInfo.bonus > 0 || power > 1) {
    const parts: string[] = [];
    if (editionInfo.bonus > 0) parts.push(`${editionInfo.label}`);
    if (power > 1) parts.push(`Power +${Math.round((power - 1) * 100)}%`);
    lines.push(`Card bonuses: ${parts.join(", ")}`);
  }

  // Grade from most recent projection
  const latestGrade = scores.find(s => s.projection?.grade);
  if (latestGrade?.projection) {
    lines.push(`Latest grade: ${latestGrade.projection.grade}`);
  }

  // Games played ratio
  const totalGames = scores.length;
  const playedGames = scores.filter(s =>
    s.anyPlayerGameStats?.minsPlayed && s.anyPlayerGameStats.minsPlayed > 0
  ).length;
  if (totalGames > 0) {
    const pct = ((playedGames / totalGames) * 100).toFixed(0);
    lines.push(`Playing time: ${playedGames}/${totalGames} games (${pct}%)`);
  }

  // Overall recommendation
  const expectedPts = l5Avg * power * (1 + editionInfo.bonus);
  const rating = expectedPts >= 55 ? "STRONG" : expectedPts >= 35 ? "DECENT" : "WEAK";
  lines.push("");
  lines.push(`Verdict: ${rating} pick — expected ~${expectedPts.toFixed(0)} pts`);

  return lines.join("\n");
}
