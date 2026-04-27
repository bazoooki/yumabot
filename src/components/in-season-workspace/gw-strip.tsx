"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GwStripFixture {
  slug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitionsCount: number;
}

interface GwStripProps {
  fixtures: GwStripFixture[];
  activeFixtureSlug: string | null;
  onSelect(fixture: GwStripFixture): void;
}

export function GwStrip({
  fixtures,
  activeFixtureSlug,
  onSelect,
}: GwStripProps) {
  if (fixtures.length === 0) return null;

  return (
    <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
        <span className="mono text-[10px] uppercase tracking-wider text-zinc-500">
          Game Week
        </span>
      </div>
      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-min">
          {fixtures.map((f, i) => {
            const isActive = f.slug === activeFixtureSlug;
            const dateLabel = formatRange(f.endDate);
            const isFirst = i === 0;
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => onSelect(f)}
                className={cn(
                  "shrink-0 flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border transition-all mono",
                  isActive
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700",
                )}
                title={`${f.competitionsCount} in-season competitions · ${f.aasmState}`}
              >
                <span className="text-[11px] font-bold tabular-nums">
                  GW{f.gameWeek}
                </span>
                <span className="text-[9px] text-zinc-500 normal-case font-normal">
                  {dateLabel}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold tabular-nums",
                    isActive ? "text-amber-400" : "text-zinc-600",
                  )}
                >
                  · {f.competitionsCount}
                </span>
                {isFirst && !isActive && (
                  <span className="text-[8px] uppercase text-emerald-400/80 ml-1">
                    next
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatRange(endDate: string): string {
  const t = new Date(endDate);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
