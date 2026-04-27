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
const COOLDOWN_MS = 30 * 60 * 1000;
const LINEUP_WINDOW_MS = 60 * 60 * 1000;
const MAX_PLAYERS_TRACKED = 500;

const TRADEABLE_RARITIES = new Set(["limited", "rare", "super_rare", "unique"]);

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

function getThreshold(map: Record<string, { warning: number; critical: number }>, rarity: string) {
  return map[rarity.toLowerCase()] || map.limited;
}

// ── In-memory stores ──

interface StoredOffer {
  offerId: string;
  rarity: string;
  priceEth: number;
  buyerSlug: string | null;
  sellerSlug: string | null;
  receivedAt: number;
}

interface StoredLifecycle {
  offerId: string;
  status: string;
  priceEth: number;
  sellerSlug: string | null;
  receivedAt: number;
}

interface StoredCardState {
  cardSlug: string;
  inLineup: boolean;
  receivedAt: number;
}

interface CooldownKey {
  ruleType: string;
  playerSlug: string;
  until: number;
}

const offersByPlayer = new Map<string, StoredOffer[]>();
const seenOfferIds = new Set<string>();
const lifecycleByPlayer = new Map<string, StoredLifecycle[]>();
const cardStatesByPlayer = new Map<string, StoredCardState[]>();
const alertCooldowns = new Map<string, number>(); // key: `${ruleType}:${playerSlug}` → until timestamp

let alertIdCounter = 1;

function pushWithEviction<T extends { receivedAt: number }>(
  map: Map<string, T[]>,
  playerSlug: string,
  item: T,
  windowMs: number
) {
  const now = item.receivedAt;
  const cutoff = now - windowMs;
  let bucket = map.get(playerSlug);
  if (!bucket) {
    bucket = [];
    map.set(playerSlug, bucket);
  }
  bucket.push(item);
  // Drop entries older than the window
  while (bucket.length > 0 && bucket[0].receivedAt < cutoff) {
    bucket.shift();
  }
  if (bucket.length === 0) {
    map.delete(playerSlug);
  }
  // LRU cap on tracked players
  if (map.size > MAX_PLAYERS_TRACKED) {
    const firstKey = map.keys().next().value;
    if (firstKey && firstKey !== playerSlug) map.delete(firstKey);
  }
}

function recentInWindow<T extends { receivedAt: number }>(
  map: Map<string, T[]>,
  playerSlug: string,
  windowMs: number
): T[] {
  const bucket = map.get(playerSlug);
  if (!bucket) return [];
  const cutoff = Date.now() - windowMs;
  return bucket.filter((e) => e.receivedAt >= cutoff);
}

export async function processOffer(
  offer: OfferInput
): Promise<MarketAlert | null> {
  if (!TRADEABLE_RARITIES.has(offer.rarity.toLowerCase())) return null;

  // Dedup by offerId
  if (seenOfferIds.has(offer.offerId)) return null;
  seenOfferIds.add(offer.offerId);
  if (seenOfferIds.size > 10000) {
    // Drop oldest ~2000
    const it = seenOfferIds.values();
    for (let i = 0; i < 2000; i++) {
      const v = it.next().value;
      if (v) seenOfferIds.delete(v);
    }
  }

  const now = Date.now();
  pushWithEviction(
    offersByPlayer,
    offer.playerSlug,
    {
      offerId: offer.offerId,
      rarity: offer.rarity,
      priceEth: offer.priceEth,
      buyerSlug: offer.buyerSlug,
      sellerSlug: offer.sellerSlug,
      receivedAt: now,
    },
    WINDOW_MS
  );

  const alerts = [
    checkVolumeSpike(offer),
    checkPriceSpike(offer),
    checkBuyerConcentration(offer),
  ].filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

// --- Rule 1: Volume Spike ---

function checkVolumeSpike(offer: OfferInput): MarketAlert | null {
  const recent = recentInWindow(offersByPlayer, offer.playerSlug, WINDOW_MS);
  const count = recent.length;

  const thresh = getThreshold(VOLUME_THRESHOLDS, offer.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";

  const validPrices = recent.map((p) => p.priceEth).filter((p) => p > 0);
  const avgPrice = validPrices.length > 0
    ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length).toFixed(4)
    : "?";

  const rarityCounts: Record<string, number> = {};
  for (const o of recent) {
    rarityCounts[o.rarity] = (rarityCounts[o.rarity] || 0) + 1;
  }
  const rarityBreakdown = Object.entries(rarityCounts).map(([r, c]) => `${c}x ${r}`).join(", ");

  const sales = recent
    .slice()
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .map((o) => ({
      price: o.priceEth,
      buyer: o.buyerSlug,
      seller: o.sellerSlug,
      time: new Date(o.receivedAt).toISOString(),
    }));

  return createAlertIfNotCooling("volume_spike", severity, offer, {
    title: `${offer.playerName} — ${count} sales in 30 min`,
    description: `${rarityBreakdown}. Avg price: ${avgPrice} ETH. ${offer.clubName || ""}.`,
    metadata: { count, rarity: offer.rarity, avgPrice, rarityBreakdown, sales },
  });
}

// --- Rule 2: Price Spike (median of same rarity) ---

function checkPriceSpike(offer: OfferInput): MarketAlert | null {
  if (offer.priceEth <= 0) return null;

  const bucket = offersByPlayer.get(offer.playerSlug) || [];
  const sameRarity = bucket
    .filter((o) => o.rarity === offer.rarity)
    .slice()
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, 12);

  if (sameRarity.length < 5) return null;

  // Exclude the current offer (most recent entry) from the baseline
  const prices = sameRarity
    .slice(1)
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
  if (ratio <= 2.5) return null;

  const severity: AlertSeverity = ratio > 4 ? "critical" : "warning";

  const sales = sameRarity.map((o) => ({
    price: o.priceEth,
    buyer: o.buyerSlug,
    seller: o.sellerSlug,
    time: new Date(o.receivedAt).toISOString(),
  }));

  return createAlertIfNotCooling("price_spike", severity, offer, {
    title: `${offer.playerName} — price ${ratio.toFixed(1)}x above median`,
    description: `${offer.rarity} card sold for ${offer.priceEth.toFixed(4)} ETH vs median ${median.toFixed(4)} ETH (${ratio.toFixed(1)}x). Buyer: ${offer.buyerSlug || "?"}.`,
    metadata: { median, latestPrice: offer.priceEth, ratio, rarity: offer.rarity, sales },
  });
}

// --- Rule 3: Buyer Concentration ---

function checkBuyerConcentration(offer: OfferInput): MarketAlert | null {
  if (!offer.buyerSlug) return null;

  const recent = recentInWindow(offersByPlayer, offer.playerSlug, WINDOW_MS);
  const purchases = recent.filter((o) => o.buyerSlug === offer.buyerSlug);

  const count = purchases.length;
  const thresh = getThreshold(BUYER_THRESHOLDS, offer.rarity);
  if (count < thresh.warning) return null;

  const severity: AlertSeverity = count >= thresh.critical ? "critical" : "warning";
  const sales = purchases
    .slice()
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .map((o) => ({
      price: o.priceEth,
      buyer: o.buyerSlug,
      seller: o.sellerSlug,
      time: new Date(o.receivedAt).toISOString(),
    }));

  return createAlertIfNotCooling("buyer_concentration", severity, offer, {
    title: `${offer.buyerSlug} accumulating ${offer.playerName}`,
    description: `Bought ${count}x ${offer.rarity} cards in 30 min. Latest price: ${offer.priceEth.toFixed(4)} ETH.`,
    metadata: { buyer: offer.buyerSlug, count, rarity: offer.rarity, sales },
  });
}

// --- Cooldown helper ---

interface PlayerContext {
  playerSlug: string;
  playerName: string;
}

function createAlertIfNotCooling(
  ruleType: AlertRuleType,
  severity: AlertSeverity,
  player: PlayerContext,
  details: { title: string; description: string; metadata: Record<string, unknown> }
): MarketAlert | null {
  const key = `${ruleType}:${player.playerSlug}`;
  const until = alertCooldowns.get(key) || 0;
  const now = Date.now();
  if (until > now) return null;

  alertCooldowns.set(key, now + COOLDOWN_MS);
  // Occasional cleanup
  if (alertCooldowns.size > 2000) {
    for (const [k, u] of alertCooldowns) {
      if (u <= now) alertCooldowns.delete(k);
    }
  }

  return {
    id: alertIdCounter++,
    ruleType,
    severity,
    playerSlug: player.playerSlug,
    playerName: player.playerName,
    title: details.title,
    description: details.description,
    metadata: details.metadata,
    acknowledged: false,
    createdAt: new Date(now).toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// Advanced Analytics: Offer Lifecycle Rules
// ══════════════════════════════════════════════════════

export async function processOfferLifecycle(
  event: OfferLifecycleEvent
): Promise<MarketAlert | null> {
  if (!TRADEABLE_RARITIES.has(event.rarity.toLowerCase())) return null;

  pushWithEviction(
    lifecycleByPlayer,
    event.playerSlug,
    {
      offerId: event.offerId,
      status: event.status,
      priceEth: event.priceEth,
      sellerSlug: event.sellerSlug,
      receivedAt: Date.now(),
    },
    WINDOW_MS
  );

  const alerts = [
    checkPriceDrop(event),
    checkListingSurge(event),
    checkCancellationWave(event),
  ].filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

function checkPriceDrop(event: OfferLifecycleEvent): MarketAlert | null {
  if (event.status !== "price_updated") return null;
  if (!event.previousPriceEth || event.previousPriceEth <= 0 || event.priceEth <= 0) return null;

  const dropRatio = (event.previousPriceEth - event.priceEth) / event.previousPriceEth;
  if (dropRatio < 0.2) return null;

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

function checkListingSurge(event: OfferLifecycleEvent): MarketAlert | null {
  if (event.status !== "created") return null;

  const recent = recentInWindow(lifecycleByPlayer, event.playerSlug, WINDOW_MS);
  const created = recent.filter((e) => e.status === "created");

  const count = created.length;
  const sellers = [...new Set(created.map((r) => r.sellerSlug).filter(Boolean))];

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

function checkCancellationWave(event: OfferLifecycleEvent): MarketAlert | null {
  if (event.status !== "cancelled") return null;

  const recent = recentInWindow(lifecycleByPlayer, event.playerSlug, WINDOW_MS);
  const cancels = recent.filter((e) => e.status === "cancelled");

  const count = cancels.length;
  const sellers = [...new Set(cancels.map((r) => r.sellerSlug).filter(Boolean))];

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

  pushWithEviction(
    cardStatesByPlayer,
    event.playerSlug,
    {
      cardSlug: event.cardSlug,
      inLineup: event.inLineup,
      receivedAt: Date.now(),
    },
    LINEUP_WINDOW_MS
  );

  if (!event.inLineup) return null;

  const alerts = [
    checkLineupLock(event),
    checkLineupCluster(event),
  ].filter((a): a is MarketAlert => a !== null);

  if (alerts.length === 0) return null;

  const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
  return alerts[0];
}

function checkLineupLock(event: CardStateEvent): MarketAlert | null {
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

function checkLineupCluster(event: CardStateEvent): MarketAlert | null {
  const recent = recentInWindow(cardStatesByPlayer, event.playerSlug, LINEUP_WINDOW_MS);
  const count = recent.filter((e) => e.inLineup).length;

  if (count < 3) return null;

  const severity: AlertSeverity = count >= 5 ? "critical" : "warning";

  return createAlertIfNotCooling("lineup_cluster", severity, event, {
    title: `${event.playerName} — ${count} lineup locks in 60 min`,
    description: `Multiple managers locking ${event.rarity} cards. Strong demand signal.`,
    metadata: { count, rarity: event.rarity },
  });
}
