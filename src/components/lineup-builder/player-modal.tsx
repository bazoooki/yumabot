"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { POSITION_SHORT } from "@/lib/ui-config";
import type { SorareCard, PlayerGameScore } from "@/lib/types";
import { getEditionInfo } from "@/lib/ai-lineup";
import { generateAnalysis } from "@/lib/ai-analysis";
import { ScoreChart } from "./score-chart";

interface PlayerModalProps {
  card: SorareCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AvgTab = "L5" | "L10" | "L40";

async function fetchPlayerScores(slug: string, position: string): Promise<PlayerGameScore[]> {
  const res = await fetch(
    `/api/player-scores?slug=${encodeURIComponent(slug)}&position=${encodeURIComponent(position)}`
  );
  if (!res.ok) throw new Error("Failed to fetch scores");
  const data = await res.json();
  return data.scores;
}

export function PlayerModal({ card, open, onOpenChange }: PlayerModalProps) {
  const [avgTab, setAvgTab] = useState<AvgTab>("L5");
  const player = card.anyPlayer;
  if (!player) return null;

  const position = player.cardPositions?.[0] || "Forward";
  const posShort = POSITION_SHORT[position] || position.slice(0, 2).toUpperCase();
  const editionInfo = getEditionInfo(card);
  const upcomingGames = player.activeClub?.upcomingGames || [];
  const nextGame = upcomingGames[0];
  const power = parseFloat(card.power) || 1;
  const powerBonus = power > 1 ? `+${Math.round((power - 1) * 100)}%` : null;
  const localAvgScore = player.averageScore || 0;

  const { data: scores = [], isLoading, isError } = useQuery({
    queryKey: ["player-scores", player.slug, position],
    queryFn: () => fetchPlayerScores(player.slug, position),
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasScores = scores.length > 0;
  const validScores = scores.filter(
    (s) => s.scoreStatus === "FINAL" && s.score > 0
  );

  function getAvg(count: number): { avg: number; played: number; total: number } {
    if (!hasScores) {
      // Fallback to local averageScore from card data
      return { avg: localAvgScore, played: 0, total: 0 };
    }
    const subset = validScores.slice(0, Math.min(count, validScores.length));
    if (subset.length === 0) return { avg: localAvgScore, played: 0, total: 0 };
    const avg = subset.reduce((s, g) => s + g.score, 0) / subset.length;
    const played = subset.filter(
      (s) => s.anyPlayerGameStats?.minsPlayed && s.anyPlayerGameStats.minsPlayed > 0
    ).length;
    return { avg, played, total: subset.length };
  }

  const avgData =
    avgTab === "L5" ? getAvg(5) : avgTab === "L10" ? getAvg(10) : getAvg(40);

  // Grade from most recent score
  const latestGrade = scores.find((s) => s.projection?.grade);
  const grade = latestGrade?.projection?.grade;

  // Playing odds from most recent
  const latestOdds = scores.find(
    (s) => s.anyPlayerGameStats?.footballPlayingStatusOdds
  );
  const starterPct = latestOdds?.anyPlayerGameStats?.footballPlayingStatusOdds
    ? (
        latestOdds.anyPlayerGameStats.footballPlayingStatusOdds
          .starterOddsBasisPoints / 100
      ).toFixed(0)
    : null;

  // Generate analysis from API scores or fallback to local data
  const analysisText = hasScores
    ? generateAnalysis({ card, scores })
    : localAvgScore > 0
      ? generateLocalAnalysis({ card, avgScore: localAvgScore, nextGame })
      : "";

  const gradeColors: Record<string, string> = {
    A: "bg-green-500/20 text-green-400 border-green-500/30",
    B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    D: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[480px] max-h-full md:max-h-[85vh] bg-zinc-900 md:border md:border-zinc-700 md:rounded-xl shadow-2xl z-50 overflow-y-auto focus:outline-none">
          <Dialog.Title className="sr-only">{player.displayName} — Player Details</Dialog.Title>

          {/* Header */}
          <div className="flex items-center gap-4 p-5 border-b border-zinc-800">
            <div className="relative w-16 h-[84px] rounded-lg overflow-hidden bg-zinc-800 shrink-0">
              <Image
                src={card.pictureUrl}
                alt={player.displayName}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                  {posShort}
                </span>
                <span className="text-base font-bold text-white truncate">
                  {player.displayName}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mt-0.5">
                {player.activeClub?.name || "Free agent"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {editionInfo.bonus > 0 && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-1.5 py-0.5 rounded",
                      editionInfo.tier === "legendary"
                        ? "bg-amber-500/20 text-amber-400"
                        : editionInfo.tier === "holo"
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-blue-500/20 text-blue-400"
                    )}
                  >
                    {editionInfo.label}
                  </span>
                )}
                {powerBonus && (
                  <span className="text-[11px] font-semibold text-purple-400">
                    Power {powerBonus}
                  </span>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-zinc-500 hover:text-white transition-colors p-1 self-start">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 mt-2">Loading stats...</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* API error note */}
              {isError && (
                <div className="px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-500/20">
                  <p className="text-[11px] text-amber-300">
                    Could not load detailed scores. Showing available data from your collection.
                  </p>
                </div>
              )}

              {/* Next Game */}
              {nextGame && (
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5">
                    Next Game
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-base text-white font-semibold">
                      {nextGame.homeTeam.code} vs {nextGame.awayTeam.code}
                    </span>
                    <span className="text-xs text-zinc-300 bg-zinc-700 px-2.5 py-1 rounded">
                      {new Date(nextGame.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{", "}
                      {new Date(nextGame.date).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {nextGame.competition.name}
                    {" — "}
                    {nextGame.homeTeam.code === player.activeClub?.code ? "Home" : "Away"}
                  </p>
                </div>
              )}

              {/* Grade + Playing Chance */}
              {(grade || starterPct) && (
                <div className="flex items-center gap-3">
                  {grade && (
                    <div
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-bold",
                        gradeColors[grade] || "bg-zinc-800 text-zinc-400 border-zinc-700"
                      )}
                    >
                      Grade {grade}
                    </div>
                  )}
                  {starterPct && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
                      <span className="text-xs text-zinc-400">Starting</span>
                      <span className="text-sm font-bold text-white">
                        {starterPct}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Averages with tabs */}
              <div>
                <div className="flex items-center gap-1.5 mb-2.5">
                  {(["L5", "L10", "L40"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAvgTab(tab)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        avgTab === tab
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-6 bg-zinc-800/50 rounded-lg p-4">
                  <div>
                    <p className="text-[11px] text-zinc-500 uppercase mb-1">
                      Avg Score
                    </p>
                    <p
                      className={cn(
                        "text-2xl font-bold",
                        avgData.avg >= 60
                          ? "text-green-400"
                          : avgData.avg >= 40
                            ? "text-yellow-400"
                            : avgData.avg > 0
                              ? "text-orange-400"
                              : "text-zinc-300"
                      )}
                    >
                      {avgData.avg > 0 ? avgData.avg.toFixed(1) : "—"}
                    </p>
                  </div>
                  {avgData.total > 0 && (
                    <div>
                      <p className="text-[11px] text-zinc-500 uppercase mb-1">
                        Games Played
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {avgData.played}
                        <span className="text-base text-zinc-500">
                          /{avgData.total}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Score Chart */}
              {validScores.length > 0 && (
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">
                    Recent Scores
                  </p>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <ScoreChart scores={scores} />
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              {analysisText && (
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">
                    AI Analysis
                  </p>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <pre className="text-[13px] text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {analysisText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Fallback analysis when API scores are unavailable — uses local card data */
function generateLocalAnalysis({
  card,
  avgScore,
  nextGame,
}: {
  card: SorareCard;
  avgScore: number;
  nextGame?: { homeTeam: { code: string }; awayTeam: { code: string }; competition: { name: string } };
}) {
  const player = card.anyPlayer!;
  const editionInfo = getEditionInfo(card);
  const power = parseFloat(card.power) || 1;
  const lines: string[] = [];

  lines.push(`Average score (L15): ${avgScore.toFixed(1)}`);

  if (nextGame) {
    const isHome = nextGame.homeTeam.code === player.activeClub?.code;
    lines.push(`Next game: ${nextGame.homeTeam.code} vs ${nextGame.awayTeam.code} (${isHome ? "HOME" : "AWAY"})`);
    lines.push(`Competition: ${nextGame.competition.name}`);
  } else {
    lines.push("No upcoming game scheduled — will score 0 pts this GW.");
  }

  if (editionInfo.bonus > 0 || power > 1) {
    const parts: string[] = [];
    if (editionInfo.bonus > 0) parts.push(editionInfo.label);
    if (power > 1) parts.push(`Power +${Math.round((power - 1) * 100)}%`);
    lines.push(`Card bonuses: ${parts.join(", ")}`);
  }

  const expectedPts = avgScore * power * (1 + editionInfo.bonus);
  const rating = expectedPts >= 55 ? "STRONG" : expectedPts >= 35 ? "DECENT" : "WEAK";
  lines.push("");
  lines.push(`Verdict: ${rating} pick — expected ~${expectedPts.toFixed(0)} pts`);

  return lines.join("\n");
}
