"use client";

import { useMemo } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { SorareCard, InSeasonCompetition } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { getEligibleCardsForCompetition, buildEligibilityMap } from "@/lib/gw-optimizer";
import { CompetitionOverviewCard } from "./competition-overview-card";
import { ContestedCardsPanel } from "./contested-cards-panel";

export function GWPlanner({
  competitions,
  cards,
  gameWeek,
}: {
  competitions: InSeasonCompetition[];
  cards: SorareCard[];
  gameWeek: number | null;
}) {
  const gwPlan = useInSeasonStore((s) => s.gwPlan);
  const isPlanning = useInSeasonStore((s) => s.isPlanning);
  const planGW = useInSeasonStore((s) => s.planGameweek);
  const applyAllocation = useInSeasonStore((s) => s.applyAllocation);
  const setPlannerMode = useInSeasonStore((s) => s.setPlannerMode);
  const selectCompetition = useInSeasonStore((s) => s.selectCompetition);

  // Compute eligibility counts per competition
  const eligibilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const comp of competitions) {
      counts[comp.slug] = getEligibleCardsForCompetition(cards, comp).length;
    }
    return counts;
  }, [cards, competitions]);

  // Compute contested cards without running the full optimizer
  const contestedCards = useMemo(() => {
    if (gwPlan) return gwPlan.contestedCards;
    const { contestedCards: cc } = buildEligibilityMap(cards, competitions);
    return cc;
  }, [cards, competitions, gwPlan]);

  // Summary stats
  const fullCount = competitions.filter((comp) => {
    const alloc = gwPlan?.allocations.find(
      (a) => a.competitionSlug === comp.slug,
    );
    if (alloc) return alloc.filledSlots >= alloc.totalSlots;
    return comp.teams.some(
      (t) => t.slots.length > 0 && t.slots.every((s) => s.cardSlug),
    );
  }).length;

  const partialCount = competitions.filter((comp) => {
    const alloc = gwPlan?.allocations.find(
      (a) => a.competitionSlug === comp.slug,
    );
    if (alloc)
      return alloc.filledSlots > 0 && alloc.filledSlots < alloc.totalSlots;
    const hasAny = comp.teams.some((t) => t.slots.some((s) => s.cardSlug));
    const hasFull = comp.teams.some(
      (t) => t.slots.length > 0 && t.slots.every((s) => s.cardSlug),
    );
    return hasAny && !hasFull;
  }).length;

  const emptyCount = competitions.length - fullCount - partialCount;

  const handleCompClick = (comp: InSeasonCompetition) => {
    selectCompetition(comp.slug);
    setPlannerMode(false);
  };

  const handleApply = (compSlug: string) => {
    applyAllocation(compSlug);
  };

  const handleApplyAll = () => {
    if (!gwPlan) return;
    // Apply the first one (switches to builder) — user can toggle back
    const first = gwPlan.allocations[0];
    if (first) applyAllocation(first.competitionSlug);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            {gameWeek ? `GW ${gameWeek} Planner` : "GW Planner"}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {competitions.length} competitions
            {fullCount > 0 && (
              <span className="text-emerald-400/70">
                {" "}&middot; {fullCount} filled
              </span>
            )}
            {partialCount > 0 && (
              <span className="text-amber-400/70">
                {" "}&middot; {partialCount} partial
              </span>
            )}
            {emptyCount > 0 && (
              <span className="text-zinc-600">
                {" "}&middot; {emptyCount} empty
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {gwPlan && (
            <div className="text-xs text-zinc-400 tabular-nums mr-2">
              ~{Math.round(gwPlan.totalExpectedScore)} total pts
            </div>
          )}
          {gwPlan && (
            <button
              onClick={handleApplyAll}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/15 transition-colors"
            >
              Apply All
            </button>
          )}
          <button
            onClick={() => void planGW(cards)}
            disabled={isPlanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {isPlanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            {isPlanning ? "Planning..." : "Plan My GW"}
          </button>
        </div>
      </div>

      {/* Competition Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {competitions.map((comp) => {
          const allocation = gwPlan?.allocations.find(
            (a) => a.competitionSlug === comp.slug,
          );
          return (
            <CompetitionOverviewCard
              key={comp.slug}
              comp={comp}
              allocation={allocation}
              eligibleCount={eligibilityCounts[comp.slug] ?? 0}
              onClick={() =>
                gwPlan ? handleApply(comp.slug) : handleCompClick(comp)
              }
            />
          );
        })}
      </div>

      {/* Plan results: per-competition actions */}
      {gwPlan && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {gwPlan.allocations.map((alloc) => {
            const comp = competitions.find(
              (c) => c.slug === alloc.competitionSlug,
            );
            if (!comp) return null;
            const isFull = alloc.filledSlots >= alloc.totalSlots;

            return (
              <div
                key={alloc.competitionSlug}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isFull ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="text-xs text-zinc-300 truncate">
                    {comp.leagueName}
                  </span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {alloc.filledSlots}/{alloc.totalSlots}
                  </span>
                </div>
                <button
                  onClick={() => handleApply(alloc.competitionSlug)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors shrink-0 ml-2"
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Contested Cards */}
      <ContestedCardsPanel
        contestedCards={contestedCards}
        competitions={competitions}
        onAssign={handleApply}
      />

      {/* Gap Warnings */}
      {gwPlan && gwPlan.gaps.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-zinc-400">Gaps</h3>
          {gwPlan.gaps.map((gap, i) => {
            const comp = competitions.find(
              (c) => c.slug === gap.competitionSlug,
            );
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-300">{gap.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
