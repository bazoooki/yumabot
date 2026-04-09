"use client";

import { Clock } from "lucide-react";
import type { InSeasonCompetition, CompetitionAllocation } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatCutoff(cutOffDate: string): string | null {
  const diff = new Date(cutOffDate).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours >= 24) return null;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h${mins > 0 ? `${mins}m` : ""}`;
}

type Status = "full" | "partial" | "empty";

function getStatus(comp: InSeasonCompetition, allocation?: CompetitionAllocation): Status {
  if (allocation) {
    if (allocation.filledSlots >= allocation.totalSlots) return "full";
    if (allocation.filledSlots > 0) return "partial";
    return "empty";
  }
  // Check from server data
  const hasFilledTeam = comp.teams.some(
    (t) => t.slots.length > 0 && t.slots.every((s) => s.cardSlug),
  );
  if (hasFilledTeam) return "full";
  const hasPartialTeam = comp.teams.some(
    (t) => t.slots.some((s) => s.cardSlug),
  );
  if (hasPartialTeam) return "partial";
  return "empty";
}

const STATUS_STYLES: Record<Status, { border: string; bg: string }> = {
  full: { border: "border-emerald-500/40", bg: "bg-emerald-500/5" },
  partial: { border: "border-amber-500/40", bg: "bg-amber-500/5" },
  empty: { border: "border-zinc-700", bg: "bg-zinc-900/50" },
};

export function CompetitionOverviewCard({
  comp,
  allocation,
  eligibleCount,
  onClick,
}: {
  comp: InSeasonCompetition;
  allocation?: CompetitionAllocation;
  eligibleCount: number;
  onClick: () => void;
}) {
  const rarityConf = RARITY_CONFIG[comp.mainRarityType];
  const status = getStatus(comp, allocation);
  const styles = STATUS_STYLES[status];
  const cutoff = formatCutoff(comp.cutOffDate);

  const filled = allocation?.filledSlots ?? comp.teams.reduce((max, t) => {
    const count = t.slots.filter((s) => s.cardSlug).length;
    return Math.max(max, count);
  }, 0);
  const total = allocation?.totalSlots ?? 5;

  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98]",
        styles.border,
        styles.bg,
        "hover:brightness-110",
      )}
    >
      {/* Header: league + rarity dot */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            rarityConf?.dotColor ?? "bg-zinc-500",
          )}
        />
        <span className="text-xs font-medium text-zinc-200 truncate">
          {comp.leagueName}
        </span>
      </div>

      {/* Rarity label + division */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={cn(
            "text-[10px] font-medium",
            rarityConf?.color ?? "text-zinc-500",
          )}
        >
          {rarityConf?.label ?? comp.mainRarityType}
        </span>
        {comp.division > 0 && (
          <span className="text-[10px] text-zinc-600">Div {comp.division}</span>
        )}
      </div>

      {/* Slots progress */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              status === "full"
                ? "bg-emerald-500"
                : status === "partial"
                  ? "bg-amber-500"
                  : "bg-zinc-700",
            )}
            style={{ width: `${(filled / total) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">
          {filled}/{total}
        </span>
      </div>

      {/* Footer: eligible count + expected score + cutoff */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {eligibleCount} eligible
        </span>
        {allocation && allocation.expectedScore > 0 && (
          <span className="text-[10px] text-zinc-400 tabular-nums">
            ~{Math.round(allocation.expectedScore)}pts
          </span>
        )}
      </div>

      {cutoff && (
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="w-2.5 h-2.5 text-red-400" />
          <span className="text-[10px] text-red-400">{cutoff}</span>
        </div>
      )}
    </button>
  );
}
