"use client";

import { cn } from "@/lib/utils";
import { useLineupStore } from "@/lib/lineup-store";

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

/* ─── Empty slot on pitch ─── */
export function EmptySlot({
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
