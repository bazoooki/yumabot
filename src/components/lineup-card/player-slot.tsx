"use client";

import type { InSeasonSlot } from "@/lib/types";
import { ScoreBadge } from "./score-badge";
import { cn } from "@/lib/utils";

export type LineupCardVariant = "default" | "compact";

export function PlayerSlot({
  slot,
  variant,
}: {
  slot: InSeasonSlot;
  variant: LineupCardVariant;
}) {
  const isCompact = variant === "compact";
  const imgSrc = isCompact
    ? slot.playerPictureUrl ?? slot.pictureUrl
    : slot.pictureUrl;

  if (isCompact) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="relative">
          <div
            className={cn(
              "w-10 h-10 rounded-full overflow-hidden border-2 bg-zinc-800",
              slot.isCaptain ? "border-amber-500" : "border-zinc-700",
            )}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={slot.playerName ?? ""}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[8px] text-zinc-600 font-medium">
                  {slot.position || "?"}
                </span>
              </div>
            )}
          </div>
          {slot.isCaptain && (
            <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold text-amber-400 bg-zinc-900 rounded-full w-3 h-3 flex items-center justify-center leading-none">
              C
            </span>
          )}
        </div>
        <ScoreBadge
          score={slot.score}
          scoreStatus={slot.scoreStatus}
          size="sm"
        />
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <div className="relative">
        <div
          className={cn(
            "w-11 h-[52px] rounded-md overflow-hidden bg-zinc-800",
            slot.isCaptain && "ring-1 ring-amber-500/50",
          )}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={slot.playerName ?? ""}
              className="w-full h-full object-cover object-[center_15%]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[9px] text-zinc-600 font-medium">
                {slot.position || "?"}
              </span>
            </div>
          )}
        </div>
        {slot.isCaptain && (
          <span className="absolute -top-1 -right-1 text-[7px] font-bold text-amber-400 bg-zinc-900 rounded px-0.5 leading-none">
            C
          </span>
        )}
      </div>
      <ScoreBadge
        score={slot.score}
        scoreStatus={slot.scoreStatus}
        size="md"
      />
      <span className="text-[8px] text-zinc-500 truncate w-full text-center leading-tight">
        {slot.playerName?.split(" ").pop() ?? "Empty"}
      </span>
    </div>
  );
}
