"use client";

import { Lock, Check } from "lucide-react";
import type { InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TONE, toneForSlug } from "./tones";

interface CompetitionCardProps {
  comp: InSeasonCompetition;
  isSelected: boolean;
  filledCount: number; // 0..4 — drafts the user has built for this comp
  onSelect(slug: string): void;
}

export function CompetitionCard({
  comp,
  isSelected,
  filledCount,
  onSelect,
}: CompetitionCardProps) {
  const tone = TONE[toneForSlug(comp.slug)];
  const rarity = RARITY_CONFIG[comp.mainRarityType] ?? {
    label: comp.mainRarityType,
    color: "text-zinc-300",
    dotColor: "bg-zinc-500",
  };
  const locked = !comp.canCompose;
  const complete = filledCount >= 4;
  const streakDots = comp.streak?.streakCount ?? 0;

  return (
    <button
      onClick={() => !locked && onSelect(comp.slug)}
      disabled={locked}
      className={cn(
        "w-full text-left rounded-lg border transition-all px-2.5 py-2",
        isSelected
          ? `${tone.border} ${tone.soft}`
          : locked
            ? "border-zinc-900 bg-zinc-950/40 opacity-50 cursor-not-allowed"
            : "border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700/60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", tone.bar)} />
        <span
          className={cn(
            "text-[12px] font-semibold truncate",
            isSelected ? "text-zinc-100" : "text-zinc-300",
          )}
        >
          {comp.leagueName}
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {locked && <Lock className="w-3 h-3 text-zinc-600" />}
          {!locked && complete && <Check className="w-3 h-3 text-emerald-400" />}
          {!locked && (
            <span className="mono text-[10px] font-bold tabular-nums text-zinc-300">
              {filledCount}/4
            </span>
          )}
        </div>
      </div>
      {!locked && (
        <div className="mt-1.5 flex items-center gap-1.5 pl-4">
          <span
            className={cn(
              "mono text-[8px] font-bold uppercase px-1 py-0.5 rounded border",
              rarity.color,
            )}
          >
            {rarity.label}
          </span>
          {comp.division ? (
            <span className="mono text-[8px] font-semibold uppercase text-zinc-500">
              D{comp.division}
            </span>
          ) : null}
          {streakDots > 0 && (
            <div className="ml-auto flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "block w-1 h-2 rounded-sm",
                    i <= streakDots ? tone.bar : "bg-zinc-800",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
