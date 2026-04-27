"use client";

import Image from "next/image";
import { GripVertical } from "lucide-react";
import type { LineupPosition, SorareCard } from "@/lib/types";
import {
  useWorkspaceStore,
  type DragPayload,
} from "@/lib/in-season/workspace-store";
import { cn } from "@/lib/utils";
import { TEAM_TONES, TONE } from "./tones";
import {
  DRAG_MIME,
  cardPrimaryPosition,
  serializePayload,
} from "./dnd";

const POS_COLOR: Record<LineupPosition, string> = {
  GK: "text-amber-300",
  DEF: "text-sky-300",
  MID: "text-emerald-300",
  FWD: "text-rose-300",
  EX: "text-zinc-300",
};

interface CardPoolRowProps {
  card: SorareCard;
  /** Indexes of teams that already use this card (multi-team contention badge). */
  usage: number[];
  isEligible: boolean;
}

export function CardPoolRow({ card, usage, isEligible }: CardPoolRowProps) {
  const drag = useWorkspaceStore((s) => s.drag);
  const setDrag = useWorkspaceStore((s) => s.setDrag);

  const beingDragged =
    drag?.from === "pool" && drag.cardSlug === card.slug;
  const used = usage.length > 0;
  const player = card.anyPlayer;
  if (!player) return null;
  const pos = cardPrimaryPosition(card);
  const game = player.activeClub?.upcomingGames?.[0];
  const playerClubCode = player.activeClub?.code;
  const venue: "H" | "A" | null =
    game && playerClubCode
      ? game.homeTeam?.code === playerClubCode
        ? "H"
        : game.awayTeam?.code === playerClubCode
          ? "A"
          : null
      : null;

  const whenLabel = game
    ? new Date(game.date).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
      })
    : "—";

  const onDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = {
      cardSlug: card.slug,
      from: "pool",
      cardPos: pos,
    };
    e.dataTransfer.effectAllowed = "move";
    const s = serializePayload(payload);
    e.dataTransfer.setData(DRAG_MIME, s);
    e.dataTransfer.setData("text/plain", s);
    setDrag(payload);
  };
  const onDragEnd = () => setDrag(null);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border transition-all px-2 py-1.5 cursor-grab active:cursor-grabbing",
        beingDragged && "opacity-40",
        used
          ? "border-zinc-800 bg-zinc-950/60"
          : "border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80",
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-3 h-3 text-zinc-600 shrink-0" />
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full border-2 border-zinc-700 bg-zinc-800 grid place-items-center overflow-hidden">
            {player.avatarPictureUrl ? (
              <Image
                src={player.avatarPictureUrl}
                alt={player.displayName}
                width={36}
                height={36}
                className="object-cover w-full h-full"
                sizes="36px"
              />
            ) : (
              <span className="mono text-[10px] font-bold text-zinc-300">
                {player.displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2 mono text-[8px] font-bold bg-zinc-950 border border-zinc-700 rounded px-1 leading-tight",
              POS_COLOR[pos],
            )}
          >
            {pos}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-zinc-100 truncate">
              {player.displayName}
            </span>
            {isEligible ? (
              <span className="mono text-[7px] font-black px-1 py-px rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                IS
              </span>
            ) : (
              <span className="mono text-[7px] font-bold px-1 py-px rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
                non-IS
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mono text-[9px] text-zinc-500">
            {playerClubCode && (
              <>
                <span>{playerClubCode}</span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            <span>{whenLabel}</span>
            {venue && (
              <>
                <span className="text-zinc-700">·</span>
                <span
                  className={
                    venue === "H" ? "text-cyan-400" : "text-amber-400"
                  }
                >
                  {venue}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <ProjBadge card={card} />
        </div>
      </div>
      {used && (
        <div className="mt-1 flex items-center gap-1">
          <span className="mono text-[8px] uppercase text-zinc-500">In:</span>
          {usage.map((i) => {
            const tone = TONE[TEAM_TONES[i]];
            return (
              <span
                key={i}
                className={cn(
                  "mono text-[8px] font-bold uppercase px-1 rounded",
                  tone.soft,
                  tone.text,
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjBadge({ card }: { card: SorareCard }) {
  // Coarse projection from average score until C.5/playerIntel wires real intel.
  const avg = card.anyPlayer?.averageScore ?? null;
  const proj = avg != null ? Math.round(avg) : null;
  return (
    <div className="flex items-baseline gap-0.5 justify-end">
      <span className="text-sm font-bold tabular-nums text-pink-400">
        {proj ?? "—"}
      </span>
      <span className="mono text-[8px] text-zinc-500 uppercase">proj</span>
    </div>
  );
}
