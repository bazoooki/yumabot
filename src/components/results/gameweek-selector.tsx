"use client";

import { cn } from "@/lib/utils";

export function GameweekSelector({
  available,
  selected,
  onSelect,
}: {
  available: number[];
  selected: number | null;
  onSelect: (gw: number) => void;
}) {
  if (available.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {available.map((gw) => (
        <button
          key={gw}
          onClick={() => onSelect(gw)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-full transition-colors shrink-0",
            selected === gw
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 border border-transparent",
          )}
        >
          GW {gw}
        </button>
      ))}
    </div>
  );
}
