import type { HotStreakEntry } from "@/components/home/use-hot-streak-entries";

/**
 * Mirrors the LineupBuilder heuristic table (knowledge/11-domain-streak-levels.md
 * and src/lib/lineup-store.ts). Used as the floor when neither LIVE nor my-streaks
 * supplied real thresholds for a competition — better to suggest a level-1 target
 * than to bail out.
 */
export const FALLBACK_TARGETS: ReadonlyArray<{
  level: number;
  score: number;
  reward: string;
}> = [
  { level: 1, score: 280, reward: "$2" },
  { level: 2, score: 320, reward: "$6" },
  { level: 3, score: 360, reward: "$15" },
  { level: 4, score: 400, reward: "$50" },
  { level: 5, score: 440, reward: "$200" },
  { level: 6, score: 480, reward: "$1,000" },
];

export interface StreakTarget {
  level: number;
  score: number;
  reward: string;
}

/**
 * Resolve the next-up target threshold for a hot-streak entry, optionally
 * shifted by `offset` levels (the AI panel uses offset to let the user aim
 * higher). Falls back to the heuristic table when streak data is missing.
 */
export function nextTargetForEntry(
  entry: HotStreakEntry,
  offset = 0,
): StreakTarget {
  const streak = entry.streak;
  if (streak && streak.thresholds.length > 0) {
    const byCurrent = streak.thresholds.findIndex((t) => t.isCurrent);
    const byUncleared = streak.thresholds.findIndex((t) => !t.isCleared);
    const baseIdx = byCurrent >= 0 ? byCurrent : byUncleared >= 0 ? byUncleared : 0;
    const idx = Math.min(streak.thresholds.length - 1, baseIdx + offset);
    const t = streak.thresholds[idx];
    return { level: t.level, score: t.score, reward: t.reward };
  }
  const idx = Math.min(FALLBACK_TARGETS.length - 1, Math.max(0, offset));
  const t = FALLBACK_TARGETS[idx];
  return { level: t.level, score: t.score, reward: t.reward };
}
