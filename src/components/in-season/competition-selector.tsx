"use client";

import type { InSeasonCompetition } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { CompetitionCard } from "./competition-card";

export function CompetitionSelector({
  competitions,
  gameWeek,
}: {
  competitions: InSeasonCompetition[];
  gameWeek: number | null;
}) {
  const selectedSlug = useInSeasonStore((s) => s.selectedCompSlug);
  const selectCompetition = useInSeasonStore((s) => s.selectCompetition);

  const filledCount = competitions.filter((c) =>
    c.teams.some((t) => t.slots.some((s) => s.cardSlug)),
  ).length;

  return (
    <div className="md:w-60 shrink-0 md:border-r border-b md:border-b-0 border-zinc-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2 md:px-4 md:py-3 md:border-b border-zinc-800 flex items-center gap-2 md:block">
        <div className="text-sm font-semibold text-zinc-300">
          {gameWeek ? `GW${gameWeek}` : "In Season"}
        </div>
        <div className="text-[10px] text-zinc-600 md:mt-0.5">
          {filledCount}/{competitions.length} with lineups
        </div>
      </div>
      <div className="flex md:flex-col flex-1 overflow-x-auto md:overflow-y-auto p-2 gap-1 md:gap-0 md:space-y-1">
        {competitions.map((comp) => (
          <CompetitionCard
            key={comp.slug}
            comp={comp}
            isSelected={selectedSlug === comp.slug}
            onClick={() => selectCompetition(comp.slug)}
          />
        ))}
      </div>
    </div>
  );
}
