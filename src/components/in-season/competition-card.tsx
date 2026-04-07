"use client";

import type { InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CompetitionCard({
  comp,
  isSelected,
  onClick,
}: {
  comp: InSeasonCompetition;
  isSelected: boolean;
  onClick: () => void;
}) {
  const filledTeams = comp.teams.filter(
    (t) => t.slots.length > 0 && t.slots.some((s) => s.cardSlug),
  ).length;
  const rarityConf = RARITY_CONFIG[comp.mainRarityType];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-all",
        isSelected
          ? "bg-amber-500/10 border border-amber-500/30"
          : "hover:bg-zinc-800/50 border border-transparent",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              rarityConf?.dotColor ?? "bg-zinc-500",
            )}
          />
          <span className="text-sm font-medium text-zinc-200 truncate">
            {comp.leagueName}
          </span>
        </div>
        {comp.teamsCap > 0 && (
          <span className="text-xs text-zinc-500 shrink-0 ml-2">
            {filledTeams}/{comp.teamsCap}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 ml-4">
        <span
          className={cn(
            "text-[10px]",
            rarityConf?.color ?? "text-zinc-500",
          )}
        >
          {rarityConf?.label ?? comp.mainRarityType}
        </span>
        {comp.division > 0 && (
          <span className="text-[10px] text-zinc-600">
            Div {comp.division}
          </span>
        )}
        {comp.streak && (
          <span className="text-[10px] text-amber-500/70">
            Lv.{comp.streak.currentLevel}
          </span>
        )}
      </div>
    </button>
  );
}
