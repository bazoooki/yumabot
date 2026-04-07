"use client";

import { useMemo } from "react";
import { Trash2, Sparkles, Loader2 } from "lucide-react";
import type { SorareCard, InSeasonCompetition } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { useEligibleCards } from "@/lib/in-season-store";
import { TeamTabs } from "./team-tabs";
import { StreakHeader } from "./streak-header";
import { InSeasonCardPicker } from "./in-season-card-picker";
import { LineupValidationBar } from "./lineup-validation-bar";
import { CommandBar } from "@/components/command-bar/command-bar";
import { cn } from "@/lib/utils";

function SlotCard({
  position,
  index,
  comp,
}: {
  position: string;
  index: number;
  comp: InSeasonCompetition;
}) {
  const selectedTeamIndex = useInSeasonStore((s) => s.selectedTeamIndex);
  const slots = useInSeasonStore((s) => s.slots);
  const selectSlot = useInSeasonStore((s) => s.selectSlot);
  const selectedSlotIndex = useInSeasonStore((s) => s.selectedSlotIndex);
  const removeCard = useInSeasonStore((s) => s.removeCard);
  const setCaptain = useInSeasonStore((s) => s.setCaptain);

  const localSlot = slots[index];
  const team = comp.teams[selectedTeamIndex];
  const serverSlot = team?.slots.find((s) => s.index === index);

  const card = localSlot?.card;
  const playerName = card?.anyPlayer?.displayName ?? serverSlot?.playerName;
  const pictureUrl = card?.pictureUrl ?? serverSlot?.pictureUrl;
  const isCaptain = localSlot?.isCaptain ?? serverSlot?.isCaptain ?? false;
  const score = serverSlot?.score;
  const hasFill = card || serverSlot?.cardSlug;
  const isSelected = selectedSlotIndex === index;
  const isInSeason = card?.inSeasonEligible;

  return (
    <button
      onClick={() => {
        if (isSelected && hasFill) {
          setCaptain(index);
        } else {
          selectSlot(index);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (card) removeCard(index);
      }}
      className={cn(
        "flex flex-col items-center p-3 rounded-lg border transition-all relative",
        isSelected
          ? "border-amber-500/50 bg-amber-500/5"
          : hasFill
            ? "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600"
            : "bg-zinc-900/30 border-zinc-800/50 border-dashed hover:border-zinc-700",
      )}
    >
      {pictureUrl ? (
        <img
          src={pictureUrl}
          alt={playerName ?? ""}
          className="w-14 h-14 rounded-md object-cover mb-1"
        />
      ) : (
        <div className="w-14 h-14 rounded-md bg-zinc-800/50 flex items-center justify-center mb-1">
          <span className="text-xs text-zinc-600 font-medium">{position}</span>
        </div>
      )}
      <span className="text-[10px] text-zinc-400 truncate w-full text-center">
        {playerName ?? "Empty"}
      </span>
      <div className="flex items-center gap-1">
        {isCaptain && (
          <span className="text-[9px] text-amber-400 font-bold">C</span>
        )}
        {card && isInSeason && (
          <span className="text-[7px] font-bold text-green-400">IS</span>
        )}
        {card && !isInSeason && (
          <span className="text-[7px] font-bold text-yellow-500">!IS</span>
        )}
      </div>
      {score != null && (
        <span className="text-[10px] text-zinc-300 font-mono">
          {score.toFixed(0)}
        </span>
      )}
    </button>
  );
}

export function InSeasonMain({
  comp,
  cards,
}: {
  comp: InSeasonCompetition;
  cards: SorareCard[];
}) {
  const selectedTeamIndex = useInSeasonStore((s) => s.selectedTeamIndex);
  const clearLineup = useInSeasonStore((s) => s.clearLineup);
  const autoFillWithStrategy = useInSeasonStore((s) => s.autoFillWithStrategy);
  const isAutoFilling = useInSeasonStore((s) => s.isAutoFilling);
  const rarityConf = RARITY_CONFIG[comp.mainRarityType];
  const team = comp.teams[selectedTeamIndex];

  const eligible = useEligibleCards(cards);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: lineup area */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {/* AI Command Bar */}
        <div className="mb-4">
          <CommandBar activeTab="in-season" cards={cards} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {comp.leagueName}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs font-medium", rarityConf?.color)}>
                {rarityConf?.label}
              </span>
              <span className="text-xs text-zinc-500">
                Division {comp.division}
              </span>
              <span className="text-xs text-zinc-600">
                {eligible.length} eligible cards
              </span>
            </div>
          </div>
          {comp.cutOffDate && (
            <div className="text-xs text-zinc-500">
              Locks{" "}
              {new Date(comp.cutOffDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        {/* Team tabs */}
        <TeamTabs comp={comp} />

        {/* Streak */}
        <StreakHeader streak={comp.streak} />

        {/* Team info */}
        {team && (
          <div className="text-xs text-zinc-500 mb-3 flex items-center gap-3">
            <span>{team.name}</span>
            {team.totalScore != null && (
              <span className="text-zinc-400">Score: {team.totalScore}</span>
            )}
            {team.ranking != null && (
              <span className="text-zinc-400">Rank #{team.ranking}</span>
            )}
          </div>
        )}

        {/* Lineup slots */}
        <div className="grid grid-cols-5 gap-3 mb-2">
          {(["GK", "DEF", "MID", "FWD", "EX"] as const).map((pos, i) => (
            <SlotCard key={pos} position={pos} index={i} comp={comp} />
          ))}
        </div>

        {/* Validation bar */}
        <LineupValidationBar />

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => autoFillWithStrategy(cards)}
            disabled={isAutoFilling}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              isAutoFilling
                ? "bg-amber-800/30 text-amber-500/50 cursor-wait"
                : "bg-amber-600/80 hover:bg-amber-500 text-white",
            )}
          >
            {isAutoFilling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {isAutoFilling ? "Generating..." : "Generate Lineup"}
          </button>
          <button
            onClick={clearLineup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Right: card picker */}
      <div className="w-80 xl:w-96 shrink-0">
        <InSeasonCardPicker cards={cards} />
      </div>
    </div>
  );
}
