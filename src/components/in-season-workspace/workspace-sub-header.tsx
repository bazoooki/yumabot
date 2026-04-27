"use client";

import { Minus, Plus } from "lucide-react";
import type { InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TONE, TEAM_TONES, toneForSlug } from "./tones";

interface SubHeaderProps {
  comp: InSeasonCompetition;
  eligibleCount: number;
  teamCount: number;
  onTeamCountChange(n: number): void;
}

export function WorkspaceSubHeader({
  comp,
  eligibleCount,
  teamCount,
  onTeamCountChange,
}: SubHeaderProps) {
  const tone = TONE[toneForSlug(comp.slug)];
  const rarity = RARITY_CONFIG[comp.mainRarityType] ?? {
    label: comp.mainRarityType,
    color: "text-zinc-300",
    dotColor: "bg-zinc-500",
  };

  const setSafe = (n: number) =>
    onTeamCountChange(Math.max(1, Math.min(4, n)));

  return (
    <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center gap-3 flex-wrap">
      <span className={cn("w-2.5 h-2.5 rounded-full", tone.bar)} />
      <span className="text-base font-bold text-zinc-100">{comp.leagueName}</span>
      <span
        className={cn(
          "mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800",
          rarity.color,
        )}
      >
        {rarity.label}
      </span>
      {comp.division ? (
        <span className="mono text-[9px] uppercase tracking-wider text-zinc-500">
          D{comp.division}
        </span>
      ) : null}
      <span className="mono text-[10px] text-zinc-500">
        {eligibleCount} eligible cards
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span className="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Teams
        </span>
        <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setSafe(teamCount - 1)}
            disabled={teamCount <= 1}
            className="w-7 h-7 grid place-items-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30"
            aria-label="Fewer teams"
          >
            <Minus className="w-3 h-3" />
          </button>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSafe(n)}
              className={cn(
                "w-7 h-7 mono text-[11px] font-bold tabular-nums border-l border-zinc-800",
                teamCount === n
                  ? `${TONE[TEAM_TONES[n - 1]].bar} text-zinc-950`
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSafe(teamCount + 1)}
            disabled={teamCount >= 4}
            className="w-7 h-7 grid place-items-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 border-l border-zinc-800"
            aria-label="More teams"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
