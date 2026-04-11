"use client";

import { cn } from "@/lib/utils";

export function getScoreBadgeColor(
  score: number | null,
  scoreStatus: string | null,
): string {
  if (score == null) return "bg-zinc-800 text-zinc-600";
  const s = (scoreStatus ?? "").toLowerCase();
  const isLive = s === "live" || s === "playing" || s === "started";
  if (isLive && score >= 60) return "bg-green-500 text-white";
  if (isLive && score >= 40) return "bg-yellow-500 text-zinc-900";
  if (isLive && score > 0) return "bg-orange-500 text-white";
  if (isLive) return "bg-zinc-700 text-zinc-400";
  if (score >= 60) return "bg-green-600 text-white";
  if (score >= 40) return "bg-yellow-600 text-zinc-900";
  if (score > 0) return "bg-zinc-600 text-white";
  return "bg-zinc-800 text-zinc-600";
}

export function ScoreBadge({
  score,
  scoreStatus,
  size = "md",
  className,
}: {
  score: number | null;
  scoreStatus: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (score == null) return null;

  return (
    <span
      className={cn(
        "font-bold rounded-md text-center tabular-nums block",
        size === "sm"
          ? "text-[10px] px-1.5 py-0.5 min-w-[26px]"
          : "text-[10px] px-1.5 py-px min-w-[24px] rounded-full",
        getScoreBadgeColor(score, scoreStatus),
        className,
      )}
    >
      {Math.round(score)}
    </span>
  );
}
