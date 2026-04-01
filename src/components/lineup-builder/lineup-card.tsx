"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITION_SHORT, type SorareCard } from "@/lib/types";
import { getEditionInfo } from "@/lib/ai-lineup";
import { PlayerModal } from "./player-modal";

interface LineupCardProps {
  card: SorareCard;
  disabled?: boolean;
  onClick?: () => void;
}

export const LineupCard = memo(function LineupCard({
  card,
  disabled,
  onClick,
}: LineupCardProps) {
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

  return (
    <>
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3.5 p-3 rounded-xl border transition-all text-left",
        disabled
          ? "opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-900/50"
          : "border-zinc-700/60 bg-zinc-900 hover:border-purple-500/50 hover:bg-zinc-800/80 cursor-pointer"
      )}
    >
      {/* Card Image */}
      <div className="relative w-16 h-[84px] rounded-lg overflow-hidden bg-zinc-800 shrink-0">
        <Image
          src={card.pictureUrl}
          alt={player.displayName}
          fill
          className="object-cover"
          sizes="64px"
        />
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
            <span className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] ml-auto">
              {new Date(nextGame.date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
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
