"use client";

import { Sparkles } from "lucide-react";
import type { InSeasonCompetition } from "@/lib/types";
import { isCrossLeagueCompetition } from "@/lib/in-season/eligibility";
import { CompetitionCard } from "./competition-card";

interface CompetitionsSidebarProps {
  competitions: InSeasonCompetition[];
  gameWeek: number | null;
  fixtureLabel: string | null;
  selectedSlug: string;
  filledCounts: Map<string, number>;
  onSelect(slug: string): void;
}

export function CompetitionsSidebar({
  competitions,
  gameWeek,
  fixtureLabel,
  selectedSlug,
  filledCounts,
  onSelect,
}: CompetitionsSidebarProps) {
  const single = competitions.filter(
    (c) => !isCrossLeagueCompetition(c.leagueName),
  );
  const cross = competitions.filter((c) =>
    isCrossLeagueCompetition(c.leagueName),
  );

  return (
    <aside className="w-[260px] shrink-0 border-r border-zinc-800/80 bg-zinc-950/40 flex flex-col">
      <div className="px-3 py-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-wider text-zinc-500">
            Game Week
          </span>
          <span className="mono text-sm font-bold text-zinc-100">
            {gameWeek ? `GW${gameWeek}` : "—"}
          </span>
          {fixtureLabel && (
            <span className="ml-auto mono text-[10px] text-zinc-500">
              {fixtureLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {single.length > 0 && (
          <>
            <div className="mono text-[9px] uppercase tracking-wider text-zinc-600 px-1 mt-1 mb-1">
              Single League · {single.length}
            </div>
            {single.map((c) => (
              <CompetitionCard
                key={c.slug}
                comp={c}
                isSelected={c.slug === selectedSlug}
                filledCount={filledCounts.get(c.slug) ?? 0}
                onSelect={onSelect}
              />
            ))}
          </>
        )}

        {cross.length > 0 && (
          <>
            <div className="mono text-[9px] uppercase tracking-wider text-zinc-600 px-1 mt-3 mb-1">
              Cross-League · {cross.length}
            </div>
            {cross.map((c) => (
              <CompetitionCard
                key={c.slug}
                comp={c}
                isSelected={c.slug === selectedSlug}
                filledCount={filledCounts.get(c.slug) ?? 0}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-zinc-800/80 px-3 py-2.5 bg-gradient-to-r from-cyan-500/5 to-transparent">
        <button
          type="button"
          className="w-full flex items-center gap-2 hover:opacity-80"
          // TODO: trigger workspace-wide AI auto-fill across all comps
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] text-zinc-300 font-semibold">
            Auto-fill all competitions
          </span>
        </button>
      </div>
    </aside>
  );
}
