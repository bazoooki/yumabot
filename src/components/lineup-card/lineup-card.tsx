"use client";

import type { InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { PlayerSlot, type LineupCardVariant } from "./player-slot";
import { cn } from "@/lib/utils";

export type { LineupCardVariant } from "./player-slot";

export function LineupCard({
  competition,
  teamIndex = 0,
  variant = "default",
  className,
}: {
  competition: InSeasonCompetition;
  teamIndex?: number;
  variant?: LineupCardVariant;
  className?: string;
}) {
  const team = competition.teams[teamIndex];
  if (!team) return null;

  const rarityConf = RARITY_CONFIG[competition.mainRarityType];
  const isCompact = variant === "compact";
  const slots = team.slots;

  if (isCompact) {
    return (
      <div
        className={cn(
          "rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-2.5",
          className,
        )}
      >
        {/* Single-line header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              rarityConf?.dotColor ?? "bg-zinc-500",
            )}
          />
          <span className="text-[10px] font-medium text-zinc-300 truncate">
            {competition.leagueName}
          </span>
          <span className="text-[10px] text-zinc-600 shrink-0">
            {team.name}
          </span>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {team.totalScore != null && (
              <span className="text-xs font-bold text-white tabular-nums">
                {Math.round(team.totalScore)}
                <span className="text-[9px] font-normal text-zinc-500 ml-0.5">
                  pts
                </span>
              </span>
            )}
            {team.ranking != null && (
              <span className="text-[9px] text-zinc-500 tabular-nums">
                #{team.ranking}
              </span>
            )}
          </div>
        </div>

        {/* Circular avatars row */}
        <div className="flex items-start justify-center gap-1.5">
          {slots.map((slot) => (
            <PlayerSlot key={slot.index} slot={slot} variant="compact" />
          ))}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 hover:border-zinc-600 transition-all",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              rarityConf?.dotColor ?? "bg-zinc-500",
            )}
          />
          <span className="text-xs font-medium text-zinc-200 truncate">
            {competition.leagueName}
          </span>
          <span className={cn("text-[10px]", rarityConf?.color ?? "text-zinc-500")}>
            {rarityConf?.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500">{team.name}</span>
          {team.ranking != null && (
            <span className="text-[10px] text-zinc-400 tabular-nums">
              #{team.ranking}
            </span>
          )}
        </div>
      </div>

      {/* Players row */}
      <div className="flex items-start justify-center gap-1 mb-2.5">
        {slots.map((slot) => (
          <PlayerSlot key={slot.index} slot={slot} variant="default" />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-700/30 pt-2">
        <div className="flex items-center gap-2">
          {team.totalScore != null && (
            <span className="text-sm font-bold text-white tabular-nums">
              {Math.round(team.totalScore)}
              <span className="text-[10px] font-normal text-zinc-500 ml-0.5">
                pts
              </span>
            </span>
          )}
        </div>

        {/* Inline streak thresholds */}
        {competition.streak && competition.streak.thresholds.length > 0 && (
          <div className="flex items-center gap-1">
            {competition.streak.thresholds.map((t) => (
              <span
                key={t.level}
                className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded-full border",
                  t.isCleared
                    ? "bg-green-500/15 text-green-400 border-green-500/20"
                    : t.isCurrent
                      ? "bg-amber-500/10 text-amber-400/80 border-amber-500/20"
                      : "bg-zinc-800/50 text-zinc-600 border-zinc-700/50",
                )}
              >
                {t.score}
                {t.reward && (
                  <span className="ml-0.5 opacity-70">{t.reward}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
