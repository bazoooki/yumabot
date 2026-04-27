"use client";

import { Shirt } from "lucide-react";
import type { InSeasonSlot } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { ScoreBadge } from "./score-badge";
import { cn } from "@/lib/utils";
import { getGradeStyle } from "@/lib/ui-config";

export type LineupCardVariant = "default" | "compact";

const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GOA",
  Defender: "DEF",
  Midfielder: "MID",
  Forward: "FOR",
};

const POSITION_PILL_TEXT: Record<string, string> = {
  Goalkeeper: "text-amber-300",
  Defender: "text-sky-300",
  Midfielder: "text-emerald-300",
  Forward: "text-rose-300",
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-green-400/60",
  limited: "border-yellow-400/70",
  rare: "border-red-400/70",
  super_rare: "border-blue-400/70",
  unique: "border-purple-400/70",
  custom_series: "border-pink-400/70",
};

function startColor(pct: number): string {
  if (pct >= 85) return "bg-emerald-400 text-emerald-950";
  if (pct >= 60) return "bg-cyan-400 text-cyan-950";
  if (pct >= 30) return "bg-amber-400 text-amber-950";
  return "bg-rose-400 text-rose-950";
}

/** Format game date: today → "7:30 PM", other days → "25 SAT" */
function formatGameTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return `${d.getDate()} ${d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}`;
}

export function PlayerSlot({
  slot,
  variant,
}: {
  slot: InSeasonSlot;
  variant: LineupCardVariant;
}) {
  const isCompact = variant === "compact";
  // Use the card art (rectangular) even in compact — cropped to the face.
  // playerPictureUrl (avatar) is a fallback if the card image is missing.
  const imgSrc = slot.pictureUrl ?? slot.playerPictureUrl;

  const status = (slot.scoreStatus ?? "").toLowerCase();
  const isPlaying = status === "live" || status === "playing" || status === "started";
  const isFinal = status === "done" || status === "final" || status === "reviewed";
  const isScheduled = status === "scheduled" || status === "";
  const isDNP = slot.score != null && slot.score === 0 && isFinal;
  const hasScore = slot.score != null && (slot.score > 0 || isPlaying || isFinal);
  const gradeStyle = getGradeStyle(slot.projectionGrade);

  const gameTime = isScheduled ? formatGameTime(slot.gameDate) : null;

  if (isCompact) {
    const lastName = slot.playerName?.split(" ").pop() ?? null;
    const positionShort = POSITION_SHORT[slot.position] ?? slot.position.slice(0, 3).toUpperCase();
    const startPct = typeof slot.startProbability === "number"
      ? Math.round(slot.startProbability)
      : null;
    const rarityBorder = slot.rarityTyped
      ? RARITY_BORDER[slot.rarityTyped] ?? "border-zinc-700"
      : "border-zinc-700";

    return (
      <div className="flex flex-col items-center gap-0 w-[84px]">
        <div className={cn("relative", isDNP && "opacity-40")}>
          <div
            className={cn(
              "w-[72px] h-[96px] rounded-md overflow-hidden border-2 bg-zinc-900 shadow-lg shadow-black/40",
              slot.isCaptain
                ? "border-pink-400 ring-2 ring-pink-400/40"
                : rarityBorder,
            )}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={slot.playerName ?? ""}
                // Sorare card art puts the face at roughly 15% from the top;
                // cover-crop at that offset to show a flattering portrait.
                className="w-full h-full object-cover object-[center_18%]"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[13px] font-bold text-zinc-300">
                  {(lastName?.slice(0, 2) ?? positionShort).toUpperCase()}
                </span>
              </div>
            )}
            {/* Bottom gradient so overlays read cleanly over card art */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          </div>

          {/* Top badges — grade (+ captain C) sit on top edge of card */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
            {slot.isCaptain && (
              <span className="text-[10px] font-black text-white bg-pink-500 border border-pink-300 rounded-md w-5 h-5 grid place-items-center leading-none shadow-md shadow-black/40">
                C
              </span>
            )}
            {gradeStyle && slot.projectionGrade && (
              <span
                className={cn(
                  "text-[10px] font-black text-white rounded-md px-1.5 py-0.5 leading-none shadow-md shadow-black/40 border border-white/20",
                  gradeStyle.bg,
                )}
              >
                {slot.projectionGrade}
              </span>
            )}
          </div>

          {/* Live pulse — top-right */}
          {isPlaying && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border border-zinc-900 animate-pulse" />
          )}

          {/* Bottom-center pill: live/final score OR start probability */}
          <div className="absolute inset-x-0 -bottom-2 flex items-center justify-center">
            {hasScore ? (
              <ScoreBadge
                score={slot.score}
                scoreStatus={slot.scoreStatus}
                size="sm"
                className="shadow-md shadow-black/40 border border-white/10"
              />
            ) : startPct != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none shadow-md shadow-black/40 tabular-nums",
                  startColor(startPct),
                )}
                title="Start probability"
              >
                <Shirt className="w-3 h-3" strokeWidth={2.5} />
                {startPct}%
              </span>
            ) : slot.projectedScore != null ? (
              <span className="inline-flex items-baseline gap-0.5 text-[10px] font-bold text-zinc-100 bg-zinc-900/90 border border-zinc-700 rounded-full px-1.5 py-0.5 leading-none shadow-md shadow-black/40 tabular-nums">
                {Math.round(slot.projectedScore)}
                <span className="text-[7px] text-zinc-400 uppercase">proj</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Player last name — give room for the bottom-pill overlap */}
        <span className="text-[11px] text-zinc-100 font-bold uppercase tracking-tight text-center leading-tight truncate w-full mt-3">
          {lastName ?? "—"}
        </span>

        {/* Kickoff time or date */}
        {isScheduled && gameTime && (
          <span className="text-[10px] text-zinc-400 font-medium mt-1">
            {gameTime}
          </span>
        )}

        {/* Matchup: home vs away crests, fall back to codes when no image */}
        {(slot.gameHomeCrestUrl || slot.gameHomeCode) && (
          <div className="flex items-center gap-1 mt-1">
            {slot.gameHomeCrestUrl ? (
              <img
                src={slot.gameHomeCrestUrl}
                alt={slot.gameHomeCode ?? ""}
                className="w-4 h-4 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[9px] text-zinc-500 font-semibold">{slot.gameHomeCode}</span>
            )}
            <span className="text-[9px] text-zinc-600">-</span>
            {slot.gameAwayCrestUrl ? (
              <img
                src={slot.gameAwayCrestUrl}
                alt={slot.gameAwayCode ?? ""}
                className="w-4 h-4 object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[9px] text-zinc-500 font-semibold">{slot.gameAwayCode}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant — unchanged
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
        <div className="flex items-center gap-0.5 justify-center">
          {gradeStyle && (
            <span className={cn("text-[7px] font-bold px-1 py-px rounded text-white", gradeStyle.bg)}>
              {slot.projectionGrade}
            </span>
          )}
          <span className="text-[8px] text-zinc-500 font-medium text-center leading-tight">
            {gameTime}
          </span>
        </div>
      ) : null}
      <span className="text-[8px] text-zinc-500 truncate w-full text-center leading-tight">
        {slot.playerName?.split(" ").pop() ?? "Empty"}
      </span>
    </div>
  );
}
