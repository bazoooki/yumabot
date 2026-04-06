import { prisma } from "@/lib/db";
import type {
  MarketAlert,
  AlertRuleType,
  AlertSeverity,
  OfferLifecycleEvent,
  CardStateEvent,
} from "./types";

interface OfferInput {
  offerId: string;
  playerSlug: string;
  playerName: string;
  position: string | null;
  rarity: string;
  priceWei: string;
  priceEth: number;
  buyerSlug: string | null;
  sellerSlug: string | null;
  clubName: string | null;
  cardSlug: string | null;
  offerType: string | null;
  offerStatus: string | null;
  dealStatus: string | null;
}

const WINDOW_MS = 30 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown per rule+player

const TRADEABLE_RARITIES = new Set(["limited", "rare", "super_rare", "unique"]);

// Player movement thresholds (used for volume_spike + listing_surge)
const VOLUME_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  limited:      { warning: 6,  critical: 10 },
  rare:         { warning: 3,  critical: 5 },
  super_rare:   { warning: 2,  critical: 3 },
  unique:       { warning: 1,  critical: 2 },
};

const BUYER_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  limited:      { warning: 4, critical: 6 },
  rare:         { warning: 3, critical: 4 },
  super_rare:   { warning: 2, critical: 3 },
  unique:       { warning: 2, critical: 2 },
};

const CANCELLATION_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  limited:      { warning: 5, critical: 8 },
  rare:         { warning: 3, critical: 5 },
  super_rare:   { warning: 2, critical: 3 },
  unique:       { warning: 2, critical: 2 },
};

const LINEUP_WINDOW_MS = 60 * 60 * 1000; // 60 min window for lineup cluster

function getThreshold(map: Record<string, { warning: number; critical: number }>, rarity: string) {
  return map[rarity.toLowerCase()] || map.limited;
}

export async function processOffer(
  offer: OfferInput
): Promise<MarketAlert | null> {
  // Skip non-tradeable rarities
  if (!TRADEABLE_RARITIES.has(offer.rarity.toLowerCase())) return null;

  // Persist
  try {
    await prisma.marketOffer.create({
      data: {
        offerId: offer.offerId,
        playerSlug: offer.playerSlug,
        playerName: offer.playerName,
        position: offer.position,
        rarity: offer.rarity,
        priceWei: offer.priceWei,
        priceEth: offer.priceEth,
        buyerSlug: offer.buyerSlug,
        sellerSlug: offer.sellerSlug,
        clubName: offer.clubName,
        cardSlug: offer.cardSlug,
        offerType: offer.offerType,
        offerStatus: offer.offerStatus,
        dealStatus: offer.dealStatus,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) return null;
    throw err;
  }

  const windowStart = new Date(Date.now() - WINDOW_MS);

  // Run rules — return highest severity alert
  const alerts = (
    await Promise.all([
      checkVolumeSpike(offer, windowStart),
      checkPriceSpike(offer),
      checkBuyerConcentration(offer, windowStart),
    ])
  ).filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  // Return the most severe
  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

export async function cleanupOldData() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await Promise.all([
    prisma.marketOffer.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
    prisma.marketAlert.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.offerLifecycleEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
    prisma.cardStateEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
  ]);
}

/** @deprecated Use cleanupOldData instead */
export const cleanupOldOffers = cleanupOldData;

// --- Rule 1: Volume Spike (rarity-aware) ---

async function checkVolumeSpike(
  offer: OfferInput,
  windowStart: Date
): Promise<MarketAlert | null> {
  const count = await prisma.marketOffer.count({
    where: { playerSlug: offer.playerSlug, receivedAt: { gte: windowStart } },
  });

  const thresh = getThreshold(VOLUME_THRESHOLDS, offer.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";

  // Get price + rarity + buyer/seller context
  const recentOffers = await prisma.marketOffer.findMany({
    where: { playerSlug: offer.playerSlug, receivedAt: { gte: windowStart } },
    select: { priceEth: true, rarity: true, buyerSlug: true, sellerSlug: true, receivedAt: true },
    orderBy: { receivedAt: "desc" },
  });
  const validPrices = recentOffers.map((p) => p.priceEth).filter((p) => p > 0);
  const avgPrice = validPrices.length > 0
    ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length).toFixed(4)
    : "?";

  // Rarity breakdown
  const rarityCounts: Record<string, number> = {};
  for (const o of recentOffers) {
    rarityCounts[o.rarity] = (rarityCounts[o.rarity] || 0) + 1;
  }
  const rarityBreakdown = Object.entries(rarityCounts).map(([r, c]) => `${c}x ${r}`).join(", ");

  const sales = recentOffers.map((o) => ({
    price: o.priceEth,
    buyer: o.buyerSlug,
    seller: o.sellerSlug,
    time: o.receivedAt.toISOString(),
  }));

  return createAlertIfNotCooling("volume_spike", severity, offer, {
    title: `${offer.playerName} — ${count} sales in 30 min`,
    description: `${rarityBreakdown}. Avg price: ${avgPrice} ETH. ${offer.clubName || ""}.`,
    metadata: { count, rarity: offer.rarity, avgPrice, rarityBreakdown, sales },
  });
}

// --- Rule 2: Price Spike (median-based, same rarity) ---

async function checkPriceSpike(
  offer: OfferInput
): Promise<MarketAlert | null> {
  if (offer.priceEth <= 0) return null;

  // Compare within same rarity for fairness
  const recentOffers = await prisma.marketOffer.findMany({
    where: { playerSlug: offer.playerSlug, rarity: offer.rarity },
    orderBy: { receivedAt: "desc" },
    take: 12,
    select: { priceEth: true },
  });

  // Need 5+ prior sales to have meaningful baseline
  if (recentOffers.length < 5) return null;

  const prices = recentOffers
    .slice(1) // exclude current
    .map((o) => o.priceEth)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (prices.length < 4) return null;

  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];

  if (median <= 0) return null;

  const ratio = offer.priceEth / median;
  if (ratio <= 2.5) return null; // higher threshold — 2.5x median is the floor

  const severity: AlertSeverity = ratio > 4 ? "critical" : "warning";

  return createAlertIfNotCooling("price_spike", severity, offer, {
    title: `${offer.playerName} — price ${ratio.toFixed(1)}x above median`,
    description: `${offer.rarity} card sold for ${offer.priceEth.toFixed(4)} ETH vs median ${median.toFixed(4)} ETH (${ratio.toFixed(1)}x). Buyer: ${offer.buyerSlug || "?"}.`,
    metadata: { median, latestPrice: offer.priceEth, ratio, rarity: offer.rarity },
  });
}

// --- Rule 3: Buyer Accumulation (rarity-aware) ---

async function checkBuyerConcentration(
  offer: OfferInput,
  windowStart: Date
): Promise<MarketAlert | null> {
  if (!offer.buyerSlug) return null;

  const count = await prisma.marketOffer.count({
    where: {
      buyerSlug: offer.buyerSlug,
      playerSlug: offer.playerSlug,
      receivedAt: { gte: windowStart },
    },
  });

  const thresh = getThreshold(BUYER_THRESHOLDS, offer.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";

  return createAlertIfNotCooling("buyer_concentration", severity, offer, {
    title: `${offer.buyerSlug} accumulating ${offer.playerName}`,
    description: `Bought ${count}x ${offer.rarity} cards in 30 min. Latest price: ${offer.priceEth.toFixed(4)} ETH.`,
    metadata: { buyer: offer.buyerSlug, count, rarity: offer.rarity },
  });
}

// --- Cooldown helper ---

interface PlayerContext {
  playerSlug: string;
  playerName: string;
}

async function createAlertIfNotCooling(
  ruleType: AlertRuleType,
  severity: AlertSeverity,
  player: PlayerContext,
  details: { title: string; description: string; metadata: Record<string, unknown> }
): Promise<MarketAlert | null> {
  const cooldownStart = new Date(Date.now() - COOLDOWN_MS);
  const existing = await prisma.marketAlert.count({
    where: { ruleType, playerSlug: player.playerSlug, createdAt: { gte: cooldownStart } },
  });

  if (existing > 0) return null;

  const alert = await prisma.marketAlert.create({
    data: {
      ruleType,
      severity,
      playerSlug: player.playerSlug,
      playerName: player.playerName,
      title: details.title,
      description: details.description,
      metadata: JSON.stringify(details.metadata),
    },
  });

  return {
    id: alert.id,
    ruleType: alert.ruleType as AlertRuleType,
    severity: alert.severity as AlertSeverity,
    playerSlug: alert.playerSlug,
    playerName: alert.playerName,
    title: alert.title,
    description: alert.description,
    metadata: details.metadata,
    acknowledged: alert.acknowledged,
    createdAt: alert.createdAt.toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// Advanced Analytics: Offer Lifecycle Rules
// ══════════════════════════════════════════════════════

export async function processOfferLifecycle(
  event: OfferLifecycleEvent
): Promise<MarketAlert | null> {
  if (!TRADEABLE_RARITIES.has(event.rarity.toLowerCase())) return null;

  // Persist
  try {
    await prisma.offerLifecycleEvent.create({
      data: {
        offerId: event.offerId,
        playerSlug: event.playerSlug,
        playerName: event.playerName,
        status: event.status,
        priceEth: event.priceEth,
        previousPriceEth: event.previousPriceEth,
        sellerSlug: event.sellerSlug,
        cardSlug: event.cardSlug,
      },
    });
  } catch {
    // ignore duplicate inserts
  }

  const windowStart = new Date(Date.now() - WINDOW_MS);

  const alerts = (
    await Promise.all([
      checkPriceDrop(event),
      checkListingSurge(event, windowStart),
      checkCancellationWave(event, windowStart),
    ])
  ).filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

// --- Rule: Price Drop ---

async function checkPriceDrop(
  event: OfferLifecycleEvent
): Promise<MarketAlert | null> {
  if (event.status !== "price_updated") return null;
  if (!event.previousPriceEth || event.previousPriceEth <= 0 || event.priceEth <= 0) return null;

  const dropRatio = (event.previousPriceEth - event.priceEth) / event.previousPriceEth;
  if (dropRatio < 0.2) return null; // need at least 20% drop

  const severity: AlertSeverity = dropRatio >= 0.4 ? "critical" : "warning";
  const dropPct = (dropRatio * 100).toFixed(0);

  return createAlertIfNotCooling("price_drop", severity, event, {
    title: `${event.playerName} — ${dropPct}% price drop`,
    description: `${event.rarity} listing dropped from ${event.previousPriceEth.toFixed(4)} to ${event.priceEth.toFixed(4)} ETH. Seller: ${event.sellerSlug || "?"}.`,
    metadata: {
      previousPrice: event.previousPriceEth,
      newPrice: event.priceEth,
      dropPct: parseFloat(dropPct),
      rarity: event.rarity,
      seller: event.sellerSlug,
    },
  });
}

// --- Rule: Listing Surge ---

async function checkListingSurge(
  event: OfferLifecycleEvent,
  windowStart: Date
): Promise<MarketAlert | null> {
  if (event.status !== "created") return null;

  const recentListings = await prisma.offerLifecycleEvent.findMany({
    where: {
      playerSlug: event.playerSlug,
      status: "created",
      receivedAt: { gte: windowStart },
    },
    select: { sellerSlug: true },
  });

  const count = recentListings.length;
  const sellers = [...new Set(recentListings.map((r) => r.sellerSlug).filter(Boolean))];

  // Require multiple unique sellers — limited needs 3+, others need 2+
  const minSellers = event.rarity.toLowerCase() === "limited" ? 3 : 2;
  if (sellers.length < minSellers) return null;

  const thresh = getThreshold(VOLUME_THRESHOLDS, event.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";

  return createAlertIfNotCooling("listing_surge", severity, event, {
    title: `${event.playerName} — ${count} new listings in 30 min (${sellers.length} sellers)`,
    description: `${event.rarity} cards being listed by multiple people. Possible sell-off signal.`,
    metadata: { count, rarity: event.rarity, sellers },
  });
}

// --- Rule: Cancellation Wave ---

async function checkCancellationWave(
  event: OfferLifecycleEvent,
  windowStart: Date
): Promise<MarketAlert | null> {
  if (event.status !== "cancelled") return null;

  const recentCancels = await prisma.offerLifecycleEvent.findMany({
    where: {
      playerSlug: event.playerSlug,
      status: "cancelled",
      receivedAt: { gte: windowStart },
    },
    select: { sellerSlug: true },
  });

  const count = recentCancels.length;
  const sellers = [...new Set(recentCancels.map((r) => r.sellerSlug).filter(Boolean))];

  // Require multiple unique sellers — limited needs 3+, others need 2+
  const minSellers = event.rarity.toLowerCase() === "limited" ? 3 : 2;
  if (sellers.length < minSellers) return null;

  const thresh = getThreshold(CANCELLATION_THRESHOLDS, event.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";

  return createAlertIfNotCooling("cancellation_wave", severity, event, {
    title: `${event.playerName} — ${count} listings cancelled in 30 min (${sellers.length} sellers)`,
    description: `${event.rarity} listings being pulled by multiple people. Could signal incoming news.`,
    metadata: { count, rarity: event.rarity, sellers },
  });
}

// ══════════════════════════════════════════════════════
// Advanced Analytics: Card State (Lineup Lock) Rules
// ══════════════════════════════════════════════════════

export async function processCardState(
  event: CardStateEvent
): Promise<MarketAlert | null> {
  if (!TRADEABLE_RARITIES.has(event.rarity.toLowerCase())) return null;

  // Persist
  try {
    await prisma.cardStateEvent.create({
      data: {
        cardSlug: event.cardSlug,
        playerSlug: event.playerSlug,
        playerName: event.playerName,
        rarity: event.rarity,
        onSale: event.onSale,
        inLineup: event.inLineup,
        ownerSlug: event.ownerSlug,
        lineupDetails: event.lineupDetails ? JSON.stringify(event.lineupDetails) : null,
      },
    });
  } catch {
    // ignore
  }

  if (!event.inLineup) return null;

  const alerts = (
    await Promise.all([
      checkLineupLock(event),
      checkLineupCluster(event),
    ])
  ).filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

// --- Rule: Lineup Lock (single event) ---

async function checkLineupLock(
  event: CardStateEvent
): Promise<MarketAlert | null> {
  const competition = event.lineupDetails?.competitionName || "SO5";
  const gameDate = event.lineupDetails?.gameDate || "";

  return createAlertIfNotCooling("lineup_lock", "info", event, {
    title: `${event.playerName} — card locked into lineup`,
    description: `${event.rarity} card locked for ${competition}${gameDate ? ` (${gameDate})` : ""}. Supply reduced.`,
    metadata: {
      cardSlug: event.cardSlug,
      rarity: event.rarity,
      competition,
      gameDate,
    },
  });
}

// --- Rule: Lineup Cluster (multiple managers locking same player) ---

async function checkLineupCluster(
  event: CardStateEvent
): Promise<MarketAlert | null> {
  const windowStart = new Date(Date.now() - LINEUP_WINDOW_MS);

  const count = await prisma.cardStateEvent.count({
    where: {
      playerSlug: event.playerSlug,
      inLineup: true,
      receivedAt: { gte: windowStart },
    },
  });

  if (count < 3) return null;

  const severity: AlertSeverity = count >= 5 ? "critical" : "warning";

  return createAlertIfNotCooling("lineup_cluster", severity, event, {
    title: `${event.playerName} — ${count} lineup locks in 60 min`,
    description: `Multiple managers locking ${event.rarity} cards. Strong demand signal.`,
    metadata: { count, rarity: event.rarity },
  });
}
