import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LineupCount = 1 | 2 | 3;
export type TargetLevelOffset = 0 | 1 | 2;

export interface AiSuggestionsSettings {
  /** 0 = shoot for current level, 1 = bump to next threshold, 2 = bump +2 levels */
  targetLevelOffset: TargetLevelOffset;
  /** How many lineup variants to render per competition row. */
  lineupCount: LineupCount;
  /** Drop cards with starterProbability < 30 before generation. */
  excludeDoubtful: boolean;
  /** If true, render a Claude rationale next to each suggested lineup. (v2) */
  showClaudeTake: boolean;
}

interface AiSuggestionsStore extends AiSuggestionsSettings {
  setTargetLevelOffset: (v: TargetLevelOffset) => void;
  setLineupCount: (v: LineupCount) => void;
  setExcludeDoubtful: (v: boolean) => void;
  setShowClaudeTake: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: AiSuggestionsSettings = {
  targetLevelOffset: 0,
  lineupCount: 3,
  excludeDoubtful: false,
  showClaudeTake: false,
};

export const useAiSuggestionsStore = create<AiSuggestionsStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTargetLevelOffset: (targetLevelOffset) => set({ targetLevelOffset }),
      setLineupCount: (lineupCount) => set({ lineupCount }),
      setExcludeDoubtful: (excludeDoubtful) => set({ excludeDoubtful }),
      setShowClaudeTake: (showClaudeTake) => set({ showClaudeTake }),
      reset: () => set(DEFAULTS),
    }),
    { name: "ai-suggestions-settings" },
  ),
);
