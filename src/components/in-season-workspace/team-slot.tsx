"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { LineupPosition, SorareCard } from "@/lib/types";
import {
  useWorkspaceStore,
  type DragPayload,
} from "@/lib/in-season/workspace-store";
import { cn } from "@/lib/utils";
import { TONE, type ToneKey } from "./tones";
import {
  DRAG_MIME,
  cardPrimaryPosition,
  isValidDrop,
  serializePayload,
  tryParsePayload,
} from "./dnd";
import { PlayerChip } from "./player-chip";

const POS_COLOR: Record<LineupPosition, string> = {
  GK: "text-amber-300",
  DEF: "text-sky-300",
  MID: "text-emerald-300",
  FWD: "text-rose-300",
  EX: "text-zinc-300",
};

interface TeamSlotProps {
  position: LineupPosition;
  card: SorareCard | null;
  teamId: number;
  teamTone: ToneKey;
  isCaptain: boolean;
}

export function TeamSlot({
  position,
  card,
  teamId,
  teamTone,
  isCaptain,
}: TeamSlotProps) {
  const drag = useWorkspaceStore((s) => s.drag);
  const setDrag = useWorkspaceStore((s) => s.setDrag);
  const drop = useWorkspaceStore((s) => s.drop);
  const remove = useWorkspaceStore((s) => s.remove);
  const setCaptain = useWorkspaceStore((s) => s.setCaptain);
  const [hover, setHover] = useState(false);
  const tone = TONE[teamTone];

  const valid =
    drag != null && isValidDrop(drag, { teamId, position });
  const showHover = hover && valid;

  const onDragOver = (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!hover) setHover(true);
  };
  const onDragLeave = () => setHover(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const payload =
      drag ?? tryParsePayload(e.dataTransfer.getData(DRAG_MIME)) ??
      tryParsePayload(e.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (!isValidDrop(payload, { teamId, position })) return;
    drop(payload, { teamId, position });
    setDrag(null);
  };

  const onDragStart = (e: React.DragEvent) => {
    if (!card) return;
    const payload: DragPayload = {
      cardSlug: card.slug,
      from: "slot",
      teamId,
      position,
      cardPos: cardPrimaryPosition(card),
    };
    e.dataTransfer.effectAllowed = "move";
    const s = serializePayload(payload);
    e.dataTransfer.setData(DRAG_MIME, s);
    e.dataTransfer.setData("text/plain", s);
    setDrag(payload);
  };
  const onDragEnd = () => setDrag(null);

  const empty = !card;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative rounded-md border transition-all min-h-[44px] px-1.5 py-1",
        empty
          ? cn(
              "border-dashed",
              showHover
                ? `${tone.border} ${tone.soft}`
                : "border-zinc-800 bg-zinc-950/40",
            )
          : showHover
            ? `${tone.border} ring-1 ring-inset ${tone.bar.replace("bg-", "ring-")}`
            : `${tone.border} ${tone.soft}`,
      )}
    >
      <span
        className={cn(
          "absolute -left-px top-0 bottom-0 w-1 rounded-l",
          empty ? "bg-zinc-800" : tone.bar,
        )}
      />
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "mono text-[8px] font-black uppercase tracking-wider bg-zinc-950/70 border border-zinc-800 rounded px-1 py-0.5 leading-none w-7 text-center shrink-0",
            POS_COLOR[position],
          )}
        >
          {position}
        </span>
        {empty ? (
          <div className="flex-1 flex items-center gap-1.5 text-zinc-600">
            <div className="w-7 h-7 rounded-full border border-dashed border-zinc-800 grid place-items-center">
              <Plus className="w-3 h-3 text-zinc-700" />
            </div>
            <span className="text-[10px] mono">Drop player or click</span>
          </div>
        ) : (
          <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="flex-1 cursor-grab active:cursor-grabbing"
          >
            <PlayerChip
              card={card}
              dense
              captain={isCaptain}
              onToggleCaptain={() =>
                setCaptain(teamId, isCaptain ? null : card.slug)
              }
              onRemove={() => remove(teamId, position)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
