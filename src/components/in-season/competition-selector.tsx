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
    <div className="w-60 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="text-sm font-semibold text-zinc-300">
          {gameWeek ? `GW${gameWeek}` : "In Season"}
        </div>
        <div className="text-[10px] text-zinc-600 mt-0.5">
          {filledCount}/{competitions.length} with lineups
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
