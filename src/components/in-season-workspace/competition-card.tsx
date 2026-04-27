"use client";

import Image from "next/image";
import { Lock, Check } from "lucide-react";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TONE, toneForSlug } from "./tones";
import { flagFor } from "@/lib/in-season/league-flags";
import type { SidebarLeague } from "./competitions-sidebar";

interface CompetitionCardProps {
  league: SidebarLeague;
  isSelected: boolean;
  filledCount: number; // 0..4 — drafts the user has built across the league's variants
  onSelect(slug: string): void;
}

export function CompetitionCard({
  league,
  isSelected,
  filledCount,
  onSelect,
}: CompetitionCardProps) {
  const { rep, leagueSlug, leagueName, iconUrl, variantsCount } = league;
  const tone = TONE[toneForSlug(leagueSlug)];
  const rarity = RARITY_CONFIG[rep.mainRarityType] ?? {
    label: rep.mainRarityType,
    color: "text-zinc-300",
    dotColor: "bg-zinc-500",
  };
  const locked = !rep.canCompose;
  const complete = filledCount >= 4;
  const streakDots = rep.streak?.streakCount ?? 0;
  const flag = flagFor(leagueName);

  return (
    <button
      type="button"
      onClick={() => !locked && onSelect(leagueSlug)}
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
        <div className="w-5 h-5 rounded shrink-0 bg-zinc-800/60 grid place-items-center overflow-hidden">
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt=""
              width={20}
              height={20}
              className="object-contain"
              sizes="20px"
            />
          ) : flag ? (
            <span className="text-base leading-none">{flag}</span>
          ) : (
            <span className={cn("w-2 h-2 rounded-full", tone.bar)} />
          )}
        </div>
        <span
          className={cn(
            "text-[12px] font-semibold truncate",
            isSelected ? "text-zinc-100" : "text-zinc-300",
          )}
        >
          {leagueName}
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
        <div className="mt-1.5 flex items-center gap-1.5 pl-7">
          <span
            className={cn(
              "mono text-[8px] font-bold uppercase px-1 py-0.5 rounded border border-zinc-800",
              rarity.color,
            )}
          >
            {rarity.label}
          </span>
          {rep.division ? (
            <span className="mono text-[8px] font-semibold uppercase text-zinc-500">
              D{rep.division}
            </span>
          ) : null}
          {variantsCount > 1 && (
            <span className="mono text-[8px] uppercase text-zinc-600">
              · {variantsCount} divs
            </span>
          )}
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
