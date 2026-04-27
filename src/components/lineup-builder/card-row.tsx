"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Info } from "lucide-react";
import { cn, getKickoffUrgency, formatKickoffTime, formatKickoffDate } from "@/lib/utils";
import { type SorareCard, type CardStrategyMetrics, type PlayerIntel } from "@/lib/types";
import { STRATEGY_TAG_STYLES, POSITION_SHORT } from "@/lib/ui-config";
import type { PlayerForm } from "@/lib/hooks";
import { getEditionInfo } from "@/lib/ai-lineup";
import { PlayerModal } from "./player-modal";

interface CardRowProps {
  card: SorareCard;
  strategy?: CardStrategyMetrics;
  starterProbability?: number | null;
  playerIntel?: PlayerIntel;
  playerForm?: PlayerForm;
  disabled?: boolean;
  onClick?: () => void;
}

export const CardRow = memo(function CardRow({
  card,
  strategy,
  starterProbability,
  playerIntel,
  playerForm,
  disabled,
  onClick,
}: CardRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const player = card.anyPlayer;
  if (!player) return null;

  const position = player.cardPositions?.[0] || "Unknown";
  const posShort = POSITION_SHORT[position] || position.slice(0, 2).toUpperCase();
  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const powerBonus = power > 1 ? `+${Math.round((power - 1) * 100)}%` : null;
  const editionInfo = getEditionInfo(card);
  const upcomingGames = player.activeClub?.upcomingGames || [];
  const nextGame = upcomingGames[0];
  const clubCode = player.activeClub?.code;

  // undefined = not fetched yet, null = no data, number = real value
  const hasGame = upcomingGames.length > 0;
  const effectiveStarterProb = starterProbability !== undefined ? starterProbability : null;
  const showStarterBadge = hasGame;

  // Intel-derived status
  const fieldStatus = playerIntel?.fieldStatus;
  const isUnavailable = fieldStatus === "INJURED" || fieldStatus === "SUSPENDED" || fieldStatus === "NOT_IN_SQUAD";
  const isConfirmed = playerIntel?.reliability === "HIGH" && fieldStatus === "ON_FIELD";
  const isConfirmedOut = playerIntel?.reliability === "HIGH" && (fieldStatus === "BENCH" || isUnavailable);

  return (
    <>
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3.5 p-3 rounded-xl border transition-all text-left",
        disabled
          ? "opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-900/50"
          : isUnavailable
            ? "opacity-50 border-red-500/30 bg-zinc-900 cursor-pointer"
            : "border-zinc-700/60 bg-zinc-900 hover:border-purple-500/50 hover:bg-zinc-800/80 cursor-pointer"
      )}
    >
      {/* Card Image — scaled up and shifted to show player face, crop bottom name */}
      <div className="relative w-20 h-[105px] rounded-lg overflow-hidden bg-zinc-800 shrink-0">
        <Image
          src={card.pictureUrl}
          alt={player.displayName}
          fill
          className="object-cover object-top scale-125 -translate-y-1"
          sizes="80px"
        />
        {/* Status overlay badge — bottom center */}
        {showStarterBadge && (
          <div className={cn(
            "absolute bottom-0 inset-x-0 text-center py-0.5 text-[11px] font-bold",
            isUnavailable
              ? "bg-red-600 text-white"
              : isConfirmed
                ? "bg-green-500 text-white"
                : isConfirmedOut
                  ? "bg-red-500 text-white"
                  : effectiveStarterProb == null
                    ? "bg-zinc-800/80 text-zinc-500"
                    : effectiveStarterProb >= 90
                      ? "bg-green-500 text-white"
                      : effectiveStarterProb >= 70
                        ? "bg-green-600/90 text-white"
                        : effectiveStarterProb >= 50
                          ? "bg-yellow-500/90 text-black"
                          : effectiveStarterProb > 0
                            ? "bg-red-500/90 text-white"
                            : "bg-zinc-600 text-zinc-300"
          )}>
            {isUnavailable
              ? fieldStatus === "INJURED" ? "INJURED" : fieldStatus === "SUSPENDED" ? "SUSPENDED" : "NOT IN SQUAD"
              : isConfirmed
                ? "CONFIRMED"
                : isConfirmedOut
                  ? fieldStatus === "BENCH" ? "BENCH" : "CONFIRMED OUT"
                  : effectiveStarterProb != null ? `${Math.round(effectiveStarterProb)}%` : "—%"
            }
          </div>
        )}
        {/* Red overlay tint for unavailable */}
        {isUnavailable && (
          <div className="absolute inset-0 bg-red-900/30 rounded-lg" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
            {posShort}
          </span>
          <span className="text-sm font-bold text-white truncate">
            {player.displayName}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(true);
            }}
            className="text-zinc-500 hover:text-purple-400 transition-colors shrink-0 ml-auto"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Club */}
        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
          {player.activeClub?.name || "Free agent"}
        </p>

        {/* Score + Power + Edition */}
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded",
              avgScore >= 60
                ? "bg-green-500/20 text-green-400"
                : avgScore >= 40
                  ? "bg-yellow-500/20 text-yellow-400"
                  : avgScore >= 20
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-zinc-700 text-zinc-400"
            )}
          >
            {avgScore > 0 ? Math.round(avgScore) : "—"} AVG
          </span>
          {playerForm && (
            <span className={cn(
              "text-[11px] font-bold",
              playerForm.trend === "rising" ? "text-green-400" :
              playerForm.trend === "falling" ? "text-red-400" : "text-zinc-500"
            )}>
              {playerForm.trend === "rising" ? "↑" : playerForm.trend === "falling" ? "↓" : "→"}
            </span>
          )}
          {playerForm && playerForm.avgMinutes > 0 && (
            <span className="text-[10px] text-zinc-500">{playerForm.avgMinutes}&apos;</span>
          )}
          {powerBonus && (
            <span className="text-[11px] font-semibold text-purple-400">
              {powerBonus}
            </span>
          )}
          {editionInfo.bonus > 0 && (
            <span
              className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded",
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
          {strategy && (
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto",
                STRATEGY_TAG_STYLES[strategy.strategyTag].bg,
                STRATEGY_TAG_STYLES[strategy.strategyTag].text,
              )}
              title={strategy.strategyReason}
            >
              {strategy.strategyTag}
            </span>
          )}
        </div>

        {/* Next Match */}
        {nextGame ? (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-500">
            <span className={cn(
              "font-semibold",
              nextGame.homeTeam.code === clubCode ? "text-zinc-300" : ""
            )}>
              {nextGame.homeTeam.code}
            </span>
            <span>vs</span>
            <span className={cn(
              "font-semibold",
              nextGame.awayTeam.code === clubCode ? "text-zinc-300" : ""
            )}>
              {nextGame.awayTeam.code}
            </span>
            {(() => {
              const urgency = getKickoffUrgency(nextGame.date);
              return (
                <div className="flex items-center gap-1 ml-auto">
                  {urgency === "imminent" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  )}
                  {urgency === "soon" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  )}
                  <div className="flex flex-col items-end bg-zinc-800 px-1.5 py-0.5 rounded">
                    <span className={cn(
                      "text-[11px] font-bold leading-tight",
                      urgency === "imminent" ? "text-green-400" : urgency === "soon" ? "text-yellow-300" : "text-zinc-300"
                    )}>
                      {formatKickoffTime(nextGame.date)}
                    </span>
                    <span className="text-[9px] text-zinc-500 leading-tight">
                      {formatKickoffDate(nextGame.date)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="text-[11px] text-red-400/70 mt-2">No upcoming game</div>
        )}
      </div>
    </button>
    <PlayerModal card={card} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
});
