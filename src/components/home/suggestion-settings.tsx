"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Settings2 } from "lucide-react";
import {
  useAiSuggestionsStore,
  type LineupCount,
  type TargetLevelOffset,
} from "@/lib/ai-suggestions-store";

const OFFSETS: Array<{ value: TargetLevelOffset; label: string }> = [
  { value: 0, label: "Current" },
  { value: 1, label: "+1" },
  { value: 2, label: "+2" },
];

const COUNTS: LineupCount[] = [1, 2, 3];

export function SuggestionSettings() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const settings = useAiSuggestionsStore();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "p-1 rounded hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 transition-colors",
          open && "bg-zinc-800/60 text-zinc-200",
        )}
        aria-label="Suggestion settings"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-60 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3 space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Target level
            </div>
            <div className="flex gap-1">
              {OFFSETS.map((o) => {
                const active = settings.targetLevelOffset === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => settings.setTargetLevelOffset(o.value)}
                    className={cn(
                      "flex-1 text-[11px] px-2 py-1 rounded border transition-colors",
                      active
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Lineups per comp
            </div>
            <div className="flex gap-1">
              {COUNTS.map((n) => {
                const active = settings.lineupCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => settings.setLineupCount(n)}
                    className={cn(
                      "flex-1 text-[11px] px-2 py-1 rounded border transition-colors tabular-nums",
                      active
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                        : "bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.excludeDoubtful}
              onChange={(e) => settings.setExcludeDoubtful(e.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-[11px] text-zinc-300">
              Exclude doubtful starters
            </span>
          </label>

          <div className="pt-1 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => settings.reset()}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
