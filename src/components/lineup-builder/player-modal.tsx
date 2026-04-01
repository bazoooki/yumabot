"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { POSITION_SHORT } from "@/lib/types";
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

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["player-scores", player.slug, position],
    queryFn: () => fetchPlayerScores(player.slug, position),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const validScores = scores.filter(
    (s) => s.scoreStatus === "FINAL" && s.score > 0
  );

  function getAvg(count: number): { avg: number; played: number; total: number } {
    const subset = validScores.slice(0, Math.min(count, validScores.length));
    if (subset.length === 0) return { avg: 0, played: 0, total: 0 };
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

  const analysisText = scores.length > 0 ? generateAnalysis({ card, scores }) : "";

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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-y-auto focus:outline-none">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
            <div className="relative w-14 h-[72px] rounded overflow-hidden bg-zinc-800 shrink-0">
              <Image
                src={card.pictureUrl}
                alt={player.displayName}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                  {posShort}
                </span>
                <span className="text-sm font-bold text-white truncate">
                  {player.displayName}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {player.activeClub?.name || "Free agent"}
              </p>
              {editionInfo.bonus > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 inline-block",
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
            </div>
            <Dialog.Close asChild>
              <button className="text-zinc-500 hover:text-white transition-colors p-1">
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
            <div className="p-4 space-y-4">
              {/* Next Game */}
              {nextGame && (
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
                    Next Game
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-semibold">
                      {nextGame.homeTeam.code} vs {nextGame.awayTeam.code}
                    </span>
                    <span className="text-xs text-zinc-300 bg-zinc-700 px-2 py-0.5 rounded">
                      {new Date(nextGame.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {nextGame.competition.name}
                  </p>
                </div>
              )}

              {/* Grade + Playing Chance */}
              <div className="flex items-center gap-3">
                {grade && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold",
                      gradeColors[grade] || "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}
                  >
                    Grade {grade}
                  </div>
                )}
                {starterPct && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
                    <span className="text-xs text-zinc-400">Start%</span>
                    <span className="text-sm font-bold text-white">
                      {starterPct}%
                    </span>
                  </div>
                )}
              </div>

              {/* Averages with tabs */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  {(["L5", "L10", "L40"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAvgTab(tab)}
                      className={cn(
                        "px-3 py-1 rounded text-xs font-semibold transition-colors",
                        avgTab === tab
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 bg-zinc-800/50 rounded-lg p-3">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">
                      Avg Score
                    </p>
                    <p
                      className={cn(
                        "text-xl font-bold",
                        avgData.avg >= 60
                          ? "text-green-400"
                          : avgData.avg >= 40
                            ? "text-yellow-400"
                            : "text-zinc-300"
                      )}
                    >
                      {avgData.avg > 0 ? avgData.avg.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">
                      Games Played
                    </p>
                    <p className="text-xl font-bold text-white">
                      {avgData.played}
                      <span className="text-sm text-zinc-500">
                        /{avgData.total}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Chart */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">
                  Recent Scores
                </p>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <ScoreChart scores={scores} />
                </div>
              </div>

              {/* AI Analysis */}
              {analysisText && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">
                    AI Analysis
                  </p>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
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
