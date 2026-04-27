import { create } from "zustand";
import type { LineupPosition } from "@/lib/types";
import type { PlayMode } from "@/components/ai/play-mode-chips";

export const POS_ORDER: ReadonlyArray<LineupPosition> = [
  "GK",
  "DEF",
  "MID",
  "FWD",
  "EX",
];

export type SlotMap = Record<LineupPosition, string | null>;

export interface WorkspaceTeam {
  id: number; // 0..3, stable across the session
  name: string;
  slots: SlotMap;
  captain: string | null; // cardSlug
}

export interface DragPayload {
  cardSlug: string;
  from: "pool" | "slot";
  teamId?: number;
  position?: LineupPosition;
  cardPos: LineupPosition; // primary position of the dragged card
}

export interface WorkspacePayload {
  teams: WorkspaceTeam[]; // always length 4
  teamCount: number; // 1..4
  targetIdx: number; // index into competition.streak.thresholds
  notes: string;
  playMode: PlayMode;
}

const TEAM_NAMES = ["Team A", "Team B", "Team C", "Team D"];

const emptySlots = (): SlotMap => ({
  GK: null,
  DEF: null,
  MID: null,
  FWD: null,
  EX: null,
});

const initialTeams = (): WorkspaceTeam[] =>
  TEAM_NAMES.map((name, i) => ({
    id: i,
    name,
    slots: emptySlots(),
    captain: null,
  }));

const isCaptainOnTeam = (team: WorkspaceTeam): boolean =>
  team.captain != null && Object.values(team.slots).includes(team.captain);

interface WorkspaceState {
  // Identity — clan-helper scenario carries forUserSlug ≠ userSlug.
  userSlug: string | null; // logged-in user (the helper)
  forUserSlug: string | null; // owner of the gallery the draft is built against
  competitionSlug: string | null;
  fixtureSlug: string | null;

  // Persisted shape
  teams: WorkspaceTeam[];
  teamCount: number;
  targetIdx: number;
  notes: string;
  playMode: PlayMode;

  // Ephemeral
  drag: DragPayload | null;
  dirty: boolean;
}

export interface WorkspacePayloadInput {
  teams?: Array<{
    name?: string;
    slots?: Partial<SlotMap> | Record<string, string | null>;
    captain?: string | null;
  }>;
  teamCount?: number;
  targetIdx?: number;
  notes?: string;
  playMode?: PlayMode;
}

interface WorkspaceActions {
  hydrate(args: {
    userSlug: string;
    forUserSlug: string;
    competitionSlug: string;
    fixtureSlug: string;
    payload?: WorkspacePayloadInput | null;
  }): void;
  drop(payload: DragPayload, target: { teamId: number; position: LineupPosition }): void;
  dropToPool(payload: DragPayload): void;
  remove(teamId: number, position: LineupPosition): void;
  setCaptain(teamId: number, cardSlug: string | null): void;
  rename(teamId: number, name: string): void;
  closeTeam(teamId: number): void;
  setTeamCount(n: number): void;
  setTargetIdx(i: number): void;
  setNotes(text: string): void;
  setPlayMode(mode: PlayMode): void;
  setDrag(d: DragPayload | null): void;
  clearTeam(teamId: number): void;
  setTeam(teamId: number, slots: SlotMap, captain: string | null): void;
  markClean(): void;
  reset(): void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const initialState: WorkspaceState = {
  userSlug: null,
  forUserSlug: null,
  competitionSlug: null,
  fixtureSlug: null,
  teams: initialTeams(),
  teamCount: 2,
  targetIdx: 0,
  notes: "",
  playMode: "auto",
  drag: null,
  dirty: false,
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initialState,

  hydrate: ({ userSlug, forUserSlug, competitionSlug, fixtureSlug, payload }) => {
    const fresh = initialTeams();
    const incomingTeams = payload?.teams ?? [];
    const teams = fresh.map((t, i) => {
      const incoming = incomingTeams[i];
      if (!incoming) return t;
      return {
        id: i,
        name: incoming.name ?? t.name,
        slots: { ...emptySlots(), ...(incoming.slots ?? {}) },
        captain: incoming.captain ?? null,
      };
    });

    set({
      userSlug,
      forUserSlug,
      competitionSlug,
      fixtureSlug,
      teams,
      teamCount: payload?.teamCount ?? 2,
      targetIdx: payload?.targetIdx ?? 0,
      notes: payload?.notes ?? "",
      playMode: payload?.playMode ?? "auto",
      drag: null,
      dirty: false,
    });
  },

  drop: (payload, target) => {
    set((state) => {
      const next = state.teams.map((t) => ({ ...t, slots: { ...t.slots } }));
      const targetTeam = next.find((t) => t.id === target.teamId);
      if (!targetTeam) return state;

      const existingInTarget = targetTeam.slots[target.position];

      if (payload.from === "pool") {
        // Place; if slot occupied, the existing card returns to the pool
        // implicitly (no other team holds it just because it sat here).
        targetTeam.slots[target.position] = payload.cardSlug;
      } else if (payload.from === "slot") {
        if (payload.teamId == null || payload.position == null) return state;
        const sourceTeam = next.find((t) => t.id === payload.teamId);
        if (!sourceTeam) return state;

        // Same team + same slot = no-op
        if (
          sourceTeam.id === targetTeam.id &&
          payload.position === target.position
        ) {
          return state;
        }

        // Swap or move
        sourceTeam.slots[payload.position] = existingInTarget ?? null;
        targetTeam.slots[target.position] = payload.cardSlug;

        // Source captain may have been dropped/displaced
        if (sourceTeam.captain && !isCaptainOnTeam(sourceTeam)) {
          sourceTeam.captain = null;
        }
      }

      // Target captain may no longer hold a slot (replacement scenario)
      if (targetTeam.captain && !isCaptainOnTeam(targetTeam)) {
        targetTeam.captain = null;
      }

      return { teams: next, dirty: true };
    });
  },

  dropToPool: (payload) => {
    if (payload.from !== "slot" || payload.teamId == null || payload.position == null) {
      return;
    }
    const teamId = payload.teamId;
    const position = payload.position;
    set((state) => ({
      teams: state.teams.map((t) => {
        if (t.id !== teamId) return t;
        const slots = { ...t.slots, [position]: null };
        const captain =
          t.captain && Object.values(slots).includes(t.captain) ? t.captain : null;
        return { ...t, slots, captain };
      }),
      dirty: true,
    }));
  },

  remove: (teamId, position) =>
    get().dropToPool({
      cardSlug: get().teams.find((t) => t.id === teamId)?.slots[position] ?? "",
      from: "slot",
      teamId,
      position,
      cardPos: position,
    }),

  setCaptain: (teamId, cardSlug) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? { ...t, captain: t.captain === cardSlug ? null : cardSlug }
          : t,
      ),
      dirty: true,
    })),

  rename: (teamId, name) =>
    set((state) => ({
      teams: state.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
      dirty: true,
    })),

  // Closing a team shifts it to the back of the array, resets it, and
  // shrinks the visible count. The id sequence stays 0..3.
  closeTeam: (teamId) =>
    set((state) => {
      const idx = state.teams.findIndex((t) => t.id === teamId);
      if (idx < 0) return state;
      const remaining = state.teams.filter((t) => t.id !== teamId);
      const closed = state.teams[idx];
      const reset: WorkspaceTeam = {
        ...closed,
        slots: emptySlots(),
        captain: null,
      };
      return {
        teams: [...remaining, reset],
        teamCount: Math.max(1, state.teamCount - 1),
        dirty: true,
      };
    }),

  setTeamCount: (n) =>
    set((state) => {
      const clamped = Math.max(1, Math.min(4, n));
      if (clamped === state.teamCount) return state;
      return { teamCount: clamped, dirty: true };
    }),

  setTargetIdx: (i) =>
    set((state) =>
      state.targetIdx === i ? state : { targetIdx: i, dirty: true },
    ),

  setNotes: (text) =>
    set((state) =>
      state.notes === text ? state : { notes: text, dirty: true },
    ),

  setPlayMode: (mode) =>
    set((state) =>
      state.playMode === mode ? state : { playMode: mode, dirty: true },
    ),

  setDrag: (d) => set({ drag: d }),

  clearTeam: (teamId) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, slots: emptySlots(), captain: null } : t,
      ),
      dirty: true,
    })),

  setTeam: (teamId, slots, captain) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              slots: { ...emptySlots(), ...slots },
              captain: captain && Object.values(slots).includes(captain) ? captain : null,
            }
          : t,
      ),
      dirty: true,
    })),

  markClean: () => set({ dirty: false }),

  reset: () => set({ ...initialState, teams: initialTeams() }),
}));

// Note: don't expose a `selectVisibleTeams` selector here. Using it via
// `useWorkspaceStore(selectVisibleTeams)` returns a fresh `slice()` array on
// every read, which trips React's `useSyncExternalStore` snapshot cache and
// loops the renderer. Subscribe to `teams` + `teamCount` separately and
// derive with `useMemo` in the component instead.

export function selectWorkspacePayload(state: WorkspaceStore): WorkspacePayload {
  return {
    teams: state.teams,
    teamCount: state.teamCount,
    targetIdx: state.targetIdx,
    notes: state.notes,
    playMode: state.playMode,
  };
}
