"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Clock,
  ChevronDown,
  ChevronRight,
  Users,
  Target,
} from "lucide-react";
import {
  cn,
  formatKickoffTime,
  getKickoffUrgency,
} from "@/lib/utils";
import { STRATEGY_TAG_STYLES, getGradeStyle } from "@/lib/ui-config";
import type {
  PlayerIntel,
  ScoredCardWithStrategy,
  SorareCard,
} from "@/lib/types";

export interface GameBatchEntry {
  windowLabel: string;
  /** ISO timestamp of the batch's earliest kickoff, or null when unknown. */
  kickoffISO: string | null;
  expectedTotal: number;
  playerCount: number;
  viable: boolean;
  posCount: {
    Goalkeeper: number;
    Defender: number;
    Midfielder: number;
    Forward: number;
  };
  games: {
    home: string;
    away: string;
    date: string;
    competition: string;
  }[];
  bestCards: ScoredCardWithStrategy[];
  allPlayers: ScoredCardWithStrategy[];
  /** Cards that go into "Fill lineup from this batch". */
  fillCards: SorareCard[];
}

export interface GameBatchListProps {
  batches: GameBatchEntry[];
  targetScore: number;
  playerIntel?: Record<string, PlayerIntel> | null;
  onFill?: (cards: SorareCard[]) => void;
}

export function GameBatchList({
  batches,
  targetScore,
  playerIntel,
  onFill,
}: GameBatchListProps) {
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-blue-400" />
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          Game Batches
        </h3>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {batches.length} batches
        </span>
      </div>

      {batches.length === 0 ? (
        <p className="text-[11px] text-zinc-500 px-2">No upcoming games found</p>
      ) : (
        <div className="space-y-2">
          {batches.map((batch, i) => {
            const isExpanded = expandedBatch === i;
            const urgency = batch.kickoffISO
              ? getKickoffUrgency(batch.kickoffISO)
              : "later";

            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border overflow-hidden transition-all",
                  batch.viable ? "border-green-500/20" : "border-zinc-700/50",
                  isExpanded ? "bg-zinc-800/60" : "bg-zinc-800/30",
                )}
              >
                <button
                  onClick={() => setExpandedBatch(isExpanded ? null : i)}
                  className="w-full text-left p-3 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {urgency === "imminent" && (
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                    )}
                    {urgency === "soon" && (
                      <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                    )}
                    <span className="text-[11px] font-semibold text-zinc-300 flex-1">
                      {batch.windowLabel}
                    </span>
                    {batch.viable && (
                      <span className="text-[9px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded shrink-0">
                        VIABLE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 ml-7">
                    <span className="text-[10px] text-zinc-500">
                      <Users className="w-3 h-3 inline mr-0.5" />
                      {batch.playerCount}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      GK:{batch.posCount.Goalkeeper} DF:{batch.posCount.Defender}{" "}
                      MD:{batch.posCount.Midfielder} FW:{batch.posCount.Forward}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold ml-auto",
                        batch.expectedTotal >= targetScore
                          ? "text-green-400"
                          : "text-zinc-400",
                      )}
                    >
                      ~{batch.expectedTotal} pts
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-700/40 px-3 pb-3 space-y-3">
                    <div className="pt-2">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">
                        Matches
                      </p>
                      <div className="space-y-1">
                        {batch.games.map((game, gi) => (
                          <div
                            key={gi}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50 text-[11px]"
                          >
                            <span className="font-semibold text-zinc-300">
                              {game.home}
                            </span>
                            <span className="text-zinc-600">vs</span>
                            <span className="font-semibold text-zinc-300">
                              {game.away}
                            </span>
                            <span className="text-zinc-600 ml-auto text-[10px]">
                              {game.competition}
                            </span>
                            <span
                              className={cn(
                                "font-bold text-[10px]",
                                getKickoffUrgency(game.date) === "imminent"
                                  ? "text-green-400"
                                  : getKickoffUrgency(game.date) === "soon"
                                    ? "text-yellow-300"
                                    : "text-zinc-500",
                              )}
                            >
                              {formatKickoffTime(game.date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1.5">
                        <Target className="w-3 h-3 inline mr-0.5" />
                        Best 5 for this batch
                      </p>
                      <div className="space-y-1">
                        {batch.bestCards.slice(0, 5).map((sc, pi) => {
                          const player = sc.card.anyPlayer!;
                          const pos =
                            player.cardPositions?.[0]?.slice(0, 3).toUpperCase() ||
                            "???";
                          const grade = player.slug
                            ? playerIntel?.[player.slug]?.projectionGrade
                            : null;
                          const gs = getGradeStyle(grade);
                          return (
                            <div
                              key={sc.card.slug}
                              className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-900/50"
                            >
                              <span
                                className={cn(
                                  "text-[10px] font-bold w-4 text-center",
                                  pi < 3 ? "text-amber-400" : "text-zinc-500",
                                )}
                              >
                                {pi + 1}
                              </span>
                              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                                <Image
                                  src={sc.card.pictureUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="24px"
                                />
                              </div>
                              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1 rounded">
                                {pos}
                              </span>
                              <span className="text-[11px] font-semibold text-zinc-200 truncate flex-1">
                                {player.displayName}
                              </span>
                              {gs && (
                                <span
                                  className={cn(
                                    "text-[9px] font-bold px-1 py-0.5 rounded text-white",
                                    gs.bg,
                                  )}
                                >
                                  {grade}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "text-[10px] font-bold",
                                  sc.strategy.expectedScore >= 60
                                    ? "text-green-400"
                                    : sc.strategy.expectedScore >= 40
                                      ? "text-yellow-400"
                                      : "text-zinc-400",
                                )}
                              >
                                {Math.round(sc.strategy.expectedScore)}
                              </span>
                              <span
                                className={cn(
                                  "text-[9px] font-bold px-1 py-0.5 rounded",
                                  `${STRATEGY_TAG_STYLES[sc.strategy.strategyTag].text} ${STRATEGY_TAG_STYLES[sc.strategy.strategyTag].bg}`,
                                )}
                              >
                                {sc.strategy.strategyTag}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

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
                              <Image
                                src={sc.card.pictureUrl}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="28px"
                              />
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

                    {onFill && batch.playerCount >= 4 && (
                      <button
                        onClick={() => onFill(batch.fillCards)}
                        className={cn(
                          "w-full text-[11px] font-semibold rounded-lg py-2 transition-colors",
                          batch.viable
                            ? "text-green-300 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20"
                            : "text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20",
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
  );
}
