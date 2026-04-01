import { create } from "zustand";
import type { SorareCard, LineupSlot, LineupPosition } from "./types";
import { recommendLineup } from "./ai-lineup";

const DEFAULT_SLOTS: LineupSlot[] = [
  { position: "GK", card: null },
  { position: "DEF", card: null },
  { position: "MID", card: null },
  { position: "FWD", card: null },
  { position: "EX", card: null },
];

export const STREAK_LEVELS = [
  { level: 1, threshold: 280, reward: "$2" },
  { level: 2, threshold: 320, reward: "$6" },
  { level: 3, threshold: 360, reward: "$15" },
  { level: 4, threshold: 400, reward: "$50" },
  { level: 5, threshold: 440, reward: "$200" },
  { level: 6, threshold: 480, reward: "$1,000" },
] as const;

interface LineupStore {
  slots: LineupSlot[];
  targetScore: number;
  currentLevel: number;
  selectedSlotIndex: number | null;
  setTargetScore: (score: number) => void;
  setCurrentLevel: (level: number) => void;
  selectSlot: (index: number | null) => void;
  addCard: (slotIndex: number, card: SorareCard) => void;
  removeCard: (slotIndex: number) => void;
  clearLineup: () => void;
  autoFill: (cards: SorareCard[]) => void;
  addCardToNextEmpty: (card: SorareCard) => void;
}

function positionMatchesSlot(
  playerPosition: string | undefined,
  slotPosition: LineupPosition
): boolean {
  if (slotPosition === "EX") return true;
  const map: Record<string, LineupPosition> = {
    Goalkeeper: "GK",
    Defender: "DEF",
    Midfielder: "MID",
    Forward: "FWD",
  };
  return map[playerPosition || ""] === slotPosition;
}

export const useLineupStore = create<LineupStore>((set, get) => ({
  slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
  targetScore: 280,
  currentLevel: 1,
  selectedSlotIndex: null,

  setTargetScore: (score) => set({ targetScore: score }),

  setCurrentLevel: (level) => {
    const streakLevel = STREAK_LEVELS.find((l) => l.level === level);
    if (streakLevel) {
      set({ currentLevel: level, targetScore: streakLevel.threshold });
    }
  },

  selectSlot: (index) => set({ selectedSlotIndex: index }),

  addCard: (slotIndex, card) =>
    set((state) => {
      const slots = state.slots.map((slot, i) => {
        // Remove card from any other slot it might be in
        if (slot.card?.slug === card.slug) return { ...slot, card: null };
        if (i === slotIndex) return { ...slot, card };
        return slot;
      });
      return { slots, selectedSlotIndex: null };
    }),

  removeCard: (slotIndex) =>
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === slotIndex ? { ...slot, card: null } : slot
      ),
    })),

  clearLineup: () =>
    set({
      slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
      selectedSlotIndex: null,
    }),

  autoFill: (cards) =>
    set(() => {
      const recommended = recommendLineup(cards);
      const slots: LineupSlot[] = DEFAULT_SLOTS.map((s) => ({ ...s, card: null }));

      // Try to place each recommended card in its best slot
      const placed = new Set<string>();

      for (const card of recommended) {
        const primaryPos = card.anyPlayer?.cardPositions?.[0];

        // Find matching empty slot
        let bestSlot = -1;
        for (let i = 0; i < slots.length; i++) {
          if (slots[i].card) continue;
          if (positionMatchesSlot(primaryPos, slots[i].position)) {
            bestSlot = i;
            break;
          }
        }

        // If no positional match, only try the EX slot (prevents GK in FWD, etc.)
        if (bestSlot === -1) {
          const exSlotIndex = slots.findIndex(s => s.position === "EX");
          if (exSlotIndex !== -1 && !slots[exSlotIndex].card) {
            bestSlot = exSlotIndex;
          }
        }

        const playerSlug = card.anyPlayer?.slug ?? card.slug;
        if (bestSlot !== -1 && !placed.has(playerSlug)) {
          slots[bestSlot] = { ...slots[bestSlot], card };
          placed.add(playerSlug);
        }
      }

      return { slots, selectedSlotIndex: null };
    }),

  addCardToNextEmpty: (card) => {
    const state = get();
    // If a slot is selected, place there
    if (state.selectedSlotIndex !== null && !state.slots[state.selectedSlotIndex].card) {
      get().addCard(state.selectedSlotIndex, card);
      return;
    }
    // Otherwise find next empty slot
    const emptyIndex = state.slots.findIndex((s) => s.card === null);
    if (emptyIndex !== -1) {
      get().addCard(emptyIndex, card);
    }
  },
}));
