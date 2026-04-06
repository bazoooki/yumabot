"use client";

import { useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import { STREAK_LEVELS } from "@/lib/lineup-store";
import { cn } from "@/lib/utils";

const STRATEGY_OPTIONS = [
  { value: "safe", label: "Safe", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  { value: "balanced", label: "Bal", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  { value: "fast", label: "Ceil", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25" },
] as const;

const BATCH_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tmrw" },
  { value: "weekend", label: "Wknd" },
  { value: "next", label: "Next" },
] as const;

interface Props {
  onSubmit: (query: string) => void;
}

export function CommandBarAdvanced({ onSubmit }: Props) {
  const [level, setLevel] = useState(2);
  const [strategy, setStrategy] = useState("safe");
  const [batch, setBatch] = useState("all");

  const streakLevel = STREAK_LEVELS.find((l) => l.level === level);
  const threshold = streakLevel?.threshold ?? 320;
  const reward = streakLevel?.reward ?? "$6";

  const handleGo = () => {
    const parts = [`Best lineup for level ${level}`];
    if (strategy !== "safe") parts.push(`with ${strategy} strategy`);
    if (batch === "next") parts.push("using only the next game batch");
    if (batch === "today") parts.push("using only players playing today");
    if (batch === "tomorrow") parts.push("using only players playing tomorrow");
    if (batch === "weekend") parts.push("using only weekend games");
    onSubmit(parts.join(" "));
  };

  return (
    <div className="px-4 pt-3 pb-2.5 space-y-2">
      {/* Row 1: Title + Level + threshold */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
        <span className="text-[11px] font-semibold text-zinc-300">AI Lineup</span>

        <div className="flex gap-0.5 ml-1">
          {STREAK_LEVELS.map((l) => (
            <button
              key={l.level}
              onClick={() => setLevel(l.level)}
              className={cn(
                "w-6 h-6 rounded-md text-[10px] font-bold transition-all duration-150",
                level === l.level
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-zinc-800/60 text-zinc-500 border border-transparent hover:text-zinc-300 hover:border-zinc-700",
              )}
            >
              {l.level}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-zinc-500 ml-auto">
          {threshold}pts <span className="text-primary font-semibold">{reward}</span>
        </span>
      </div>

      {/* Row 2: Strategy + Games + Build */}
      <div className="flex items-center gap-1.5">
        {STRATEGY_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStrategy(s.value)}
            className={cn(
              "px-2 py-1 rounded-md text-[10px] font-bold transition-all duration-150 border",
              strategy === s.value
                ? `${s.bg} ${s.color} ${s.border}`
                : "bg-zinc-800/60 text-zinc-500 border-transparent hover:text-zinc-300",
            )}
          >
            {s.label}
          </button>
        ))}

        <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />

        {BATCH_OPTIONS.map((b) => (
          <button
            key={b.value}
            onClick={() => setBatch(b.value)}
            className={cn(
              "px-1.5 py-1 rounded-md text-[10px] font-bold transition-all duration-150 border",
              batch === b.value
                ? "bg-zinc-700/80 text-white border-zinc-600"
                : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300",
            )}
          >
            {b.label}
          </button>
        ))}

        <button
          onClick={handleGo}
          className="ml-auto px-3 py-1 rounded-md text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all duration-150 flex items-center gap-1.5 shrink-0"
        >
          <Zap className="w-3 h-3" />
          Build
        </button>
      </div>
    </div>
  );
}
