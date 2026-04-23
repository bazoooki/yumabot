import { formatUsdFromCents } from "@/lib/rewards";
import type { InSeasonStreak, InSeasonThreshold } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Normalize Sorare's `thresholdsStreakTask` payload into the app's InSeasonStreak
 * shape. Shared by `/api/in-season/competitions` (live/closed lineups) and
 * `/api/in-season/my-streaks` (next-GW state queried via myThresholdsStreakTask).
 *
 * When a separate `currentThreshold(forNextLineup: true).score` is available
 * (only surfaced by myThresholdsStreakTask), pass it in — it overrides the
 * `current` flag on the threshold list so the displayed level reflects the
 * upcoming GW, not whatever the current in-flight lineup is aiming at.
 */
export function parseStreak(
  task: any,
  overrideCurrentScore?: number | null,
): InSeasonStreak | null {
  if (!task?.thresholds) return null;

  const byCurrentFlag = task.thresholds.findIndex((th: any) => th.current);
  const byOverride =
    overrideCurrentScore != null
      ? task.thresholds.findIndex((th: any) => th.score === overrideCurrentScore)
      : -1;
  const currentIdx = byOverride >= 0 ? byOverride : byCurrentFlag;

  const thresholds: InSeasonThreshold[] = task.thresholds.map(
    (t: any, i: number) => {
      // Pick the first reward in priority order: cash > essence > card > coin
      const configs: any[] = t.rewardConfigs ?? [];
      const monetary = configs.find(
        (r) => r.__typename === "MonetaryRewardConfig" && r.amount?.usdCents != null,
      );
      const essence = configs.find(
        (r) => r.__typename === "CardShardRewardConfig",
      );
      const card = configs.find((r) => r.__typename === "CardRewardConfig");
      const coin = configs.find((r) => r.__typename === "CoinRewardConfig");

      let reward = "";
      if (monetary) {
        reward = formatUsdFromCents(monetary.amount.usdCents);
      } else if (essence) {
        reward = `${essence.quantity ?? 0} ${essence.rarity ?? "limited"} essence`;
      } else if (card) {
        reward = `${card.rarity ?? "limited"} card`;
      } else if (coin) {
        reward = `${coin.amount ?? 0} coins`;
      }

      return {
        level: i + 1,
        score: t.score,
        reward,
        isCleared: currentIdx >= 0 ? i < currentIdx : false,
        isCurrent: currentIdx >= 0 ? i === currentIdx : (t.current ?? false),
      };
    },
  );

  const currentLevel = thresholds.findIndex((t) => t.isCurrent);
  return {
    currentLevel: currentLevel >= 0 ? currentLevel + 1 : 0,
    streakCount: task.progress ?? 0,
    thresholds,
  };
}
