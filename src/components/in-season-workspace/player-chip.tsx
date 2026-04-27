"use client";

import Image from "next/image";
import { Star, X } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { estimateTotalScore } from "@/lib/ai-lineup";

interface PlayerChipProps {
  card: SorareCard;
  dense?: boolean;
  captain?: boolean;
  /** Pass to render a hover-action toggle. Optional. */
  onToggleCaptain?(): void;
  onRemove?(): void;
}

function gradeTone(g: string | null | undefined): string {
  if (!g) return "text-zinc-400";
  const c = g[0];
  if (c === "A") return "text-emerald-400";
  if (c === "B") return "text-lime-400";
  if (c === "C") return "text-yellow-400";
  if (c === "D") return "text-orange-400";
  return "text-red-400";
}

function startTone(p: number | null | undefined): string {
  if (p == null) return "text-zinc-400";
  if (p >= 80) return "text-emerald-400";
  if (p >= 50) return "text-amber-400";
  return "text-red-400";
}

export function PlayerChip({
  card,
  dense,
  captain,
  onToggleCaptain,
  onRemove,
}: PlayerChipProps) {
  const player = card.anyPlayer;
  if (!player) return null;

  const game = player.activeClub?.upcomingGames?.[0];
  const home = game?.homeTeam?.code;
  const away = game?.awayTeam?.code;
  const playerClubCode = player.activeClub?.code;
  const venue: "H" | "A" | null =
    home && playerClubCode
      ? home === playerClubCode
        ? "H"
        : away === playerClubCode
          ? "A"
          : null
      : null;

  const proj = Math.round(estimateTotalScore([card]));
  // We don't yet have an integrated grade source on the card; placeholder
  // until C.4 wires `playerIntel` into the chip. Falls back to the LAST_FIFTEEN
  // average band for a coarse signal.
  const avg = player.averageScore ?? null;
  const grade =
    avg == null
      ? null
      : avg >= 60
        ? "A"
        : avg >= 50
          ? "B"
          : avg >= 40
            ? "C"
            : "D";
  const startPct = null; // will plumb from playerIntel later

  return (
    <div className="relative group h-full">
      <div className="flex items-center gap-1.5 h-full">
        <div className="relative shrink-0">
          <div
            className={cn(
              "rounded-full border-2 border-zinc-700 bg-zinc-800 grid place-items-center overflow-hidden",
              dense ? "w-7 h-7" : "w-8 h-8",
            )}
          >
            {player.avatarPictureUrl ? (
              <Image
                src={player.avatarPictureUrl}
                alt={player.displayName}
                width={dense ? 28 : 32}
                height={dense ? 28 : 32}
                className="object-cover w-full h-full"
                sizes={dense ? "28px" : "32px"}
              />
            ) : (
              <span className="mono text-[9px] font-bold text-zinc-300">
                {player.displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          {captain && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 grid place-items-center rounded-full bg-amber-500 text-zinc-950 mono text-[8px] font-black leading-none">
              C
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-zinc-100 truncate leading-tight">
            {player.displayName}
          </div>
          <div className="flex items-center gap-1 mono text-[8px] text-zinc-500 leading-tight">
            {playerClubCode && (
              <>
                <span>{playerClubCode}</span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            {venue && (
              <>
                <span
                  className={
                    venue === "H" ? "text-cyan-400" : "text-amber-400"
                  }
                >
                  {venue}
                </span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            {grade && (
              <>
                <span className={cn("font-bold", gradeTone(grade))}>
                  {grade}
                </span>
                {startPct != null && <span className="text-zinc-700">·</span>}
              </>
            )}
            {startPct != null && (
              <span className={cn("font-bold", startTone(startPct))}>
                {startPct}%
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end leading-tight">
          <span className="text-[12px] font-bold tabular-nums text-pink-400">
            {proj}
          </span>
          <span className="mono text-[7px] text-zinc-500 uppercase">proj</span>
        </div>
      </div>
      {(onToggleCaptain || onRemove) && (
        <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1">
          {onToggleCaptain && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCaptain();
              }}
              className="w-5 h-5 grid place-items-center rounded-full bg-zinc-900 border border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-zinc-950"
              title="Toggle captain"
            >
              <Star className="w-2.5 h-2.5" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-5 h-5 grid place-items-center rounded-full bg-zinc-900 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-zinc-950"
              title="Remove"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
