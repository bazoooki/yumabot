"use client";

import { useState, useMemo } from "react";
import { Sparkles, Zap } from "lucide-react";
import { STREAK_LEVELS } from "@/lib/lineup-store";
import { cn } from "@/lib/utils";
import type { SorareCard } from "@/lib/types";

const STRATEGY_OPTIONS = [
  { value: "safe", label: "Safe", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  { value: "balanced", label: "Bal", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  { value: "fast", label: "Ceil", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25" },
] as const;

interface BatchOption {
  value: string;
  label: string;
}

/** Build dynamic game batch options based on actual upcoming games */
function buildBatchOptions(cards: SorareCard[]): BatchOption[] {
  const now = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Collect unique game dates and competitions
  const gameDays = new Map<string, { date: Date; count: number }>();
  const competitions = new Map<string, number>();

  for (const card of cards) {
    const game = card.anyPlayer?.activeClub?.upcomingGames?.[0];
    if (!game?.date) continue;
    const d = new Date(game.date);
    const dayKey = d.toDateString();
    if (!gameDays.has(dayKey)) {
      gameDays.set(dayKey, { date: d, count: 0 });
    }
    gameDays.get(dayKey)!.count++;

    // Track competitions
    const comp = game.competition?.name;
    if (comp) {
      competitions.set(comp, (competitions.get(comp) || 0) + 1);
    }
  }

  const options: BatchOption[] = [{ value: "all", label: "All" }];
  const sortedDays = [...gameDays.entries()].sort((a, b) => a[1].date.getTime() - b[1].date.getTime());
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  for (const [, { date }] of sortedDays) {
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    let label: string;
    if (isToday) label = "Today";
    else if (isTomorrow) label = "Tmrw";
    else label = dayNames[date.getDay()];

    // Avoid duplicate labels
    if (!options.some((o) => o.label === label)) {
      const value = isToday ? "today" : isTomorrow ? "tomorrow" : date.toISOString().slice(0, 10);
      options.push({ value, label });
    }
  }

  // Add competition-based filters for notable competitions
  const clKeywords = ["champions league", "uefa champions"];
  const elKeywords = ["europa league"];
  for (const [comp, count] of competitions) {
    const lower = comp.toLowerCase();
    if (clKeywords.some((k) => lower.includes(k)) && count >= 2) {
      if (!options.some((o) => o.value === "cl")) {
        options.push({ value: "cl", label: "CL" });
      }
    }
    if (elKeywords.some((k) => lower.includes(k)) && count >= 2) {
      if (!options.some((o) => o.value === "el")) {
        options.push({ value: "el", label: "EL" });
      }
    }
  }

  return options;
}

interface Props {
  onSubmit: (query: string) => void;
  cards: SorareCard[];
}

export function CommandBarAdvanced({ onSubmit, cards }: Props) {
  const [level, setLevel] = useState(2);
  const [strategy, setStrategy] = useState("safe");
  const [batch, setBatch] = useState("all");

  const streakLevel = STREAK_LEVELS.find((l) => l.level === level);
  const threshold = streakLevel?.threshold ?? 320;
  const reward = streakLevel?.reward ?? "$6";

  const batchOptions = useMemo(() => buildBatchOptions(cards), [cards]);

  const handleGo = () => {
    const parts = [`Best lineup for level ${level}`];
    if (strategy !== "safe") parts.push(`with ${strategy} strategy`);
    if (batch === "today") parts.push("using only players playing today");
    else if (batch === "tomorrow") parts.push("using only players playing tomorrow");
    else if (batch === "cl") parts.push("using only Champions League games");
    else if (batch === "el") parts.push("using only Europa League games");
    else if (batch !== "all") {
      // Specific date like "2026-04-09"
      const d = new Date(batch + "T12:00:00");
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      parts.push(`using only games on ${dayLabel}`);
    }
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

        {batchOptions.map((b) => (
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
          className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-primary text-black hover:bg-primary/90 transition-all duration-150 flex items-center gap-2 shrink-0 shadow-md shadow-primary/25"
        >
          <Zap className="w-3.5 h-3.5" />
          Generate Lineup
        </button>
      </div>
    </div>
  );
}
