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
}

const WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const BURST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function processOffer(
  offer: OfferInput
): Promise<MarketAlert | null> {
  // 1. Persist the offer
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
      },
    });
  } catch (err: unknown) {
    // Duplicate offerId — skip
    if (err instanceof Error && err.message.includes("Unique constraint")) return null;
    throw err;
  }

  // 2. Run detection rules, return first triggered alert
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const alerts = await Promise.all([
    checkVolumeSpike(offer, windowStart),
    checkPriceSpike(offer),
    checkBuyerConcentration(offer, windowStart),
    checkVelocity(offer),
  ]);

  return alerts.find((a) => a !== null) ?? null;
}

// Cleanup old data (called on connection start)
export async function cleanupOldOffers() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.marketOffer.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });
  await prisma.marketAlert.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}

// --- Detection Rules (player-centric, all rarities aggregated) ---

async function checkVolumeSpike(
  offer: OfferInput,
  windowStart: Date
): Promise<MarketAlert | null> {
  const count = await prisma.marketOffer.count({
    where: {
      playerSlug: offer.playerSlug,
      receivedAt: { gte: windowStart },
    },
  });

  if (count <= 4) return null;

  const severity: AlertSeverity = count > 8 ? "critical" : "warning";

  return createAlertIfNotCooling("volume_spike", severity, offer, {
    title: `${offer.playerName} — ${count} sales in 30 min`,
    description: `${count} accepted offers detected for ${offer.playerName} (${offer.position || "?"}) in the last 30 minutes.`,
    metadata: { count, window: "30min" },
  });
}

async function checkPriceSpike(
  offer: OfferInput
): Promise<MarketAlert | null> {
  // Get recent offers for this player (all rarities)
  const recentOffers = await prisma.marketOffer.findMany({
    where: { playerSlug: offer.playerSlug },
    orderBy: { receivedAt: "desc" },
    take: 10,
    select: { priceEth: true },
  });

  // Need at least 4 prior data points
  if (recentOffers.length < 4) return null;

  // Compute median (excluding the current offer which is already in the list)
  const prices = recentOffers
    .slice(1) // skip the just-inserted offer
    .map((o) => o.priceEth)
    .sort((a, b) => a - b);

  if (prices.length < 3) return null;

  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];

  if (median <= 0) return null;

  const ratio = offer.priceEth / median;

  if (ratio <= 2) return null;

  const severity: AlertSeverity = ratio > 3 ? "critical" : "warning";
  const medianStr = median.toFixed(4);
  const priceStr = offer.priceEth.toFixed(4);

  return createAlertIfNotCooling("price_spike", severity, offer, {
    title: `${offer.playerName} — price spike ${ratio.toFixed(1)}x`,
    description: `Price jumped from median ${medianStr} ETH to ${priceStr} ETH (${ratio.toFixed(1)}x).`,
    metadata: { median, latestPrice: offer.priceEth, ratio },
  });
}

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

  if (count <= 2) return null;

  const severity: AlertSeverity = count > 3 ? "critical" : "warning";

  return createAlertIfNotCooling("buyer_concentration", severity, offer, {
    title: `${offer.buyerSlug} bought ${count}x ${offer.playerName}`,
    description: `Same buyer purchased ${count} cards of ${offer.playerName} in 30 minutes.`,
    metadata: { buyer: offer.buyerSlug, count },
  });
}

async function checkVelocity(
  offer: OfferInput
): Promise<MarketAlert | null> {
  const burstStart = new Date(Date.now() - BURST_WINDOW_MS);

  const count = await prisma.marketOffer.count({
    where: {
      playerSlug: offer.playerSlug,
      receivedAt: { gte: burstStart },
    },
  });

  if (count < 3) return null;

  return createAlertIfNotCooling("velocity", "info", offer, {
    title: `${offer.playerName} — ${count} sales in 5 min`,
    description: `Burst activity: ${count} offers in the last 5 minutes.`,
    metadata: { count, window: "5min" },
  });
}

// --- Helpers ---

async function createAlertIfNotCooling(
  ruleType: AlertRuleType,
  severity: AlertSeverity,
  offer: OfferInput,
  details: { title: string; description: string; metadata: Record<string, unknown> }
): Promise<MarketAlert | null> {
  // Check cooldown
  const cooldownStart = new Date(Date.now() - COOLDOWN_MS);
  const existing = await prisma.marketAlert.count({
    where: {
      ruleType,
      playerSlug: offer.playerSlug,
      createdAt: { gte: cooldownStart },
    },
  });

  if (existing > 0) return null;

  // Create alert
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
