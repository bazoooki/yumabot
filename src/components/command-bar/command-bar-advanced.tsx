"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { STREAK_LEVELS } from "@/lib/lineup-store";
import { cn } from "@/lib/utils";

const RARITY_OPTIONS = [
  { value: "common", label: "Stellar", color: "text-yellow-400", enabled: true },
  { value: "limited", label: "Limited", color: "text-amber-500", enabled: false },
  { value: "rare", label: "Rare", color: "text-red-400", enabled: false },
  { value: "super_rare", label: "Super Rare", color: "text-blue-400", enabled: false },
  { value: "unique", label: "Unique", color: "text-purple-400", enabled: false },
] as const;

const STRATEGY_OPTIONS = [
  { value: "safe", label: "Safe", color: "text-amber-400" },
  { value: "balanced", label: "Balanced", color: "text-blue-400" },
  { value: "fast", label: "Ceiling", color: "text-green-400" },
] as const;

const BATCH_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "Weekend" },
  { value: "next", label: "Next batch" },
] as const;

interface Props {
  onSubmit: (query: string) => void;
}

export function CommandBarAdvanced({ onSubmit }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState(2);
  const [rarity, setRarity] = useState("common");
  const [strategy, setStrategy] = useState("safe");
  const [batch, setBatch] = useState("all");

  const threshold = STREAK_LEVELS.find((l) => l.level === level)?.threshold ?? 320;
  const reward = STREAK_LEVELS.find((l) => l.level === level)?.reward ?? "$6";

  const handleGo = () => {
    const parts = [`Best lineup for level ${level}`];
    if (rarity !== "common") parts.push(`using ${rarity} cards`);
    if (strategy !== "safe") parts.push(`with ${strategy} strategy`);
    if (batch === "next") parts.push("using only the next game batch");
    if (batch === "today") parts.push("using only players playing today");
    if (batch === "tomorrow") parts.push("using only players playing tomorrow");
    if (batch === "weekend") parts.push("using only weekend games");
    onSubmit(parts.join(" "));
  };

  return (
    <div className="border-t border-zinc-800/50">
      {/* Toggle row */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-4 py-1.5 w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
        Advanced
      </button>

      {/* Advanced controls */}
      {isOpen && (
        <div className="px-4 pb-3 space-y-2.5">
          {/* Row 1: Rarity + Level */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Rarity */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Cards</span>
              <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
                {RARITY_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => r.enabled && setRarity(r.value)}
                    disabled={!r.enabled}
                    className={cn(
                      "px-2 py-1 text-[11px] font-medium transition-colors",
                      !r.enabled
                        ? "text-zinc-700 cursor-not-allowed"
                        : rarity === r.value
                          ? `bg-zinc-800 ${r.color}`
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Level</span>
              <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
                {STREAK_LEVELS.map((l) => (
                  <button
                    key={l.level}
                    onClick={() => setLevel(l.level)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-medium transition-colors",
                      level === l.level
                        ? "bg-primary/20 text-primary"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
                    )}
                  >
                    {l.level}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-zinc-600">
                {threshold}pts · {reward}
              </span>
            </div>
          </div>

          {/* Row 2: Strategy + Games + Go */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Strategy */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Strategy</span>
              <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
                {STRATEGY_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStrategy(s.value)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-medium transition-colors",
                      strategy === s.value
                        ? `bg-zinc-800 ${s.color}`
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Game batch */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Games</span>
              <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
                {BATCH_OPTIONS.map((b) => (
                  <button
                    key={b.value}
                    onClick={() => setBatch(b.value)}
                    className={cn(
                      "px-2 py-1 text-[11px] font-medium transition-colors",
                      batch === b.value
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Go button */}
            <button
              onClick={handleGo}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors ml-auto"
            >
              Build Lineup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
