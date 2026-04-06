"use client";

import { memo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatKickoffTime, getKickoffUrgency } from "@/lib/utils";
import { type SorareCard, type CardStrategyMetrics, type StrategyTag, type PlayerIntel } from "@/lib/types";
import { STRATEGY_TAG_STYLES, POSITION_SHORT } from "@/lib/ui-config";
import type { PlayerForm } from "@/lib/hooks";
import { getEditionInfo } from "@/lib/ai-lineup";

interface GridCardProps {
  card: SorareCard;
  strategy?: CardStrategyMetrics;
  starterProbability?: number | null;
  playerIntel?: PlayerIntel;
  playerForm?: PlayerForm;
  disabled?: boolean;
  onClick?: () => void;
}

export const GridCard = memo(function GridCard({
  card,
  strategy,
  starterProbability,
  playerIntel,
  playerForm,
  disabled,
  onClick,
}: GridCardProps) {
  const player = card.anyPlayer;
  if (!player) return null;

  const position = player.cardPositions?.[0] || "Unknown";
  const posShort = POSITION_SHORT[position] || "??";
  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const powerBonus = power > 1 ? `+${Math.round((power - 1) * 100)}%` : null;
  const editionInfo = getEditionInfo(card);
  const upcomingGames = player.activeClub?.upcomingGames || [];
  const nextGame = upcomingGames[0];
  const clubCode = player.activeClub?.code;

  const fieldStatus = playerIntel?.fieldStatus;
  const isUnavailable = fieldStatus === "INJURED" || fieldStatus === "SUSPENDED" || fieldStatus === "NOT_IN_SQUAD";
  const isConfirmed = playerIntel?.reliability === "HIGH" && fieldStatus === "ON_FIELD";

  const effectiveStarterProb = starterProbability !== undefined ? starterProbability : null;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative rounded-xl overflow-hidden border transition-all text-left group",
        disabled
          ? "opacity-40 cursor-not-allowed border-zinc-800"
          : isUnavailable
            ? "opacity-50 border-red-500/30"
            : "border-zinc-700/40 hover:border-purple-500/50 cursor-pointer"
      )}
    >
      {/* Card Image — mild zoom, crop bottom card info */}
      <div className="relative aspect-[5/6] w-full bg-zinc-800 overflow-hidden">
        <Image
          src={card.pictureUrl}
          alt={player.displayName}
          fill
          className="object-cover object-[center_15%] scale-110"
          sizes="160px"
        />

        {/* Starter probability — top right, large */}
        {effectiveStarterProb != null && (
          <div className={cn(
            "absolute top-1 right-1 px-2 py-1 rounded-lg text-xs font-bold shadow-lg",
            isUnavailable
              ? "bg-red-600 text-white"
              : isConfirmed
                ? "bg-green-500 text-white"
                : effectiveStarterProb >= 70
                  ? "bg-green-600 text-white"
                  : effectiveStarterProb >= 50
                    ? "bg-yellow-500 text-black"
                    : effectiveStarterProb > 0
                      ? "bg-red-500 text-white"
                      : "bg-zinc-600 text-zinc-300"
          )}>
            {isUnavailable
              ? fieldStatus === "INJURED" ? "INJ" : "OUT"
              : isConfirmed
                ? "CONF"
                : `${Math.round(effectiveStarterProb)}%`
            }
          </div>
        )}

        {/* Strategy tag — top left */}
        {strategy && (
          <div className={cn(
            "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow-lg",
            STRATEGY_TAG_STYLES[strategy.strategyTag].bgSolid
          )}>
            {strategy.strategyTag}
          </div>
        )}

        {/* Red overlay for unavailable */}
        {isUnavailable && <div className="absolute inset-0 bg-red-900/30" />}
      </div>

      {/* Info bar */}
      <div className="px-1.5 py-1.5 bg-zinc-900">
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-bold text-zinc-400 bg-zinc-800 px-1 rounded shrink-0">{posShort}</span>
          <p className="text-[10px] font-bold text-white truncate">{player.displayName}</p>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={cn(
            "text-[9px] font-bold px-1 py-0.5 rounded",
            avgScore >= 60 ? "bg-green-500/20 text-green-400" :
            avgScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
            "bg-zinc-700 text-zinc-400"
          )}>
            {avgScore > 0 ? Math.round(avgScore) : "—"}
          </span>
          {playerForm && (
            <span className={cn(
              "text-[9px] font-bold",
              playerForm.trend === "rising" ? "text-green-400" :
              playerForm.trend === "falling" ? "text-red-400" : "text-zinc-600"
            )}>
              {playerForm.trend === "rising" ? "↑" : playerForm.trend === "falling" ? "↓" : "→"}
            </span>
          )}
          {powerBonus && <span className="text-[8px] text-purple-400">{powerBonus}</span>}
          {editionInfo.bonus > 0 && <span className="text-[8px] text-blue-400">{editionInfo.label.split(" ")[0]}</span>}
        </div>
        {nextGame ? (
          <div className="flex items-center justify-between mt-1 text-[8px] text-zinc-500">
            <span>
              <span className={cn("font-semibold", nextGame.homeTeam.code === clubCode ? "text-zinc-300" : "")}>{nextGame.homeTeam.code}</span>
              {" v "}
              <span className={cn("font-semibold", nextGame.awayTeam.code === clubCode ? "text-zinc-300" : "")}>{nextGame.awayTeam.code}</span>
            </span>
            <span className={cn(
              "font-bold",
              getKickoffUrgency(nextGame.date) === "imminent" ? "text-green-400" :
              getKickoffUrgency(nextGame.date) === "soon" ? "text-yellow-300" : "text-zinc-500"
            )}>
              {formatKickoffTime(nextGame.date)}
            </span>
          </div>
        ) : (
          <p className="text-[8px] text-red-400/70 mt-1">No game</p>
        )}
      </div>
    </button>
  );
});
