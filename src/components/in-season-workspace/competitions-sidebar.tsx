"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { InSeasonCompetition } from "@/lib/types";
import { isCrossLeagueCompetition } from "@/lib/in-season/eligibility";
import { CompetitionCard } from "./competition-card";

export interface SidebarLeague {
  leagueSlug: string;
  leagueName: string;
  iconUrl: string | null;
  /** The leaderboard we land on when this league is selected (lowest-division Limited). */
  rep: InSeasonCompetition;
  variantsCount: number;
}

interface CompetitionsSidebarProps {
  competitions: InSeasonCompetition[];
  gameWeek: number | null;
  fixtureLabel: string | null;
  selectedLeagueSlug: string;
  filledCounts: Map<string, number>;
  onSelectLeague(leagueSlug: string): void;
}

function dedupeByLeague(competitions: InSeasonCompetition[]): SidebarLeague[] {
  const groups = new Map<string, InSeasonCompetition[]>();
  for (const c of competitions) {
    const arr = groups.get(c.leagueSlug) ?? [];
    arr.push(c);
    groups.set(c.leagueSlug, arr);
  }
  const leagues: SidebarLeague[] = [];
  for (const [slug, comps] of groups) {
    // Prefer Limited rarity, lowest division as the visible representative.
    const limited = comps.filter((c) => c.mainRarityType === "limited");
    const pool = limited.length > 0 ? limited : comps;
    const rep =
      pool.slice().sort((a, b) => a.division - b.division)[0] ?? comps[0];
    leagues.push({
      leagueSlug: slug,
      leagueName: rep.leagueName,
      iconUrl: rep.iconUrl || null,
      rep,
      variantsCount: comps.length,
    });
  }
  leagues.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  return leagues;
}

export function CompetitionsSidebar({
  competitions,
  gameWeek,
  fixtureLabel,
  selectedLeagueSlug,
  filledCounts,
  onSelectLeague,
}: CompetitionsSidebarProps) {
  const leagues = useMemo(() => dedupeByLeague(competitions), [competitions]);
  const single = useMemo(
    () => leagues.filter((l) => !isCrossLeagueCompetition(l.leagueName)),
    [leagues],
  );
  const cross = useMemo(
    () => leagues.filter((l) => isCrossLeagueCompetition(l.leagueName)),
    [leagues],
  );

  // Filled counts are stored against representative leaderboard slugs — sum
  // them up per league so the sidebar count includes drafts on any variant.
  const leagueFilledCount = (leagueSlug: string) => {
    let total = 0;
    for (const c of competitions) {
      if (c.leagueSlug !== leagueSlug) continue;
      total += filledCounts.get(c.slug) ?? 0;
    }
    return Math.min(total, 4);
  };

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
            {single.map((l) => (
              <CompetitionCard
                key={l.leagueSlug}
                league={l}
                isSelected={l.leagueSlug === selectedLeagueSlug}
                filledCount={leagueFilledCount(l.leagueSlug)}
                onSelect={onSelectLeague}
              />
            ))}
          </>
        )}

        {cross.length > 0 && (
          <>
            <div className="mono text-[9px] uppercase tracking-wider text-zinc-600 px-1 mt-3 mb-1">
              Cross-League · {cross.length}
            </div>
            {cross.map((l) => (
              <CompetitionCard
                key={l.leagueSlug}
                league={l}
                isSelected={l.leagueSlug === selectedLeagueSlug}
                filledCount={leagueFilledCount(l.leagueSlug)}
                onSelect={onSelectLeague}
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
            Auto-fill all leagues
          </span>
        </button>
      </div>
    </aside>
  );
}
