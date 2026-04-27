import { create } from "zustand";
import type {
  MarketOffer,
  MarketAlert,
  MarketConnectionStatus,
  MarketFilters,
  UpcomingGameInfo,
  TradeType,
  CounterCard,
  OfferLifecycleEvent,
  CardStateEvent,
} from "./types";

const MAX_PLAYERS = 150;
const MAX_ALERTS = 50;
const MAX_RECENT_OFFERS = 15;
const MAX_LISTING_PLAYERS = 150;
const MAX_LINEUP_LOCKS = 100;

/** A single offer event kept for the detail view */
export interface OfferEvent {
  offerId: string;
  priceEth: number;
  rarity: string;
  buyerSlug: string | null;
  sellerSlug: string | null;
  offerStatus: string | null;
  offerType: string | null;
  receivedAt: string;
  tradeType: TradeType;
  cardGrade: number | null;
  cardPower: string | null;
  cardSeason: number | null;
  cardSerial: number | null;
  counterCards: CounterCard[] | null;
  avgScore: number | null;
  upcomingGame: UpcomingGameInfo | null;
}

/** Aggregated row per player — updates in-place instead of adding new lines */
export interface PlayerActivity {
  playerSlug: string;
  playerName: string;
  position: string | null;
  clubName: string | null;
  /** Unique offer IDs to prevent double-counting */
  offerIds: Set<string>;
  /** Unique offer count */
  offerCount: number;
  /** Accepted sales count */
  saleCount: number;
  /** Most recent price (ETH) */
  latestPriceEth: number;
  /** All prices this session for trend */
  prices: number[];
  /** Dominant rarity seen */
  rarity: string;
  /** Last offer timestamp */
  lastSeen: string;
  /** Last offer status (accepted, opened, etc.) */
  lastStatus: string | null;
  /** Recent individual offers for expandable detail */
  recentOffers: OfferEvent[];
  /** Upcoming game if available */
  upcomingGame: UpcomingGameInfo | null;
  /** Timestamp when this row was first created */
  firstSeen: number;
  /** Trade types seen (sale, swap, mixed) */
  tradeTypes: Set<TradeType>;
  /** Player average score (L15) */
  avgScore: number | null;
  /** Timestamp of last update — for "bump" animation */
  updatedAt: number;
}

/** Aggregated listing activity per player (advanced analytics) */
export interface ListingActivity {
  playerSlug: string;
  playerName: string;
  /** Offer IDs we've already counted (dedup) */
  seenOfferIds: Set<string>;
  activeListings: number;
  newListings30m: number;
  cancellations30m: number;
  priceDrops30m: number;
  lowestAsk: number;
  /** Unique sellers who listed this player */
  uniqueListers: Set<string>;
  /** Unique sellers who cancelled this player */
  uniqueCancellers: Set<string>;
  recentEvents: OfferLifecycleEvent[];
  updatedAt: number;
}

/** A lineup lock event (advanced analytics) */
export interface LineupLockEvent {
  cardSlug: string;
  playerSlug: string;
  playerName: string;
  rarity: string;
  lineupDetails: { competitionName: string; gameDate: string } | null;
  receivedAt: string;
}

interface MarketState {
  connectionStatus: MarketConnectionStatus;
  players: Record<string, PlayerActivity>;
  totalOffers: number;
  alerts: MarketAlert[];
  unacknowledgedCount: number;
  filters: MarketFilters;
  soundEnabled: boolean;
  /** Currently expanded player slug */
  expandedPlayer: string | null;

  /** Advanced analytics toggle */
  advancedAnalytics: boolean;
  /** Offer lifecycle tracking per player (for anomaly engine) */
  listingActivity: Record<string, ListingActivity>;
  /** Recent lineup lock events */
  lineupLocks: LineupLockEvent[];

  addOffer: (offer: MarketOffer) => void;
  addAlert: (alert: MarketAlert) => void;
  setConnectionStatus: (status: MarketConnectionStatus) => void;
  setFilters: (filters: Partial<MarketFilters>) => void;
  acknowledgeAlert: (id: number) => void;
  toggleSound: () => void;
  toggleExpanded: (playerSlug: string) => void;
  clearOffers: () => void;
  clearAlerts: () => void;
  toggleAdvancedAnalytics: () => void;
  addOfferLifecycleEvent: (event: OfferLifecycleEvent) => void;
  addCardStateEvent: (event: CardStateEvent) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  connectionStatus: "disconnected",
  players: {},
  totalOffers: 0,
  alerts: [],
  unacknowledgedCount: 0,
  filters: {
    rarity: null,
    position: null,
    minPriceEth: null,
    maxPriceEth: null,
    playerSearch: "",
    myPlayersOnly: false,
    sort: "recent",
    tradeType: null,
    minSales: 1,
  },
  soundEnabled: false,
  expandedPlayer: null,
  advancedAnalytics: false,
  listingActivity: {},
  lineupLocks: [],

  addOffer: (offer) =>
    set((s) => {
      const existing = s.players[offer.playerSlug];
      const now = Date.now();
      // All offers reaching the store are accepted sales (filtered server-side)
      const isSale = true;

      const event: OfferEvent = {
        offerId: offer.offerId,
        priceEth: offer.priceEth,
        rarity: offer.rarity,
        buyerSlug: offer.buyerSlug,
        sellerSlug: offer.sellerSlug,
        offerStatus: offer.offerStatus,
        offerType: offer.offerType,
        receivedAt: offer.receivedAt,
        tradeType: offer.tradeType,
        cardGrade: offer.cardGrade,
        cardPower: offer.cardPower,
        cardSeason: offer.cardSeason,
        cardSerial: offer.cardSerial,
        counterCards: offer.counterCards,
        avgScore: offer.avgScore,
        upcomingGame: offer.upcomingGame,
      };

      if (existing) {
        // Check if this exact offerId was already counted
        const isNewOffer = !existing.offerIds.has(offer.offerId);
        const newIds = new Set(existing.offerIds);
        newIds.add(offer.offerId);

        // Deduplicate recentOffers by offerId+status
        const eventKey = `${offer.offerId}:${offer.offerStatus}`;
        const alreadyInRecent = existing.recentOffers.some(
          (e) => `${e.offerId}:${e.offerStatus}` === eventKey
        );

        const newTradeTypes = new Set(existing.tradeTypes);
        newTradeTypes.add(offer.tradeType);

        const updated: PlayerActivity = {
          ...existing,
          offerIds: newIds,
          tradeTypes: newTradeTypes,
          offerCount: isNewOffer ? existing.offerCount + 1 : existing.offerCount,
          saleCount: existing.saleCount + (isSale && isNewOffer ? 1 : 0),
          latestPriceEth: offer.priceEth > 0 ? offer.priceEth : existing.latestPriceEth,
          prices:
            offer.priceEth > 0 && isNewOffer
              ? [...existing.prices, offer.priceEth].slice(-20)
              : existing.prices,
          rarity: offer.rarity || existing.rarity,
          lastSeen: offer.receivedAt,
          lastStatus: offer.offerStatus,
          recentOffers: alreadyInRecent
            ? existing.recentOffers
            : [event, ...existing.recentOffers].slice(0, MAX_RECENT_OFFERS),
          upcomingGame: offer.upcomingGame ?? existing.upcomingGame,
          avgScore: offer.avgScore ?? existing.avgScore,
          updatedAt: now,
        };

        return {
          players: { ...s.players, [offer.playerSlug]: updated },
          totalOffers: s.totalOffers + (isNewOffer ? 1 : 0),
        };
      }

      // New player
      const created: PlayerActivity = {
        playerSlug: offer.playerSlug,
        playerName: offer.playerName,
        position: offer.position,
        clubName: offer.clubName,
        offerIds: new Set([offer.offerId]),
        offerCount: 1,
        saleCount: isSale ? 1 : 0,
        latestPriceEth: offer.priceEth,
        prices: offer.priceEth > 0 ? [offer.priceEth] : [],
        rarity: offer.rarity || "unknown",
        lastSeen: offer.receivedAt,
        lastStatus: offer.offerStatus,
        recentOffers: [event],
        upcomingGame: offer.upcomingGame ?? null,
        tradeTypes: new Set<TradeType>([offer.tradeType]),
        avgScore: offer.avgScore ?? null,
        firstSeen: now,
        updatedAt: now,
      };

      const newPlayers = { ...s.players, [offer.playerSlug]: created };

      // Evict least-recently-updated if over limit
      const keys = Object.keys(newPlayers);
      if (keys.length > MAX_PLAYERS) {
        const sorted = keys.sort(
          (a, b) => newPlayers[a].updatedAt - newPlayers[b].updatedAt
        );
        for (let i = 0; i < keys.length - MAX_PLAYERS; i++) {
          delete newPlayers[sorted[i]];
        }
      }

      return { players: newPlayers, totalOffers: s.totalOffers + 1 };
    }),

  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, MAX_ALERTS),
      unacknowledgedCount: s.unacknowledgedCount + 1,
    })),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
      unacknowledgedCount: Math.max(0, s.unacknowledgedCount - 1),
    })),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  toggleExpanded: (playerSlug) =>
    set((s) => ({
      expandedPlayer: s.expandedPlayer === playerSlug ? null : playerSlug,
    })),

  clearOffers: () =>
    set({ players: {}, totalOffers: 0, expandedPlayer: null, listingActivity: {}, lineupLocks: [] }),

  clearAlerts: () =>
    set({ alerts: [], unacknowledgedCount: 0 }),

  toggleAdvancedAnalytics: () =>
    set((s) => ({ advancedAnalytics: !s.advancedAnalytics })),

  addOfferLifecycleEvent: (event) =>
    set((s) => {
      const existing = s.listingActivity[event.playerSlug];
      const now = Date.now();
      const dedupeKey = `${event.offerId}:${event.status}`;

      if (existing) {
        // Deduplicate: skip if we've seen this exact offer+status
        if (existing.seenOfferIds.has(dedupeKey)) return s;

        const newSeen = new Set(existing.seenOfferIds);
        newSeen.add(dedupeKey);
        if (newSeen.size > 500) {
          const arr = [...newSeen];
          for (let i = 0; i < 100; i++) newSeen.delete(arr[i]);
        }

        // Track unique sellers
        const newListers = new Set(existing.uniqueListers);
        const newCancellers = new Set(existing.uniqueCancellers);
        const seller = event.sellerSlug || "unknown";
        if (event.status === "created") newListers.add(seller);
        if (event.status === "cancelled") newCancellers.add(seller);

        const updated: ListingActivity = {
          ...existing,
          seenOfferIds: newSeen,
          updatedAt: now,
          uniqueListers: newListers,
          uniqueCancellers: newCancellers,
          activeListings:
            event.status === "created"
              ? existing.activeListings + 1
              : event.status === "cancelled" || event.status === "accepted" || event.status === "expired"
                ? Math.max(0, existing.activeListings - 1)
                : existing.activeListings,
          newListings30m:
            event.status === "created" ? existing.newListings30m + 1 : existing.newListings30m,
          cancellations30m:
            event.status === "cancelled" ? existing.cancellations30m + 1 : existing.cancellations30m,
          priceDrops30m:
            event.status === "price_updated" ? existing.priceDrops30m + 1 : existing.priceDrops30m,
          lowestAsk:
            event.priceEth > 0 && (existing.lowestAsk === 0 || event.priceEth < existing.lowestAsk)
              ? event.priceEth
              : existing.lowestAsk,
          recentEvents: existing.recentEvents,
        };

        return {
          listingActivity: { ...s.listingActivity, [event.playerSlug]: updated },
        };
      }

      const seller = event.sellerSlug || "unknown";
      const created: ListingActivity = {
        playerSlug: event.playerSlug,
        playerName: event.playerName,
        seenOfferIds: new Set([dedupeKey]),
        activeListings: event.status === "created" ? 1 : 0,
        newListings30m: event.status === "created" ? 1 : 0,
        cancellations30m: event.status === "cancelled" ? 1 : 0,
        priceDrops30m: event.status === "price_updated" ? 1 : 0,
        lowestAsk: event.priceEth > 0 ? event.priceEth : 0,
        uniqueListers: event.status === "created" ? new Set([seller]) : new Set(),
        uniqueCancellers: event.status === "cancelled" ? new Set([seller]) : new Set(),
        recentEvents: [],
        updatedAt: now,
      };

      const activity = { ...s.listingActivity, [event.playerSlug]: created };

      // LRU eviction
      const keys = Object.keys(activity);
      if (keys.length > MAX_LISTING_PLAYERS) {
        const sorted = keys.sort((a, b) => activity[a].updatedAt - activity[b].updatedAt);
        for (let i = 0; i < keys.length - MAX_LISTING_PLAYERS; i++) {
          delete activity[sorted[i]];
        }
      }

      // First event for a new player — never qualifies for feed yet
      return { listingActivity: activity };
    }),

  addCardStateEvent: (event) =>
    set((s) => {
      if (!event.inLineup) return s;

      const lock: LineupLockEvent = {
        cardSlug: event.cardSlug,
        playerSlug: event.playerSlug,
        playerName: event.playerName,
        rarity: event.rarity,
        lineupDetails: event.lineupDetails,
        receivedAt: event.receivedAt,
      };

      return {
        lineupLocks: [lock, ...s.lineupLocks].slice(0, MAX_LINEUP_LOCKS),
      };
    }),
}));
