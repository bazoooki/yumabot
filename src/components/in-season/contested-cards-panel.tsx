"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import type { ContestedCard, InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

function ContestedCardRow({
  contested,
  competitions,
  onAssign,
}: {
  contested: ContestedCard;
  competitions: InSeasonCompetition[];
  onAssign: (competitionSlug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const player = contested.card.anyPlayer;
  const rarityConf = RARITY_CONFIG[contested.card.rarityTyped];
  const position = player?.cardPositions?.[0] ?? "Unknown";

  // Sort competitions by value for this card (descending)
  const sortedComps = [...contested.eligibleCompetitions].sort(
    (a, b) =>
      (contested.valueByCompetition[b] ?? 0) -
      (contested.valueByCompetition[a] ?? 0),
  );
  const bestComp = sortedComps[0];

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}

        {/* Card picture */}
        {contested.card.pictureUrl ? (
          <img
            src={contested.card.pictureUrl}
            alt=""
            className="w-7 h-7 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0" />
        )}

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {player?.displayName ?? "Unknown"}
            </span>
            <span
              className={cn(
                "text-[10px]",
                rarityConf?.color ?? "text-zinc-500",
              )}
            >
              {rarityConf?.label}
            </span>
            <span className="text-[10px] text-zinc-500">{position}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {contested.eligibleCompetitions.length} competitions
            {contested.assignedTo && (
              <span className="text-amber-400/70 ml-1.5">
                &rarr;{" "}
                {competitions.find((c) => c.slug === contested.assignedTo)
                  ?.leagueName ?? contested.assignedTo}
              </span>
            )}
          </div>
        </div>

        {/* Best value indicator */}
        {bestComp && (
          <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">
            best: {Math.round(contested.valueByCompetition[bestComp] ?? 0)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-3 py-2 space-y-1.5 bg-zinc-900/30">
          {sortedComps.map((compSlug) => {
            const comp = competitions.find((c) => c.slug === compSlug);
            if (!comp) return null;
            const value = contested.valueByCompetition[compSlug] ?? 0;
            const isBest = compSlug === bestComp;
            const isAssigned = contested.assignedTo === compSlug;

            return (
              <div
                key={compSlug}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      RARITY_CONFIG[comp.mainRarityType]?.dotColor ??
                        "bg-zinc-500",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs truncate",
                      isAssigned
                        ? "text-amber-300"
                        : isBest
                          ? "text-zinc-200"
                          : "text-zinc-400",
                    )}
                  >
                    {comp.leagueName}{" "}
                    <span className="text-zinc-600">
                      {RARITY_CONFIG[comp.mainRarityType]?.label}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {Math.round(value)}
                  </span>
                  {isBest && (
                    <span className="text-[9px] text-emerald-500 font-medium">
                      BEST
                    </span>
                  )}
                  {!isAssigned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssign(compSlug);
                      }}
                      className="flex items-center gap-0.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Assign <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {isAssigned && (
                    <span className="text-[10px] text-amber-400/50">
                      assigned
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ContestedCardsPanel({
  contestedCards,
  competitions,
  onAssign,
}: {
  contestedCards: ContestedCard[];
  competitions: InSeasonCompetition[];
  onAssign: (competitionSlug: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (contestedCards.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-2 w-full"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        )}
        <h3 className="text-xs font-medium text-zinc-400">
          Contested Cards ({contestedCards.length})
        </h3>
      </button>

      {!collapsed && (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {contestedCards.map((contested) => (
            <ContestedCardRow
              key={contested.card.slug}
              contested={contested}
              competitions={competitions}
              onAssign={onAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
}
