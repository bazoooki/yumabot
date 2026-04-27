"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  InSeasonCompetition,
  RarityType,
  SorareCard,
} from "@/lib/types";
import {
  useHotStreakEntries,
  type HotStreakEntry,
} from "./use-hot-streak-entries";
import { AISuggestionRow } from "./ai-suggestion-row";
import { SuggestionSettings } from "./suggestion-settings";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Trophy,
  Bot,
} from "lucide-react";

const RARITY_LABEL: Record<string, string> = {
  limited: "Limited",
  rare: "Rare",
  super_rare: "SR",
  unique: "Unique",
};
const RARITY_CLASS: Record<string, string> = {
  limited: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  rare: "bg-red-500/15 text-red-400 border-red-500/20",
  super_rare: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  unique: "bg-zinc-100/15 text-zinc-100 border-zinc-100/20",
};

interface AISuggestionsPanelProps {
  liveCompetitions: InSeasonCompetition[] | undefined;
  liveLoading: boolean;
  liveGameWeek: number | undefined;
  userSlug: string;
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
}

export function AISuggestionsPanel({
  liveCompetitions,
  liveLoading,
  liveGameWeek,
  userSlug,
  cards,
  onNavigate,
}: AISuggestionsPanelProps) {
  const { entries, gameWeek, loading } = useHotStreakEntries({
    liveCompetitions,
    liveLoading,
    liveGameWeek,
    userSlug,
  });

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-bold text-white">
          Next GW{gameWeek ? ` (${gameWeek})` : ""} AI Suggestions
        </h2>
        <span className="text-[10px] text-zinc-500">{entries.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <SuggestionSettings />
          <button
            onClick={() => onNavigate("in-season")}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
          >
            In Season <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">
          No competitions to suggest lineups for.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <SuggestionRowShell
              key={entry.key}
              entry={entry}
              cards={cards}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRowShell({
  entry,
  cards,
  onNavigate,
}: {
  entry: HotStreakEntry;
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const rarity = entry.mainRarityType as RarityType;
  const rarityLabel = RARITY_LABEL[rarity] ?? rarity;
  const rarityClass =
    RARITY_CLASS[rarity] ?? "bg-zinc-800 text-zinc-400 border-zinc-700";

  return (
    <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {entry.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.iconUrl}
              alt=""
              className="w-5 h-5 rounded shrink-0"
            />
          ) : (
            <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {entry.leagueName}
          </span>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
              rarityClass,
            )}
          >
            {rarityLabel}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400/60" />
            <ChevronDown
              className={cn(
                "w-4 h-4 text-zinc-500 transition-transform shrink-0",
                expanded && "rotate-180",
              )}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <AISuggestionRow
          entry={entry}
          cards={cards}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
