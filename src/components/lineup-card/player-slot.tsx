"use client";

import type { InSeasonSlot } from "@/lib/types";
import { ScoreBadge } from "./score-badge";
import { cn } from "@/lib/utils";

export type LineupCardVariant = "default" | "compact";

/** Format game date as short label: "12 SUN" */
function formatGameTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getDate();
  const weekday = d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
  return `${day} ${weekday}`;
}

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

  const status = (slot.scoreStatus ?? "").toLowerCase();
  const isPlaying = status === "live" || status === "playing" || status === "started";
  const isFinal = status === "done" || status === "final" || status === "reviewed";
  const isScheduled = status === "scheduled" || status === "";
  const isDNP = slot.score != null && slot.score === 0 && isFinal;
  const hasScore = slot.score != null && (slot.score > 0 || isPlaying || isFinal);

  const gameTime = isScheduled ? formatGameTime(slot.gameDate) : null;
  const gameMatchup = slot.gameHomeCode && slot.gameAwayCode
    ? `${slot.gameHomeCode} - ${slot.gameAwayCode}`
    : null;

  if (isCompact) {
    return (
      <div className="flex flex-col items-center gap-0.5 w-[46px]">
        <div className={cn("relative", isDNP && "opacity-40")}>
          <div
            className={cn(
              "w-10 h-10 rounded-full overflow-hidden border-2 bg-zinc-800",
              slot.isCaptain ? "border-amber-500" :
              isPlaying ? "border-green-500/60" :
              "border-zinc-700",
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
          {isPlaying && !slot.isCaptain && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-zinc-900 animate-pulse" />
          )}
        </div>

        {/* Score or upcoming game time */}
        {hasScore ? (
          <ScoreBadge score={slot.score} scoreStatus={slot.scoreStatus} size="sm" />
        ) : gameTime ? (
          <span className="text-[8px] text-zinc-500 font-medium text-center leading-tight truncate w-full">
            {gameTime}
          </span>
        ) : (
          <span className="text-[9px] text-zinc-700 font-medium">–</span>
        )}

        {/* Game matchup for scheduled */}
        {isScheduled && gameMatchup && (
          <span className="text-[7px] text-zinc-600 text-center leading-tight truncate w-full">
            {gameMatchup}
          </span>
        )}
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
      {hasScore ? (
        <ScoreBadge score={slot.score} scoreStatus={slot.scoreStatus} size="md" />
      ) : gameTime ? (
        <span className="text-[8px] text-zinc-500 font-medium text-center leading-tight">
          {gameTime}
        </span>
      ) : null}
      <span className="text-[8px] text-zinc-500 truncate w-full text-center leading-tight">
        {slot.playerName?.split(" ").pop() ?? "Empty"}
      </span>
    </div>
  );
}
