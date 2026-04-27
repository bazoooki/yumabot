"use client";

import type { InSeasonCompetition, InSeasonTeam } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { formatUsdFromCents } from "@/lib/rewards";
import { PlayerSlot, type LineupCardVariant } from "./player-slot";
import { cn } from "@/lib/utils";

export type { LineupCardVariant } from "./player-slot";

function totalEssence(team: { rewardEssence: { quantity: number }[] }): number {
  return team.rewardEssence.reduce((sum, e) => sum + e.quantity, 0);
}

/** Ordered reward + score stats: $ → essence → score → rank. */
function StatsRow({
  team,
  size,
}: {
  team: InSeasonTeam;
  size: "sm" | "md";
}) {
  const essence = totalEssence(team);
  const hasRewards = team.rewardUsdCents > 0 || essence > 0;
  const proj = hasRewards && !team.rewardIsActual;

  const cashClass =
    size === "md" ? "text-sm font-bold tabular-nums" : "text-xs font-bold tabular-nums";
  const essenceClass =
    size === "md"
      ? "text-xs font-semibold tabular-nums flex items-center gap-0.5"
      : "text-[10px] font-semibold tabular-nums flex items-center gap-0.5";
  const ptsClass =
    size === "md"
      ? "text-sm font-bold text-white tabular-nums"
      : "text-xs font-bold text-white tabular-nums";
  const ptsUnit =
    size === "md" ? "text-[10px] font-normal text-zinc-500 ml-0.5" : "text-[9px] font-normal text-zinc-500 ml-0.5";
  const rankClass =
    size === "md"
      ? "text-[10px] text-zinc-500 tabular-nums"
      : "text-[9px] text-zinc-500 tabular-nums";

  return (
    <div className="flex items-center gap-2 shrink-0">
      {team.rewardUsdCents > 0 && (
        <span
          className={cn(
            cashClass,
            team.rewardIsActual ? "text-emerald-400" : "text-emerald-400/70",
          )}
          title={team.rewardIsActual ? "Earnings" : "Projected earnings"}
        >
          {formatUsdFromCents(team.rewardUsdCents)}
        </span>
      )}
      {essence > 0 && (
        <span
          className={cn(
            essenceClass,
            team.rewardIsActual ? "text-amber-400" : "text-amber-400/70",
          )}
          title="Essence"
        >
          ✦{essence}
        </span>
      )}
      {team.totalScore != null && (
        <span className={ptsClass}>
          {Math.round(team.totalScore)}
          <span className={ptsUnit}>pts</span>
        </span>
      )}
      {team.ranking != null && (
        <span className={rankClass}>#{team.ranking}</span>
      )}
      {proj && (
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider">
          proj
        </span>
      )}
    </div>
  );
}

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
        {/* Header: league — team | $ ✦ pts #rank */}
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
          <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:inline">
            {team.name}
          </span>
          <div className="ml-auto">
            <StatsRow team={team} size="sm" />
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
  const hasStreak =
    competition.streak && competition.streak.thresholds.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 hover:border-zinc-600 transition-all",
        className,
      )}
    >
      {/* Header: league • rarity • team | $ ✦ pts #rank */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
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
          <span
            className={cn(
              "text-[10px] shrink-0",
              rarityConf?.color ?? "text-zinc-500",
            )}
          >
            {rarityConf?.label}
          </span>
          <span className="text-[10px] text-zinc-500 shrink-0 truncate">
            {team.name}
          </span>
        </div>
        <StatsRow team={team} size="md" />
      </div>

      {/* Players row */}
      <div
        className={cn(
          "flex items-start justify-center gap-1",
          hasStreak ? "mb-2.5" : "",
        )}
      >
        {slots.map((slot) => (
          <PlayerSlot key={slot.index} slot={slot} variant="default" />
        ))}
      </div>

      {/* Streak thresholds (only when present) */}
      {hasStreak && (
        <div className="flex items-center justify-end gap-1 border-t border-zinc-700/30 pt-2">
          {competition.streak!.thresholds.map((t) => (
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
  );
}
