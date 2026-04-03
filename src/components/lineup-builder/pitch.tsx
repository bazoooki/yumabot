"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Info,
  Crown,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn, formatKickoffTime, getKickoffUrgency } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { usePlayerIntel, useLiveScores } from "@/lib/hooks";
import { estimateTotalScore, getEditionInfo } from "@/lib/ai-lineup";
import type { SorareCard, PlayerIntel } from "@/lib/types";
import { PlayerModal } from "./player-modal";

// Formation layout: indices into DEFAULT_SLOTS (GK=0, DEF=1, MID=2, FWD=3, EX=4)
const FORMATION = {
  topRow: [
    { index: 3, label: "FWD" },
    { index: 4, label: "EX" },
  ],
  bottomRow: [
    { index: 1, label: "DEF" },
    { index: 0, label: "GK" },
    { index: 2, label: "MID" },
  ],
};

// Position-specific accent colors for empty slots
const POSITION_ACCENT: Record<
  string,
  { border: string; bg: string; text: string; icon: string }
> = {
  GK: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/[0.04]",
    text: "text-amber-400/50",
    icon: "border-amber-500/30",
  },
  DEF: {
    border: "border-blue-500/25",
    bg: "bg-blue-500/[0.04]",
    text: "text-blue-400/50",
    icon: "border-blue-500/30",
  },
  MID: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.04]",
    text: "text-emerald-400/50",
    icon: "border-emerald-500/30",
  },
  FWD: {
    border: "border-red-500/25",
    bg: "bg-red-500/[0.04]",
    text: "text-red-400/50",
    icon: "border-red-500/30",
  },
  EX: {
    border: "border-purple-500/25",
    bg: "bg-purple-500/[0.04]",
    text: "text-purple-400/50",
    icon: "border-purple-500/30",
  },
};

/* ─── Filled card on pitch ─── */
function FilledSlot({
  slotIndex,
  intel,
}: {
  slotIndex: number;
  intel?: PlayerIntel;
}) {
  const { slots, removeCard, setCaptain } = useLineupStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const slot = slots[slotIndex];
  const card = slot.card!;
  const player = card.anyPlayer!;
  const isCaptain = slot.isCaptain;

  const isUnavailable =
    intel?.fieldStatus === "INJURED" ||
    intel?.fieldStatus === "SUSPENDED" ||
    intel?.fieldStatus === "NOT_IN_SQUAD";
  const isConfirmed =
    intel?.reliability === "HIGH" && intel?.fieldStatus === "ON_FIELD";

  // Expected score
  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const editionInfo = getEditionInfo(card);
  const expectedScore = isUnavailable
    ? 0
    : avgScore * power * (1 + editionInfo.bonus);

  // Game info
  const game = player.activeClub?.upcomingGames?.[0];
  const clubCode = player.activeClub?.code;
  const rival = game
    ? game.homeTeam.code === clubCode
      ? game.awayTeam.code
      : game.homeTeam.code
    : null;
  const isHome = game ? game.homeTeam.code === clubCode : false;
  const kickoff = game ? formatKickoffTime(game.date) : null;
  const urgency = game ? getKickoffUrgency(game.date) : "no-game";

  const starterProb = intel?.starterProbability;

  return (
    <>
      <div
        className={cn(
          "relative w-[136px] h-[180px] rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer select-none",
          isCaptain
            ? "ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/15"
            : isUnavailable
              ? "ring-1 ring-red-500/40 opacity-60"
              : "ring-1 ring-white/[0.08] hover:ring-purple-400/40",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => removeCard(slotIndex)}
      >
        {/* Card image — fills entire slot */}
        <Image
          src={card.pictureUrl}
          alt={player.displayName}
          fill
          className="object-cover object-[center_18%] scale-[1.15]"
          sizes="136px"
        />

        {/* Unavailable red tint */}
        {isUnavailable && <div className="absolute inset-0 bg-red-900/40" />}

        {/* Hover overlay — "Remove" */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 transition-opacity duration-150 z-20",
            hovered ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <X className="w-5 h-5 text-white/90" />
          <span className="text-[10px] text-white/70 font-medium">Remove</span>
        </div>

        {/* ── Top row: captain + status badges ── */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between z-10">
          {/* Captain toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCaptain(slotIndex);
            }}
            className={cn(
              "p-1 rounded-lg transition-all backdrop-blur-sm",
              isCaptain
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                : "bg-black/40 text-white/40 hover:text-amber-400 hover:bg-black/60",
            )}
            title={isCaptain ? "Remove captain" : "Set as captain (+50%)"}
          >
            <Crown className="w-3.5 h-3.5" />
          </button>

          {/* Status / starter % / info */}
          <div className="flex items-center gap-1">
            {isUnavailable && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-red-500 text-white">
                {intel.fieldStatus === "INJURED" ? "INJ" : "OUT"}
              </span>
            )}
            {isConfirmed && !isUnavailable && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-green-500 text-white flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> CONF
              </span>
            )}
            {!isConfirmed && !isUnavailable && starterProb != null && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm",
                  starterProb >= 70
                    ? "bg-green-600/90 text-white"
                    : starterProb >= 50
                      ? "bg-yellow-500/90 text-black"
                      : "bg-red-500/90 text-white",
                )}
              >
                {Math.round(starterProb)}%
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="p-1 rounded-lg bg-black/40 text-white/40 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Bottom gradient with player info ── */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 pb-2 px-2.5 z-10">
          {/* Score + captain multiplier */}
          <div className="flex items-center justify-between mb-1">
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                isUnavailable
                  ? "bg-red-500/20 text-red-400"
                  : expectedScore >= 60
                    ? "bg-green-500/25 text-green-400"
                    : expectedScore >= 40
                      ? "bg-yellow-500/25 text-yellow-400"
                      : "bg-white/10 text-zinc-400",
              )}
            >
              {isUnavailable ? "0" : `~${Math.round(expectedScore)}`}
            </span>
            {isCaptain && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                C x1.5
              </span>
            )}
          </div>

          {/* Player name */}
          <p className="text-[12px] font-bold text-white truncate leading-tight">
            {player.displayName.split(" ").pop()}
          </p>

          {/* Match info */}
          {game && rival ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "text-[9px]",
                  isHome ? "text-zinc-300" : "text-zinc-500",
                )}
              >
                {isHome ? "vs" : "@"}
              </span>
              <span className="text-[10px] font-bold text-zinc-200">
                {rival}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold ml-auto",
                  urgency === "imminent"
                    ? "text-green-400"
                    : urgency === "soon"
                      ? "text-yellow-300"
                      : "text-zinc-500",
                )}
              >
                {kickoff}
              </span>
            </div>
          ) : (
            <p className="text-[9px] text-red-400/50 mt-0.5">No game</p>
          )}
        </div>
      </div>

      <PlayerModal card={card} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

/* ─── Empty slot on pitch ─── */
function EmptySlot({
  slotIndex,
  label,
}: {
  slotIndex: number;
  label: string;
}) {
  const { selectedSlotIndex, selectSlot } = useLineupStore();
  const isSelected = selectedSlotIndex === slotIndex;
  const accent = POSITION_ACCENT[label] || POSITION_ACCENT.EX;

  return (
    <button
      onClick={() => selectSlot(isSelected ? null : slotIndex)}
      className={cn(
        "relative w-[136px] h-[180px] rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-2.5",
        isSelected
          ? "bg-purple-500/10 border-2 border-purple-400/70 shadow-lg shadow-purple-500/15"
          : cn(
              "border border-dashed hover:border-solid",
              accent.border,
              accent.bg,
              "hover:border-purple-500/40 hover:bg-purple-500/[0.04]",
            ),
      )}
    >
      {/* Plus circle */}
      <div
        className={cn(
          "w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-all",
          isSelected
            ? "border-purple-400/60 bg-purple-500/15"
            : cn(accent.icon, "bg-transparent"),
        )}
      >
        <span
          className={cn(
            "text-lg font-light",
            isSelected ? "text-purple-300" : "text-zinc-600",
          )}
        >
          +
        </span>
      </div>

      {/* Position label */}
      <span
        className={cn(
          "text-sm font-bold tracking-wider",
          isSelected ? "text-purple-300" : accent.text,
        )}
      >
        {label}
      </span>

      {/* Hint when selected */}
      {isSelected && (
        <span className="absolute bottom-3 text-[9px] text-purple-400/60 animate-pulse">
          Select a card
        </span>
      )}
    </button>
  );
}

/* ─── Slot dispatcher ─── */
function SlotCard({
  slotIndex,
  label,
  intel,
}: {
  slotIndex: number;
  label: string;
  intel?: PlayerIntel;
}) {
  const card = useLineupStore((s) => s.slots[slotIndex]?.card);

  if (card && card.anyPlayer) {
    return <FilledSlot slotIndex={slotIndex} intel={intel} />;
  }
  return <EmptySlot slotIndex={slotIndex} label={label} />;
}

/* ─── Pitch field markings (SVG) ─── */
function PitchMarkings() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0e2e] via-[#140d24] to-[#0f0d1a]" />

      {/* Subtle radial glow at center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-purple-500/[0.03] blur-3xl" />

      {/* Outer boundary */}
      <div className="absolute inset-x-5 top-[5%] bottom-[5%] border border-purple-400/[0.08] rounded-xl" />

      {/* Center line */}
      <div className="absolute left-5 right-5 top-1/2 h-px bg-purple-400/[0.08]" />

      {/* Center circle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-purple-400/[0.08] rounded-full" />

      {/* Center dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-purple-400/[0.12] rounded-full" />

      {/* Top penalty area */}
      <div className="absolute left-[18%] right-[18%] top-[5%] h-[20%] border-b border-l border-r border-purple-400/[0.08] rounded-b-lg" />
      {/* Top goal area */}
      <div className="absolute left-[30%] right-[30%] top-[5%] h-[10%] border-b border-l border-r border-purple-400/[0.06] rounded-b-md" />

      {/* Bottom penalty area */}
      <div className="absolute left-[18%] right-[18%] bottom-[5%] h-[20%] border-t border-l border-r border-purple-400/[0.08] rounded-t-lg" />
      {/* Bottom goal area */}
      <div className="absolute left-[30%] right-[30%] bottom-[5%] h-[10%] border-t border-l border-r border-purple-400/[0.06] rounded-t-md" />

      {/* Corner arcs */}
      <div className="absolute top-[5%] left-5 w-6 h-6 border-b border-r border-purple-400/[0.06] rounded-br-full" />
      <div className="absolute top-[5%] right-5 w-6 h-6 border-b border-l border-purple-400/[0.06] rounded-bl-full" />
      <div className="absolute bottom-[5%] left-5 w-6 h-6 border-t border-r border-purple-400/[0.06] rounded-tr-full" />
      <div className="absolute bottom-[5%] right-5 w-6 h-6 border-t border-l border-purple-400/[0.06] rounded-tl-full" />
    </div>
  );
}

/* ─── Score header ─── */
function ScoreHeader({
  totalEstimate,
  targetScore,
  filledCount,
  currentLevel,
  showLive,
  actualTotal,
  projectedTotal,
}: {
  totalEstimate: number;
  targetScore: number;
  filledCount: number;
  currentLevel: number;
  showLive: boolean;
  actualTotal: number;
  projectedTotal: number;
}) {
  const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
  const displayScore = showLive ? projectedTotal : Math.round(totalEstimate);
  const progressPct = Math.min(100, (displayScore / targetScore) * 100);
  const actualPct = showLive
    ? Math.min(100, (actualTotal / targetScore) * 100)
    : 0;
  const onTrack = displayScore >= targetScore;

  return (
    <div className="px-4 py-3 border-b border-zinc-800/80">
      {/* Top row: title + score */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white tracking-wide">
            L{currentLevel}
          </span>
          <span className="text-[10px] text-zinc-500 font-medium">
            {streakLevel?.reward}
          </span>
          {showLive && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-green-400 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5">
          {showLive && actualTotal !== projectedTotal && (
            <span className="text-sm font-bold text-white">{actualTotal}</span>
          )}
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              showLive && actualTotal !== projectedTotal
                ? "text-zinc-500 text-sm"
                : onTrack
                  ? "text-green-400"
                  : "text-zinc-300",
            )}
          >
            {showLive && actualTotal !== projectedTotal ? `~${projectedTotal}` : displayScore > 0 ? `~${displayScore}` : "—"}
          </span>
          <span className="text-xs text-zinc-600">/</span>
          <span className="text-xs text-zinc-400 font-semibold">
            {targetScore}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {/* Projected fill (lighter) */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            onTrack ? "bg-green-500/30" : "bg-purple-500/25",
          )}
          style={{ width: `${progressPct}%` }}
        />
        {/* Actual fill (solid, live only) */}
        {showLive && (
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${actualPct}%` }}
          />
        )}
        {/* Non-live estimated fill */}
        {!showLive && filledCount > 0 && (
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              onTrack ? "bg-green-500" : "bg-purple-500",
            )}
            style={{ width: `${progressPct}%` }}
          />
        )}
      </div>

      {/* Bottom row: player count + status */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-600">
          {filledCount}/5 players
        </span>
        {filledCount > 0 && (
          <span
            className={cn(
              "text-[10px] font-bold",
              onTrack
                ? "text-green-400"
                : displayScore >= targetScore * 0.85
                  ? "text-yellow-400"
                  : "text-zinc-500",
            )}
          >
            {onTrack
              ? "ON TRACK"
              : displayScore >= targetScore * 0.85
                ? "CLOSE"
                : `${Math.round(targetScore - displayScore)} pts short`}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main Pitch component ─── */
export function Pitch({ cards }: { cards: SorareCard[] }) {
  const { slots, targetScore, currentLevel } = useLineupStore();
  const playerIntel = usePlayerIntel(cards);
  const {
    isAnyGameLive,
    allGamesFinished,
    actualTotal,
    projectedTotal,
  } = useLiveScores();

  const filledCards = slots.map((s) => s.card);
  const captainIndex = slots.findIndex((s) => s.isCaptain);
  const totalEstimate = estimateTotalScore(
    filledCards,
    captainIndex >= 0 ? captainIndex : undefined,
  );
  const filledCount = filledCards.filter(Boolean).length;
  const showLive = isAnyGameLive || allGamesFinished;

  function getIntel(slotIndex: number): PlayerIntel | undefined {
    const slug = slots[slotIndex]?.card?.anyPlayer?.slug;
    return slug && playerIntel ? playerIntel[slug] : undefined;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Score header */}
      <ScoreHeader
        totalEstimate={totalEstimate}
        targetScore={targetScore}
        filledCount={filledCount}
        currentLevel={currentLevel}
        showLive={showLive}
        actualTotal={actualTotal}
        projectedTotal={projectedTotal}
      />

      {/* Pitch area */}
      <div className="flex-1 relative overflow-hidden">
        <PitchMarkings />

        {/* Formation grid */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-5 py-6">
          {/* Top row: FWD + EX */}
          <div className="flex items-center justify-center gap-5">
            {FORMATION.topRow.map(({ index, label }) => (
              <SlotCard
                key={label}
                slotIndex={index}
                label={label}
                intel={getIntel(index)}
              />
            ))}
          </div>

          {/* Bottom row: DEF + GK + MID */}
          <div className="flex items-center justify-center gap-4">
            {FORMATION.bottomRow.map(({ index, label }) => (
              <SlotCard
                key={label}
                slotIndex={index}
                label={label}
                intel={getIntel(index)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      {filledCount === 0 && (
        <div className="px-4 py-3 text-center border-t border-zinc-800/60">
          <p className="text-[11px] text-zinc-600">
            Tap a slot, then pick a card from the right panel
          </p>
        </div>
      )}
    </div>
  );
}
