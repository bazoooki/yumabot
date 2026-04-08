"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Crown, CheckCircle2, X } from "lucide-react";
import { cn, formatKickoffTime, getKickoffUrgency } from "@/lib/utils";
import { useLineupStore } from "@/lib/lineup-store";
import { getEditionInfo } from "@/lib/ai-lineup";
import type { PlayerIntel } from "@/lib/types";
import { PlayerModal } from "./player-modal";

/* ─── Filled card on pitch ─── */
export function FilledSlot({
  slotIndex,
  intel,
}: {
  slotIndex: number;
  intel?: PlayerIntel;
}) {
  const { slots, removeCard, setCaptain } = useLineupStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const slot = slots[slotIndex];
  const card = slot.card!;
  const player = card.anyPlayer!;
  const isCaptain = slot.isCaptain;

  const isUnavailable =
    intel?.fieldStatus === "INJURED" ||
    intel?.fieldStatus === "SUSPENDED" ||
    intel?.fieldStatus === "NOT_IN_SQUAD";
  const isConfirmed =
    intel?.reliability === "HIGH" && intel?.fieldStatus === "ON_FIELD";

  // Expected score
  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const editionInfo = getEditionInfo(card);
  const expectedScore = isUnavailable
    ? 0
    : avgScore * power * (1 + editionInfo.bonus);

  // Game info
  const game = player.activeClub?.upcomingGames?.[0];
  const clubCode = player.activeClub?.code;
  const rival = game
    ? game.homeTeam.code === clubCode
      ? game.awayTeam.code
      : game.homeTeam.code
    : null;
  const isHome = game ? game.homeTeam.code === clubCode : false;
  const kickoff = game ? formatKickoffTime(game.date) : null;
  const urgency = game ? getKickoffUrgency(game.date) : "no-game";

  const starterProb = intel?.starterProbability;

  return (
    <>
      <div
        className={cn(
          "relative w-[100px] h-[130px] md:w-[136px] md:h-[180px] rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer select-none",
          isCaptain
            ? "ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/15"
            : isUnavailable
              ? "ring-1 ring-red-500/40 opacity-60"
              : "ring-1 ring-white/[0.08] hover:ring-purple-400/40",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => removeCard(slotIndex)}
      >
        {/* Card image — fills entire slot */}
        <Image
          src={card.pictureUrl}
          alt={player.displayName}
          fill
          className="object-cover object-[center_18%] scale-[1.15]"
          sizes="(max-width: 768px) 100px, 136px"
        />

        {/* Unavailable red tint */}
        {isUnavailable && <div className="absolute inset-0 bg-red-900/40" />}

        {/* Hover overlay — "Remove" */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 transition-opacity duration-150 z-20",
            hovered ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <X className="w-5 h-5 text-white/90" />
          <span className="text-[10px] text-white/70 font-medium">Remove</span>
        </div>

        {/* ── Top row: captain + status badges ── */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between z-10">
          {/* Captain toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCaptain(slotIndex);
            }}
            className={cn(
              "p-1 rounded-lg transition-all backdrop-blur-sm",
              isCaptain
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                : "bg-black/40 text-white/40 hover:text-amber-400 hover:bg-black/60",
            )}
            title={isCaptain ? "Remove captain" : "Set as captain (+50%)"}
          >
            <Crown className="w-3.5 h-3.5" />
          </button>

          {/* Status / starter % / info */}
          <div className="flex items-center gap-1">
            {isUnavailable && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-500 text-white">
                {intel.fieldStatus === "INJURED" ? "INJ" : "OUT"}
              </span>
            )}
            {isConfirmed && !isUnavailable && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-green-500 text-white flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> CONF
              </span>
            )}
            {!isConfirmed && !isUnavailable && starterProb != null && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm",
                  starterProb >= 70
                    ? "bg-green-600/90 text-white"
                    : starterProb >= 50
                      ? "bg-yellow-500/90 text-black"
                      : "bg-red-500/90 text-white",
                )}
              >
                {Math.round(starterProb)}%
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="p-1 rounded-lg bg-black/40 text-white/40 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Bottom gradient with player info ── */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 pb-2 px-2.5 z-10">
          {/* Score + captain multiplier */}
          <div className="flex items-center justify-between mb-1">
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                isUnavailable
                  ? "bg-red-500/20 text-red-400"
                  : expectedScore >= 60
                    ? "bg-green-500/25 text-green-400"
                    : expectedScore >= 40
                      ? "bg-yellow-500/25 text-yellow-400"
                      : "bg-white/10 text-zinc-400",
              )}
            >
              {isUnavailable ? "0" : `~${Math.round(expectedScore)}`}
            </span>
            {isCaptain && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                C x1.5
              </span>
            )}
          </div>

          {/* Player name */}
          <p className="text-[12px] font-bold text-white truncate leading-tight">
            {player.displayName.split(" ").pop()}
          </p>

          {/* Match info */}
          {game && rival ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "text-[9px]",
                  isHome ? "text-zinc-300" : "text-zinc-500",
                )}
              >
                {isHome ? "vs" : "@"}
              </span>
              <span className="text-[10px] font-bold text-zinc-200">
                {rival}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold ml-auto",
                  urgency === "imminent"
                    ? "text-green-400"
                    : urgency === "soon"
                      ? "text-yellow-300"
                      : "text-zinc-500",
                )}
              >
                {kickoff}
              </span>
            </div>
          ) : (
            <p className="text-[9px] text-red-400/50 mt-0.5">No game</p>
          )}
        </div>
      </div>

      <PlayerModal card={card} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
