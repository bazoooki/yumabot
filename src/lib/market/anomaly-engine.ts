import { prisma } from "@/lib/db";
import type { MarketAlert, AlertRuleType, AlertSeverity } from "./types";

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
const COOLDOWN_MS = 20 * 60 * 1000; // 20 min cooldown per rule+player

// Rarity-aware thresholds — commons trade FAR more often than rares
const VOLUME_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  common:       { warning: 15, critical: 25 },
  limited:      { warning: 8,  critical: 15 },
  rare:         { warning: 5,  critical: 8 },
  super_rare:   { warning: 3,  critical: 5 },
  unique:       { warning: 2,  critical: 3 },
  custom_series:{ warning: 8,  critical: 15 },
};

const BUYER_THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  common:       { warning: 5, critical: 8 },
  limited:      { warning: 3, critical: 5 },
  rare:         { warning: 2, critical: 3 },
  super_rare:   { warning: 2, critical: 3 },
  unique:       { warning: 2, critical: 2 },
  custom_series:{ warning: 3, critical: 5 },
};

function getThreshold(map: Record<string, { warning: number; critical: number }>, rarity: string) {
  return map[rarity.toLowerCase()] || map.limited;
}

export async function processOffer(
  offer: OfferInput
): Promise<MarketAlert | null> {
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

export async function cleanupOldOffers() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.marketOffer.deleteMany({ where: { receivedAt: { lt: cutoff } } });
  await prisma.marketAlert.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

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

  // Get price context
  const prices = await prisma.marketOffer.findMany({
    where: { playerSlug: offer.playerSlug, receivedAt: { gte: windowStart } },
    select: { priceEth: true },
    orderBy: { receivedAt: "desc" },
  });
  const validPrices = prices.map((p) => p.priceEth).filter((p) => p > 0);
  const avgPrice = validPrices.length > 0
    ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length).toFixed(4)
    : "?";

  return createAlertIfNotCooling("volume_spike", severity, offer, {
    title: `${offer.playerName} — ${count} sales in 30 min`,
    description: `${count} ${offer.rarity} cards sold. Avg price: ${avgPrice} ETH. Position: ${offer.position || "?"}, Club: ${offer.clubName || "?"}.`,
    metadata: { count, rarity: offer.rarity, avgPrice },
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

async function createAlertIfNotCooling(
  ruleType: AlertRuleType,
  severity: AlertSeverity,
  offer: OfferInput,
  details: { title: string; description: string; metadata: Record<string, unknown> }
): Promise<MarketAlert | null> {
  const cooldownStart = new Date(Date.now() - COOLDOWN_MS);
  const existing = await prisma.marketAlert.count({
    where: { ruleType, playerSlug: offer.playerSlug, createdAt: { gte: cooldownStart } },
  });

  if (existing > 0) return null;

  const alert = await prisma.marketAlert.create({
    data: {
      ruleType,
      severity,
      playerSlug: offer.playerSlug,
      playerName: offer.playerName,
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
