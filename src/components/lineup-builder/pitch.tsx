"use client";

import { useState } from "react";
import Image from "next/image";
import { Info, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineupStore } from "@/lib/lineup-store";
import { estimateTotalScore } from "@/lib/ai-lineup";
import type { SorareCard } from "@/lib/types";
import { PlayerModal } from "./player-modal";

// Formation rows mapping to DEFAULT_SLOTS indices:
// GK=0, DEF=1, MID=2, FWD=3, EX=4
const FORMATION = {
  topRow: [
    { index: 3, label: "FWD" },
    { index: 4, label: "EX" },
  ],
  bottomRow: [
    { index: 1, label: "DEF" },
    { index: 0, label: "GK" },
    { index: 2, label: "MID" },
  ],
};

function PitchCardModal({ card }: { card: SorareCard }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="absolute top-1.5 right-1.5 text-zinc-500 hover:text-purple-400 transition-colors z-10"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <PlayerModal card={card} open={open} onOpenChange={setOpen} />
    </>
  );
}

function SlotCard({
  slotIndex,
  label,
}: {
  slotIndex: number;
  label: string;
}) {
  const { slots, selectedSlotIndex, selectSlot, removeCard, setCaptain } = useLineupStore();
  const slot = slots[slotIndex];
  const card = slot?.card;
  const isCaptain = slot?.isCaptain;
  const isSelected = selectedSlotIndex === slotIndex;
  const player = card?.anyPlayer;

  return (
    <button
      onClick={() => {
        if (card) {
          removeCard(slotIndex);
        } else {
          selectSlot(isSelected ? null : slotIndex);
        }
      }}
      className={cn(
        "relative w-[150px] h-[200px] rounded-xl transition-all flex flex-col items-center justify-center gap-2",
        card
          ? isCaptain
            ? "bg-zinc-800/80 border-2 border-amber-400 shadow-lg shadow-amber-500/20 backdrop-blur-sm"
            : "bg-zinc-800/80 border border-zinc-600 hover:border-red-500/50 backdrop-blur-sm"
          : isSelected
            ? "bg-purple-500/15 border-2 border-purple-400 animate-pulse backdrop-blur-sm"
            : "bg-white/5 border border-dashed border-zinc-500/50 hover:border-purple-500/50 backdrop-blur-sm"
      )}
    >
      {card && player ? (
        <>
          <PitchCardModal card={card} />
          {/* Captain toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCaptain(slotIndex);
            }}
            className={cn(
              "absolute top-1.5 left-1.5 z-10 p-1 rounded-full transition-all",
              isCaptain
                ? "bg-amber-500/30 text-amber-400"
                : "text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10"
            )}
            title={isCaptain ? "Remove captain" : "Set as captain (+50%)"}
          >
            <Crown className="w-4 h-4" />
          </button>
          <div className="relative w-24 h-[120px] rounded-lg overflow-hidden">
            <Image
              src={card.pictureUrl}
              alt={player.displayName}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <span className="text-[11px] text-zinc-200 font-semibold truncate w-full text-center px-2">
            {player.displayName.split(" ").pop()}
          </span>
          {/* Rival team + kickoff */}
          {(() => {
            const game = player.activeClub?.upcomingGames?.[0];
            if (!game) return null;
            const clubCode = player.activeClub?.code;
            const rival = game.homeTeam.code === clubCode ? game.awayTeam.code : game.homeTeam.code;
            const isHome = game.homeTeam.code === clubCode;
            const kickoff = new Date(game.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
            return (
              <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                <span className={isHome ? "text-zinc-300" : ""}>{isHome ? "vs" : "@"}</span>
                <span className="font-semibold text-zinc-300">{rival}</span>
                <span className="text-zinc-500">{kickoff}</span>
              </span>
            );
          })()}
          {isCaptain && (
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
              C +50%
            </span>
          )}
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-full border border-dashed border-zinc-500/60 flex items-center justify-center">
            <span className="text-base text-zinc-500">+</span>
          </div>
          <span className="text-sm text-zinc-500 font-semibold">
            {label}
          </span>
        </>
      )}
    </button>
  );
}

export function Pitch() {
  const { slots, targetScore } = useLineupStore();

  const filledCards = slots.map((s) => s.card);
  const captainIndex = slots.findIndex((s) => s.isCaptain);
  const totalEstimate = estimateTotalScore(filledCards, captainIndex >= 0 ? captainIndex : undefined);
  const filledCount = filledCards.filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Score Header */}
      <div className="px-5 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Hot Streaks</h3>
            <p className="text-[11px] text-zinc-500">Stellar Nights</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-lg font-bold",
                  totalEstimate >= targetScore ? "text-green-400" : "text-zinc-300"
                )}
              >
                ~{Math.round(totalEstimate)}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-sm text-zinc-400">{targetScore} PTS</span>
            </div>
            <p className="text-[10px] text-zinc-500">{filledCount}/5 players</p>
          </div>
        </div>
      </div>

      {/* Pitch Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/40 via-indigo-950/30 to-zinc-900">
          {/* Outer boundary */}
          <div className="absolute inset-x-6 top-[6%] bottom-[6%] border border-purple-500/10 rounded-lg" />
          {/* Center line */}
          <div className="absolute left-6 right-6 top-1/2 h-px bg-purple-500/10" />
          {/* Center circle */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-purple-500/10 rounded-full" />
          {/* Top penalty box */}
          <div className="absolute left-[20%] right-[20%] top-[6%] h-[22%] border-b border-l border-r border-purple-500/10 rounded-b-lg" />
          {/* Bottom penalty box */}
          <div className="absolute left-[20%] right-[20%] bottom-[6%] h-[22%] border-t border-l border-r border-purple-500/10 rounded-t-lg" />
        </div>

        {/* Formation Grid */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-10 py-8">
          {/* Top row: FWD + EX */}
          <div className="flex items-center justify-center gap-8">
            {FORMATION.topRow.map(({ index, label }) => (
              <SlotCard key={label} slotIndex={index} label={label} />
            ))}
          </div>

          {/* Bottom row: DEF + GK + MID */}
          <div className="flex items-center justify-center gap-5">
            {FORMATION.bottomRow.map(({ index, label }) => (
              <SlotCard key={label} slotIndex={index} label={label} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {filledCount === 0 && (
        <div className="px-4 py-3 text-center border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            Select 5 players to build your lineup
          </p>
        </div>
      )}
    </div>
  );
}
