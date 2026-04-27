/**
 * Parses Sorare's `So5Ranking.eligibleOrSo5Rewards` union into a flat breakdown.
 *
 * Pre-close: nodes are `So5RewardConfig` (projected from rank bracket).
 * Post-close: nodes are `So5Reward` (actual rewards, includes revealed cards).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface EssenceEntry {
  rarity: string;
  quantity: number;
}

export interface CardRewardEntry {
  rarity: string;
  quantity: number;
  gameplayTier: string | null;
  /** Populated only for actual (post-close) rewards */
  revealed: { cardSlug: string; pictureUrl: string | null; quality: string | null }[];
}

export interface LineupRewardBreakdown {
  usdCents: number;
  coinAmount: number;
  essence: EssenceEntry[];
  cards: CardRewardEntry[];
  /** true iff at least one node in the input was a concrete So5Reward (post-close) */
  isActual: boolean;
}

export function emptyRewardBreakdown(): LineupRewardBreakdown {
  return { usdCents: 0, coinAmount: 0, essence: [], cards: [], isActual: false };
}

function mergeEssence(into: EssenceEntry[], rarity: string, quantity: number) {
  const existing = into.find((e) => e.rarity === rarity);
  if (existing) existing.quantity += quantity;
  else into.push({ rarity, quantity });
}

function mergeCards(
  into: CardRewardEntry[],
  rarity: string,
  quantity: number,
  gameplayTier: string | null,
  revealed: CardRewardEntry["revealed"] = [],
) {
  const key = `${rarity}|${gameplayTier ?? ""}`;
  const existing = into.find(
    (c) => `${c.rarity}|${c.gameplayTier ?? ""}` === key,
  );
  if (existing) {
    existing.quantity += quantity;
    existing.revealed.push(...revealed);
  } else {
    into.push({ rarity, quantity, gameplayTier, revealed: [...revealed] });
  }
}

/**
 * Walks a flat `[AnyRewardConfigInterface]` list (e.g. `completedTasks[].rewardConfigs`
 * or `So5Reward.rewardConfigs`) and accumulates it into a breakdown in-place.
 */
function accumulateRewardConfigs(
  out: LineupRewardBreakdown,
  configs: unknown[] | null | undefined,
) {
  if (!Array.isArray(configs)) return;
  for (const raw of configs) {
    const c = raw as any;
    if (!c?.__typename) continue;
    switch (c.__typename) {
      case "MonetaryRewardConfig":
        out.usdCents += c.amount?.usdCents ?? 0;
        break;
      case "CardShardRewardConfig":
        mergeEssence(out.essence, c.rarity ?? "limited", c.quantity ?? 0);
        break;
      case "CoinRewardConfig":
        out.coinAmount += c.amount ?? 0;
        break;
      case "CardRewardConfig":
        mergeCards(
          out.cards,
          c.rarity ?? "limited",
          c.quantity ?? 1,
          c.gameplayTier ?? null,
          [],
        );
        break;
    }
  }
}

export function parseEligibleOrSo5Rewards(nodes: unknown[]): LineupRewardBreakdown {
  const out = emptyRewardBreakdown();
  if (!Array.isArray(nodes)) return out;

  for (const raw of nodes) {
    const n = raw as any;
    if (!n?.__typename) continue;

    if (n.__typename === "So5Reward") {
      out.isActual = true;
      out.usdCents += n.amount?.usdCents ?? 0;
      out.coinAmount += n.coinAmount ?? 0;

      // Revealed cards — group by rarity
      for (const rc of n.rewardCards ?? []) {
        const rarity = rc.anyCard?.rarityTyped ?? "limited";
        mergeCards(out.cards, rarity, 1, null, [
          {
            cardSlug: rc.anyCard?.slug ?? rc.id ?? "",
            pictureUrl: rc.pictureUrl ?? null,
            quality: rc.quality ?? null,
          },
        ]);
      }

      // Essence lives in rewardConfigs[] for So5Reward
      for (const rc of n.rewardConfigs ?? []) {
        if (rc?.__typename === "CardShardRewardConfig") {
          mergeEssence(out.essence, rc.rarity ?? "limited", rc.quantity ?? 0);
        }
      }
      continue;
    }

    if (n.__typename === "So5RewardConfig") {
      // Projected path — usdAmount is a Float (dollars, not cents)
      if (typeof n.usdAmount === "number") {
        out.usdCents += Math.round(n.usdAmount * 100);
      }
      if (typeof n.coinAmount === "number") {
        out.coinAmount += n.coinAmount;
      }
      for (const sh of n.cardShardRewardConfigs ?? []) {
        mergeEssence(out.essence, sh.rarity ?? "limited", sh.quantity ?? 0);
      }
      for (const c of n.cards ?? []) {
        mergeCards(
          out.cards,
          c.rarity ?? "limited",
          c.quantity ?? 0,
          c.gameplayTier ?? null,
          [],
        );
      }
      continue;
    }
  }

  return out;
}

/**
 * Walks `So5Lineup.completedTasks` and returns a breakdown of rewards
 * the lineup has already earned from task/streak-threshold completions
 * (e.g. a $5 streak threshold payout). These are always final, not projected.
 */
export function parseCompletedTasksRewards(
  tasks: unknown[],
): LineupRewardBreakdown {
  const out = emptyRewardBreakdown();
  if (!Array.isArray(tasks)) return out;
  for (const raw of tasks) {
    const t = raw as any;
    accumulateRewardConfigs(out, t?.rewardConfigs);
  }
  return out;
}

/** Merge b into a in-place. */
export function mergeRewardBreakdowns(
  a: LineupRewardBreakdown,
  b: LineupRewardBreakdown,
): LineupRewardBreakdown {
  a.usdCents += b.usdCents;
  a.coinAmount += b.coinAmount;
  if (b.isActual) a.isActual = true;
  for (const e of b.essence) mergeEssence(a.essence, e.rarity, e.quantity);
  for (const c of b.cards) mergeCards(a.cards, c.rarity, c.quantity, c.gameplayTier, c.revealed);
  return a;
}

export function formatUsdFromCents(cents: number): string {
  if (!cents) return "$0";
  const dollars = cents / 100;
  if (dollars >= 100) return `$${Math.round(dollars)}`;
  return `$${dollars.toFixed(2).replace(/\.00$/, "")}`;
}
