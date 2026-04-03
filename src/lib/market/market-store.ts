import { create } from "zustand";
import type {
  MarketOffer,
  MarketAlert,
  MarketConnectionStatus,
  MarketFilters,
} from "./types";

const MAX_OFFERS = 200;
const MAX_ALERTS = 50;

interface MarketState {
  connectionStatus: MarketConnectionStatus;
  offers: MarketOffer[];
  alerts: MarketAlert[];
  unacknowledgedCount: number;
  filters: MarketFilters;
  soundEnabled: boolean;

  addOffer: (offer: MarketOffer) => void;
  addAlert: (alert: MarketAlert) => void;
  setConnectionStatus: (status: MarketConnectionStatus) => void;
  setFilters: (filters: Partial<MarketFilters>) => void;
  acknowledgeAlert: (id: number) => void;
  toggleSound: () => void;
  clearOffers: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  connectionStatus: "disconnected",
  offers: [],
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

  addOffer: (offer) =>
    set((s) => ({
      offers: [offer, ...s.offers].slice(0, MAX_OFFERS),
    })),

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

  clearOffers: () => set({ offers: [] }),
}));
