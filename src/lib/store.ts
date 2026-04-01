import { create } from "zustand";
import type { GalleryFilters, Position, RarityType } from "./types";

interface FilterStore {
  filters: GalleryFilters;
  setSearch: (search: string) => void;
  setCardSet: (cardSet: string | null) => void;
  setRarity: (rarity: RarityType | null) => void;
  toggleTournament: (tournament: string) => void;
  togglePosition: (position: Position) => void;
  toggleTier: (tier: number) => void;
  setDuplicatesOnly: (duplicatesOnly: boolean) => void;
  clearAll: () => void;
}

const defaultFilters: GalleryFilters = {
  search: "",
  cardSet: null,
  rarity: null,
  tournaments: [],
  positions: [],
  tiers: [],
  duplicatesOnly: false,
};

export const useFilterStore = create<FilterStore>((set) => ({
  filters: defaultFilters,

  setSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),

  setCardSet: (cardSet) =>
    set((state) => ({
      filters: {
        ...state.filters,
        cardSet: state.filters.cardSet === cardSet ? null : cardSet,
      },
    })),

  setRarity: (rarity) =>
    set((state) => ({
      filters: {
        ...state.filters,
        rarity: state.filters.rarity === rarity ? null : rarity,
      },
    })),

  toggleTournament: (tournament) =>
    set((state) => {
      const current = state.filters.tournaments;
      const next = current.includes(tournament)
        ? current.filter((t) => t !== tournament)
        : [...current, tournament];
      return { filters: { ...state.filters, tournaments: next } };
    }),

  togglePosition: (position) =>
    set((state) => {
      const current = state.filters.positions;
      const next = current.includes(position)
        ? current.filter((p) => p !== position)
        : [...current, position];
      return { filters: { ...state.filters, positions: next } };
    }),

  toggleTier: (tier) =>
    set((state) => {
      const current = state.filters.tiers;
      const next = current.includes(tier)
        ? current.filter((t) => t !== tier)
        : [...current, tier];
      return { filters: { ...state.filters, tiers: next } };
    }),

  setDuplicatesOnly: (duplicatesOnly) =>
    set((state) => ({ filters: { ...state.filters, duplicatesOnly } })),

  clearAll: () => set({ filters: defaultFilters }),
}));
