"use client";

import type { InSeasonCompetition } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { cn } from "@/lib/utils";

export function TeamTabs({ comp }: { comp: InSeasonCompetition }) {
  const selectedTeamIndex = useInSeasonStore((s) => s.selectedTeamIndex);
  const selectTeam = useInSeasonStore((s) => s.selectTeam);

  if (comp.teamsCap <= 1) return null;

  return (
    <div className="flex gap-2 mb-4">
      {Array.from({ length: comp.teamsCap }, (_, i) => {
        const team = comp.teams[i];
        const filledSlots = team?.slots.filter((s) => s.cardSlug).length ?? 0;
        const isFull = filledSlots === 5;

        return (
          <button
            key={i}
            onClick={() => selectTeam(i)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              selectedTeamIndex === i
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-zinc-800/50 text-zinc-400 hover:text-zinc-300 border border-transparent",
            )}
          >
            Team {String.fromCharCode(65 + i)}
            {filledSlots > 0 && (
              <span
                className={cn(
                  "ml-1.5 text-[10px]",
                  isFull ? "text-green-400" : "text-zinc-500",
                )}
              >
                {filledSlots}/5
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
