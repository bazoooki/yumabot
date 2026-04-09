import { create } from "zustand";
import type {
  SorareCard,
  InSeasonCompetition,
  InSeasonLineupSlot,
  InSeasonThreshold,
  PlayerIntel,
  ScoredCardWithStrategy,
  LineupProbability,
  GWPlan,
} from "./types";
import { positionMatchesSlot } from "./normalization";
import { recommendInSeasonLineup, mapThresholdToLevel } from "./ai-lineup";
import { planGameweek } from "./gw-optimizer";

const DEFAULT_SLOTS: InSeasonLineupSlot[] = [
  { position: "GK", card: null, isCaptain: false },
  { position: "DEF", card: null, isCaptain: false },
  { position: "MID", card: null, isCaptain: false },
  { position: "FWD", card: null, isCaptain: false },
  { position: "EX", card: null, isCaptain: false },
];

interface InSeasonStore {
  // Data from API
  competitions: InSeasonCompetition[];
  fixtureSlug: string | null;
  gameWeek: number | null;

  // Selection state
  selectedCompSlug: string | null;
  selectedTeamIndex: number;

  // Lineup building (local, for planning)
  slots: InSeasonLineupSlot[];
  selectedSlotIndex: number | null;

  // Strategy
  targetThreshold: InSeasonThreshold | null;
  cachedPlayerIntel: Record<string, PlayerIntel> | null;

  // AI results
  strategyResults: ScoredCardWithStrategy[] | null;
  lineupProbability: LineupProbability | null;
  isAutoFilling: boolean;

  // Cross-team tracking: cards used in other teams of the same competition
  usedCardSlugs: Set<string>;

  // GW Planner
  plannerMode: boolean;
  gwPlan: GWPlan | null;
  isPlanning: boolean;

  // Actions
  setCompetitions(comps: InSeasonCompetition[], fixtureSlug: string | null, gameWeek: number | null): void;
  selectCompetition(slug: string): void;
  selectTeam(index: number): void;
  selectSlot(index: number | null): void;
  addCard(slotIndex: number, card: SorareCard): void;
  removeCard(slotIndex: number): void;
  setCaptain(slotIndex: number | null): void;
  clearLineup(): void;
  setTargetThreshold(threshold: InSeasonThreshold | null): void;
  setCachedPlayerIntel(intel: Record<string, PlayerIntel>): void;
  setAutoFilling(filling: boolean): void;
  setStrategyResults(results: ScoredCardWithStrategy[] | null, probability: LineupProbability | null): void;
  autoFillWithStrategy(cards: SorareCard[]): Promise<void>;
  setPlannerMode(enabled: boolean): void;
  planGameweek(cards: SorareCard[]): Promise<void>;
  applyAllocation(competitionSlug: string): void;
}

function computeUsedCardSlugs(
  competitions: InSeasonCompetition[],
  compSlug: string | null,
  teamIndex: number,
): Set<string> {
  if (!compSlug) return new Set();
  const comp = competitions.find((c) => c.slug === compSlug);
  if (!comp) return new Set();

  const used = new Set<string>();
  for (let i = 0; i < comp.teams.length; i++) {
    if (i === teamIndex) continue; // skip the active team
    for (const slot of comp.teams[i].slots) {
      if (slot.cardSlug) used.add(slot.cardSlug);
    }
  }
  return used;
}

function loadTeamSlots(
  competitions: InSeasonCompetition[],
  compSlug: string | null,
  teamIndex: number,
): InSeasonLineupSlot[] {
  if (!compSlug) return DEFAULT_SLOTS.map((s) => ({ ...s }));
  const comp = competitions.find((c) => c.slug === compSlug);
  const team = comp?.teams[teamIndex];
  if (!team || team.slots.length === 0) {
    return DEFAULT_SLOTS.map((s) => ({ ...s }));
  }

  // Map server slots back to local lineup slots
  // Server slots are indexed 0-4, we map them to our positional layout
  const positions = ["GK", "DEF", "MID", "FWD", "EX"] as const;
  return positions.map((pos, i) => {
    const serverSlot = team.slots.find((s) => s.index === i);
    if (!serverSlot?.cardSlug) {
      return { position: pos, card: null, isCaptain: false };
    }
    // We don't have the full SorareCard object from the server response,
    // so these slots will be display-only until cards are loaded from allCards
    return {
      position: pos,
      card: null, // will be hydrated from allCards
      isCaptain: serverSlot.isCaptain,
    };
  });
}

export const useInSeasonStore = create<InSeasonStore>((set, get) => ({
  competitions: [],
  fixtureSlug: null,
  gameWeek: null,

  selectedCompSlug: null,
  selectedTeamIndex: 0,

  slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
  selectedSlotIndex: 0,

  targetThreshold: null,
  cachedPlayerIntel: null,

  strategyResults: null,
  lineupProbability: null,
  isAutoFilling: false,

  usedCardSlugs: new Set(),

  plannerMode: false,
  gwPlan: null,
  isPlanning: false,

  setCompetitions: (comps, fixtureSlug, gameWeek) => {
    const state = get();
    const selectedCompSlug = state.selectedCompSlug ?? comps[0]?.slug ?? null;
    set({
      competitions: comps,
      fixtureSlug,
      gameWeek,
      selectedCompSlug,
      usedCardSlugs: computeUsedCardSlugs(comps, selectedCompSlug, state.selectedTeamIndex),
    });
  },

  selectCompetition: (slug) => {
    const state = get();
    const comp = state.competitions.find((c) => c.slug === slug);

    // Load the first threshold as target
    const threshold = comp?.streak?.thresholds.find((t) => t.isCurrent) ?? null;

    set({
      selectedCompSlug: slug,
      selectedTeamIndex: 0,
      slots: loadTeamSlots(state.competitions, slug, 0),
      selectedSlotIndex: 0,
      targetThreshold: threshold,
      strategyResults: null,
      lineupProbability: null,
      usedCardSlugs: computeUsedCardSlugs(state.competitions, slug, 0),
    });
  },

  selectTeam: (index) => {
    const state = get();
    set({
      selectedTeamIndex: index,
      slots: loadTeamSlots(state.competitions, state.selectedCompSlug, index),
      selectedSlotIndex: 0,
      strategyResults: null,
      lineupProbability: null,
      usedCardSlugs: computeUsedCardSlugs(state.competitions, state.selectedCompSlug, index),
    });
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
      // Auto-advance to next empty slot
      const nextEmpty = [0, 1, 2, 3, 4].find((i) => !slots[i].card);
      return { slots, selectedSlotIndex: nextEmpty ?? null };
    }),

  removeCard: (slotIndex) =>
    set((state) => ({
      slots: state.slots.map((slot, i) =>
        i === slotIndex ? { ...slot, card: null, isCaptain: false } : slot,
      ),
    })),

  setCaptain: (slotIndex) =>
    set((state) => ({
      slots: state.slots.map((slot, i) => ({
        ...slot,
        isCaptain: slotIndex !== null && i === slotIndex ? !slot.isCaptain : false,
      })),
    })),

  clearLineup: () =>
    set({
      slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
      selectedSlotIndex: 0,
      strategyResults: null,
      lineupProbability: null,
    }),

  setTargetThreshold: (threshold) => set({ targetThreshold: threshold }),

  setCachedPlayerIntel: (intel) => set({ cachedPlayerIntel: intel }),

  setAutoFilling: (filling) => set({ isAutoFilling: filling }),

  setStrategyResults: (results, probability) =>
    set({ strategyResults: results, lineupProbability: probability }),

  autoFillWithStrategy: async (cards) => {
    const state = get();
    const comp = state.competitions.find((c) => c.slug === state.selectedCompSlug);
    if (!comp) return;

    set({ isAutoFilling: true, strategyResults: null, lineupProbability: null });

    try {
      const crossLeagueKeywords = ["challenger", "contender", "european", "global"];
      const isCrossLeague = crossLeagueKeywords.some((kw) =>
        comp.leagueName.toLowerCase().includes(kw),
      );

      const targetScore = state.targetThreshold?.score ?? 360;

      const { lineup, warnings, probability } = await recommendInSeasonLineup(
        cards,
        {
          allowedRarities: [comp.mainRarityType],
          leagueRestriction: isCrossLeague ? null : comp.leagueName,
          minInSeasonCards: 4,
        },
        targetScore,
        state.cachedPlayerIntel,
        state.usedCardSlugs,
      );

      if (warnings.length > 0) {
        console.log("[in-season] Auto-fill warnings:", warnings);
      }

      const slots: InSeasonLineupSlot[] = DEFAULT_SLOTS.map((s) => ({ ...s }));
      const placed = new Set<string>();

      for (const sc of lineup) {
        const card = sc.card;
        const primaryPos = card.anyPlayer?.cardPositions?.[0];

        let bestSlot = -1;
        for (let i = 0; i < slots.length; i++) {
          if (slots[i].card) continue;
          if (positionMatchesSlot(primaryPos, slots[i].position)) {
            bestSlot = i;
            break;
          }
        }

        if (bestSlot === -1) {
          const exSlotIndex = slots.findIndex((s) => s.position === "EX");
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

      // Auto-assign captain to highest expected score
      let bestCaptainIdx = -1;
      let bestCaptainScore = -1;
      for (let i = 0; i < slots.length; i++) {
        if (!slots[i].card) continue;
        const sc = lineup.find((l) => l.card.slug === slots[i].card?.slug);
        if (sc && sc.strategy.expectedScore > bestCaptainScore) {
          bestCaptainScore = sc.strategy.expectedScore;
          bestCaptainIdx = i;
        }
      }
      if (bestCaptainIdx >= 0) {
        slots[bestCaptainIdx] = { ...slots[bestCaptainIdx], isCaptain: true };
      }

      set({
        slots,
        selectedSlotIndex: null,
        strategyResults: lineup,
        lineupProbability: probability,
        isAutoFilling: false,
      });
    } catch (err) {
      console.error("[in-season] Auto-fill failed:", err);
      set({ isAutoFilling: false });
    }
  },

  setPlannerMode: (enabled) => {
    set({ plannerMode: enabled });
  },

  planGameweek: async (cards) => {
    const state = get();
    if (state.competitions.length === 0) return;

    set({ isPlanning: true, gwPlan: null });

    try {
      const plan = await planGameweek(
        cards,
        state.competitions,
        state.cachedPlayerIntel,
      );
      set({ gwPlan: plan, isPlanning: false });
    } catch (err) {
      console.error("[gw-planner] Planning failed:", err);
      set({ isPlanning: false });
    }
  },

  applyAllocation: (competitionSlug) => {
    const state = get();
    const allocation = state.gwPlan?.allocations.find(
      (a) => a.competitionSlug === competitionSlug,
    );
    if (!allocation) return;

    // Switch to builder mode with the competition selected
    const comp = state.competitions.find((c) => c.slug === competitionSlug);
    const threshold = comp?.streak?.thresholds.find((t) => t.isCurrent) ?? null;

    const slots: InSeasonLineupSlot[] = DEFAULT_SLOTS.map((s) => ({ ...s }));
    const placed = new Set<string>();

    for (const sc of allocation.lineup) {
      const card = sc.card;
      const primaryPos = card.anyPlayer?.cardPositions?.[0];

      let bestSlot = -1;
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].card) continue;
        if (positionMatchesSlot(primaryPos, slots[i].position)) {
          bestSlot = i;
          break;
        }
      }

      if (bestSlot === -1) {
        const exSlotIndex = slots.findIndex((s) => s.position === "EX");
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

    // Auto-assign captain to highest expected score
    let bestCaptainIdx = -1;
    let bestCaptainScore = -1;
    for (let i = 0; i < slots.length; i++) {
      if (!slots[i].card) continue;
      const sc = allocation.lineup.find(
        (l) => l.card.slug === slots[i].card?.slug,
      );
      if (sc && sc.strategy.expectedScore > bestCaptainScore) {
        bestCaptainScore = sc.strategy.expectedScore;
        bestCaptainIdx = i;
      }
    }
    if (bestCaptainIdx >= 0) {
      slots[bestCaptainIdx] = { ...slots[bestCaptainIdx], isCaptain: true };
    }

    set({
      plannerMode: false,
      selectedCompSlug: competitionSlug,
      selectedTeamIndex: 0,
      slots,
      selectedSlotIndex: null,
      targetThreshold: threshold,
      strategyResults: allocation.lineup,
      lineupProbability: null,
      usedCardSlugs: computeUsedCardSlugs(state.competitions, competitionSlug, 0),
    });
  },
}));

// --- Selectors ---

export function useSelectedCompetition(): InSeasonCompetition | null {
  return useInSeasonStore((s) => {
    if (!s.selectedCompSlug) return null;
    return s.competitions.find((c) => c.slug === s.selectedCompSlug) ?? null;
  });
}

export function useEligibleCards(cards: SorareCard[]): SorareCard[] {
  const comp = useSelectedCompetition();
  const usedCardSlugs = useInSeasonStore((s) => s.usedCardSlugs);

  if (!comp) return [];

  return cards.filter((c) => {
    // Must match rarity
    if (c.rarityTyped !== comp.mainRarityType) return false;

    // Must have a player
    if (!c.anyPlayer) return false;

    // Must have an upcoming game
    if (!c.anyPlayer.activeClub?.upcomingGames?.length) return false;

    // Don't show cards used in other teams of same competition
    if (usedCardSlugs.has(c.slug)) return false;

    // League filter (skip for cross-league competitions)
    // Cross-league comps typically have group names like "Challenger", "Contender", "European Leagues"
    const crossLeagueKeywords = ["challenger", "contender", "european", "global"];
    const isCrossLeague = crossLeagueKeywords.some((kw) =>
      comp.leagueName.toLowerCase().includes(kw),
    );
    if (!isCrossLeague && comp.leagueName) {
      const playerLeague = c.anyPlayer.activeClub?.domesticLeague?.name;
      if (playerLeague && playerLeague !== comp.leagueName) return false;
    }

    return true;
  });
}
