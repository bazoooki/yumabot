import { create } from "zustand";
import type { LeaderboardSummary, Achievement } from "./types";

interface ResultsStore {
  gameWeek: number | null;
  fixtureSlug: string | null;
  leaderboards: LeaderboardSummary[];
  achievements: Achievement[];
  availableGameWeeks: number[];
  activeSection: "podiums" | "achievements" | "clan";
  isLoadingFetch: boolean;

  setResults(gw: number, fixture: string, lbs: LeaderboardSummary[]): void;
  setAchievements(a: Achievement[]): void;
  setAvailableGameWeeks(gws: number[]): void;
  setActiveSection(s: ResultsStore["activeSection"]): void;
  setLoadingFetch(loading: boolean): void;
}

export const useResultsStore = create<ResultsStore>((set) => ({
  gameWeek: null,
  fixtureSlug: null,
  leaderboards: [],
  achievements: [],
  availableGameWeeks: [],
  activeSection: "podiums",
  isLoadingFetch: false,

  setResults: (gw, fixture, lbs) =>
    set({ gameWeek: gw, fixtureSlug: fixture, leaderboards: lbs }),
  setAchievements: (a) => set({ achievements: a }),
  setAvailableGameWeeks: (gws) => set({ availableGameWeeks: gws }),
  setActiveSection: (s) => set({ activeSection: s }),
  setLoadingFetch: (loading) => set({ isLoadingFetch: loading }),
}));
