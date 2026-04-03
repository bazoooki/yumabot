import { create } from "zustand";
import type {
  MarketOffer,
  MarketAlert,
  MarketConnectionStatus,
  MarketFilters,
} from "./types";

const MAX_PLAYERS = 150;
const MAX_ALERTS = 50;
const MAX_RECENT_OFFERS = 15;

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
  /** Timestamp when this row was first created */
  firstSeen: number;
  /** Timestamp of last update — for "bump" animation */
  updatedAt: number;
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

  addOffer: (offer: MarketOffer) => void;
  addAlert: (alert: MarketAlert) => void;
  setConnectionStatus: (status: MarketConnectionStatus) => void;
  setFilters: (filters: Partial<MarketFilters>) => void;
  acknowledgeAlert: (id: number) => void;
  toggleSound: () => void;
  toggleExpanded: (playerSlug: string) => void;
  clearOffers: () => void;
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
  },
  soundEnabled: false,
  expandedPlayer: null,

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

        const updated: PlayerActivity = {
          ...existing,
          offerIds: newIds,
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

  acknowledgeAlert: (id) => {
    fetch("/api/market/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(console.error);

    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
      unacknowledgedCount: Math.max(0, s.unacknowledgedCount - 1),
    }));
  },

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  toggleExpanded: (playerSlug) =>
    set((s) => ({
      expandedPlayer: s.expandedPlayer === playerSlug ? null : playerSlug,
    })),

  clearOffers: () => set({ players: {}, totalOffers: 0, expandedPlayer: null }),
}));
