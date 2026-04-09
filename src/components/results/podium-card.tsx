"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LeaderboardSummary, ResultsRanking } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEDAL_STYLES = [
  { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300", label: "1st" },
  { bg: "bg-zinc-400/10", border: "border-zinc-400/30", text: "text-zinc-300", label: "2nd" },
  { bg: "bg-orange-700/10", border: "border-orange-700/30", text: "text-orange-400", label: "3rd" },
];

function LineupDetail({ ranking }: { ranking: ResultsRanking }) {
  return (
    <div className="grid grid-cols-5 gap-1 mt-1.5">
      {ranking.lineup
        .sort((a, b) => a.index - b.index)
        .map((app) => (
          <div
            key={app.index}
            className={cn(
              "text-center px-1 py-1 rounded text-[9px]",
              app.captain ? "bg-amber-500/10 border border-amber-500/20" : "bg-zinc-800/50",
            )}
          >
            <div className="text-zinc-500 uppercase">{app.position?.slice(0, 3)}</div>
            <div className="text-zinc-300 truncate">{app.playerName?.split(" ").pop()}</div>
            <div className="text-zinc-400 tabular-nums">{Math.round(app.score)}</div>
            {app.captain && <div className="text-[8px] text-amber-400">C</div>}
          </div>
        ))}
    </div>
  );
}

function PodiumRow({
  ranking,
  medal,
  isClan,
}: {
  ranking: ResultsRanking;
  medal: (typeof MEDAL_STYLES)[number];
  isClan: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors",
          medal.bg,
          "border",
          medal.border,
          "hover:brightness-110",
        )}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
        )}

        <span className={cn("text-[10px] font-bold shrink-0 w-6", medal.text)}>
          {medal.label}
        </span>

        {ranking.user.pictureUrl ? (
          <img
            src={ranking.user.pictureUrl}
            alt=""
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />
        )}

        <span
          className={cn(
            "text-xs font-medium truncate",
            isClan ? "text-violet-300" : "text-zinc-200",
          )}
        >
          {ranking.user.nickname}
        </span>

        <span className="ml-auto text-xs text-zinc-400 tabular-nums shrink-0">
          {Math.round(ranking.score)}
        </span>
      </button>

      {expanded && <LineupDetail ranking={ranking} />}
    </div>
  );
}

export function PodiumCard({
  leaderboard,
  clanSlugs,
}: {
  leaderboard: LeaderboardSummary;
  clanSlugs: Set<string>;
}) {
  const rarityConf = RARITY_CONFIG[leaderboard.mainRarityType];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              rarityConf?.dotColor ?? "bg-zinc-500",
            )}
          />
          <span className="text-xs font-medium text-zinc-200 truncate">
            {leaderboard.leagueName}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600 shrink-0">
          {leaderboard.totalEntries.toLocaleString()} entries
        </span>
      </div>

      {/* Podium rows */}
      {leaderboard.podium.map((ranking, i) => (
        <PodiumRow
          key={ranking.user.slug}
          ranking={ranking}
          medal={MEDAL_STYLES[i]}
          isClan={clanSlugs.has(ranking.user.slug)}
        />
      ))}
    </div>
  );
}
