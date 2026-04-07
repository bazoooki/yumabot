"use client";

import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { usePlayerIntel, useLiveScores } from "@/lib/hooks";
import { estimateTotalScore } from "@/lib/ai-lineup";
import type { SorareCard, PlayerIntel } from "@/lib/types";
import { FilledSlot } from "./filled-slot";
import { EmptySlot } from "./empty-slot";

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
  const isFinal = currentLevel === 6;
  const displayScore = showLive ? projectedTotal : Math.round(totalEstimate);
  const progressPct = Math.min(100, (displayScore / targetScore) * 100);
  const actualPct = showLive
    ? Math.min(100, (actualTotal / targetScore) * 100)
    : 0;
  const onTrack = displayScore >= targetScore;
  const { setCurrentLevel } = useLineupStore();

  return (
    <div className="px-4 py-3 border-b border-zinc-800/80">
      {/* Level selector + reward */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {STREAK_LEVELS.map((lvl) => {
            const isActive = lvl.level === currentLevel;
            const isPast = lvl.level < currentLevel;
            return (
              <button
                key={lvl.level}
                onClick={() => setCurrentLevel(lvl.level)}
                className={cn(
                  "px-2 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                  isActive
                    ? isFinal
                      ? "bg-amber-500 border-amber-400 text-black shadow-md shadow-amber-500/30"
                      : "bg-purple-500 border-purple-400 text-white shadow-md shadow-purple-500/30"
                    : isPast
                      ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500",
                )}
              >
                {lvl.threshold}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{targetScore} pts</span>
          <span className={cn(
            "text-sm font-bold",
            isFinal ? "text-amber-400" : "text-green-400",
          )}>
            {streakLevel?.reward}
          </span>
          {showLive && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Score + progress */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-zinc-600">
          {filledCount}/5 players
        </span>
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
          <span className="text-xs text-zinc-600">/ {targetScore}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {showLive ? (
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${actualPct}%` }}
          />
        ) : filledCount > 0 ? (
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              onTrack ? "bg-green-500" : "bg-purple-500",
            )}
            style={{ width: `${progressPct}%` }}
          />
        ) : null}
      </div>

      {/* Status text */}
      {filledCount > 0 && (
        <div className="flex justify-end mt-1">
          <span
            className={cn(
              "text-[10px] font-bold",
              onTrack ? "text-green-400" : displayScore >= targetScore * 0.85 ? "text-yellow-400" : "text-zinc-500",
            )}
          >
            {onTrack ? "ON TRACK" : displayScore >= targetScore * 0.85 ? "CLOSE" : `${Math.round(targetScore - displayScore)} pts short`}
          </span>
        </div>
      )}
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
