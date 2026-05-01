"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCards } from "@/providers/cards-provider";
import { useWorkspaceStore } from "@/lib/in-season/workspace-store";
import { useWorkspaceAutosave } from "@/lib/in-season/use-workspace-autosave";
import type { InSeasonCompetition, SorareCard } from "@/lib/types";
import { CompetitionsSidebar } from "./competitions-sidebar";
import { WorkspaceSubHeader } from "./workspace-sub-header";
import { ThresholdStrip } from "./threshold-strip";
import { TeamsRow } from "./teams-row";
import { CardPool } from "./card-pool";
import { DragIndicator } from "./drag-indicator";
import { NotesDrawer } from "./notes-drawer";
import { GwStrip, type GwStripFixture } from "./gw-strip";
import { AITakeDrawer } from "./ai-take-drawer";

/**
 * Within a fixture's competitions, return the representative leaderboard for
 * a given league. Prefers Limited rarity and the lowest division.
 */
function pickRepresentativeForLeague(
  competitions: InSeasonCompetition[],
  leagueSlug: string,
): InSeasonCompetition | null {
  const inLeague = competitions.filter((c) => c.leagueSlug === leagueSlug);
  if (inLeague.length === 0) return null;
  const limited = inLeague.filter((c) => c.mainRarityType === "limited");
  const pool = limited.length > 0 ? limited : inLeague;
  return pool.slice().sort((a, b) => a.division - b.division)[0] ?? null;
}

interface UpcomingFixture {
  slug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: InSeasonCompetition[];
}

interface UpcomingFixturesResponse {
  fixtures: UpcomingFixture[];
}

interface DraftPayload {
  teams?: { name: string; slots: Record<string, string | null>; captain: string | null }[];
  teamCount?: number;
  targetIdx?: number;
  notes?: string;
}

interface DraftResponse {
  draft: null | {
    id: number;
    payload: DraftPayload;
  };
}

interface DraftsListResponse {
  drafts: Array<{
    competitionSlug: string;
    payload: DraftPayload;
  }>;
}

async function fetchUpcomingFixtures(): Promise<UpcomingFixturesResponse> {
  const res = await fetch(`/api/in-season/upcoming-fixtures`);
  if (!res.ok) throw new Error("Failed to load upcoming fixtures");
  return res.json();
}

async function fetchDraft(args: {
  userSlug: string;
  forUserSlug: string;
  competitionSlug: string;
  fixtureSlug: string;
}): Promise<DraftResponse> {
  const params = new URLSearchParams({
    userSlug: args.userSlug,
    forUserSlug: args.forUserSlug,
    fixtureSlug: args.fixtureSlug,
  });
  const res = await fetch(
    `/api/in-season/drafts/${args.competitionSlug}?${params.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to load draft");
  return res.json();
}

async function fetchDraftsList(
  userSlug: string,
  fixtureSlug: string,
): Promise<DraftsListResponse> {
  const params = new URLSearchParams({ userSlug, fixtureSlug });
  const res = await fetch(`/api/in-season/drafts?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load drafts");
  return res.json();
}

function countFilledTeams(payload: DraftPayload | undefined): number {
  if (!payload?.teams) return 0;
  const cap = payload.teamCount ?? payload.teams.length;
  let count = 0;
  for (let i = 0; i < cap; i++) {
    const t = payload.teams[i];
    if (!t) continue;
    const hasAny = Object.values(t.slots ?? {}).some((v) => !!v);
    if (hasAny) count++;
  }
  return count;
}

interface InSeasonWorkspaceProps {
  forUserSlug: string;
}

export function InSeasonWorkspace({
  forUserSlug,
}: InSeasonWorkspaceProps) {
  const { userSlug: currentUserSlug, cards: ownCards } = useCards();
  const searchParams = useSearchParams();
  const gwParam = searchParams.get("gw");
  // League selection lives in the query string so switches don't remount the
  // page or trigger Next.js dev-mode route recompilation. Updates go through
  // `window.history.pushState` (see handleSelectLeague below) which integrates
  // with `useSearchParams` per the Next.js Native History API guidance.
  const leagueSlug = searchParams.get("league");

  // The logged-in user owns the draft row; `forUserSlug` is who the draft is
  // built FOR (self or clan member).
  const userSlug = currentUserSlug ?? "";
  const isHelper = !!userSlug && forUserSlug !== userSlug;

  const helperCardsQuery = useQuery({
    queryKey: ["cards", forUserSlug],
    queryFn: async () => {
      const res = await fetch(
        `/api/cards?slug=${encodeURIComponent(forUserSlug)}`,
      );
      if (!res.ok) throw new Error("Failed to load helper cards");
      const data = (await res.json()) as { cards: SorareCard[] };
      return data.cards ?? [];
    },
    enabled: isHelper,
    staleTime: 5 * 60 * 1000,
  });

  const galleryCards = useMemo<SorareCard[]>(
    () => (isHelper ? (helperCardsQuery.data ?? []) : ownCards),
    [isHelper, helperCardsQuery.data, ownCards],
  );

  const cardsBySlug = useMemo(() => {
    const m = new Map<string, SorareCard>();
    for (const c of galleryCards) m.set(c.slug, c);
    return m;
  }, [galleryCards]);

  const fixturesQuery = useQuery({
    queryKey: ["in-season-upcoming-fixtures"],
    queryFn: fetchUpcomingFixtures,
    staleTime: 5 * 60 * 1000,
  });

  const fixtures = useMemo(
    () => fixturesQuery.data?.fixtures ?? [],
    [fixturesQuery.data?.fixtures],
  );

  // Active fixture: respects ?gw=<num>; else the first (= next in-season GW).
  const activeFixture = useMemo(() => {
    if (fixtures.length === 0) return null;
    if (gwParam) {
      const parsed = Number.parseInt(gwParam, 10);
      const match = fixtures.find((f) => f.gameWeek === parsed);
      if (match) return match;
    }
    return fixtures[0];
  }, [fixtures, gwParam]);

  const fixtureSlug = activeFixture?.slug ?? null;
  const competitions = useMemo(
    () => activeFixture?.competitions ?? [],
    [activeFixture],
  );

  // Resolve the active competition (leaderboard) from leagueSlug.
  // - if a league is in the URL: pick the lowest-division Limited within it
  // - else: default to the first league's representative
  const selected = useMemo(() => {
    if (competitions.length === 0) return null;
    if (leagueSlug) {
      const rep = pickRepresentativeForLeague(competitions, leagueSlug);
      if (rep) return rep;
    }
    // Default: first league's representative
    const firstLeague = competitions[0]?.leagueSlug;
    return firstLeague
      ? pickRepresentativeForLeague(competitions, firstLeague)
      : null;
  }, [competitions, leagueSlug]);

  const competitionSlug = selected?.slug ?? "";

  const draftsListQuery = useQuery({
    queryKey: ["in-season-drafts-list", userSlug, fixtureSlug],
    queryFn: () => fetchDraftsList(userSlug, fixtureSlug!),
    enabled: !!userSlug && !!fixtureSlug,
    staleTime: 60 * 1000,
  });

  const filledCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of draftsListQuery.data?.drafts ?? []) {
      map.set(d.competitionSlug, countFilledTeams(d.payload));
    }
    return map;
  }, [draftsListQuery.data?.drafts]);

  const draftQuery = useQuery({
    queryKey: [
      "in-season-draft",
      userSlug,
      forUserSlug,
      competitionSlug,
      fixtureSlug,
    ],
    queryFn: () =>
      fetchDraft({
        userSlug,
        forUserSlug,
        competitionSlug,
        fixtureSlug: fixtureSlug!,
      }),
    enabled:
      !!userSlug && !!forUserSlug && !!competitionSlug && !!fixtureSlug,
    staleTime: 60 * 1000,
  });

  const hydrate = useWorkspaceStore((s) => s.hydrate);
  const reset = useWorkspaceStore((s) => s.reset);

  useEffect(() => {
    if (!userSlug || !forUserSlug || !fixtureSlug) return;
    if (draftQuery.isLoading) return;
    hydrate({
      userSlug,
      forUserSlug,
      competitionSlug,
      fixtureSlug,
      payload: draftQuery.data?.draft?.payload ?? null,
    });
  }, [
    userSlug,
    forUserSlug,
    competitionSlug,
    fixtureSlug,
    draftQuery.data,
    draftQuery.isLoading,
    hydrate,
  ]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const autosave = useWorkspaceAutosave();

  const buildPath = useCallback(
    (targetLeagueSlug: string | null, gw: number | null) => {
      const params = new URLSearchParams();
      if (targetLeagueSlug) params.set("league", targetLeagueSlug);
      if (gw != null) params.set("gw", String(gw));
      const qs = params.toString();
      return `/in-season/${forUserSlug}${qs ? `?${qs}` : ""}`;
    },
    [forUserSlug],
  );

  const handleSelectLeague = useCallback(
    (nextLeagueSlug: string) => {
      // Use the native History API to update the URL without triggering a
      // Next.js navigation — `useSearchParams` picks up the change and the
      // page re-renders with the new league, but no route compile / remount.
      window.history.pushState(
        null,
        "",
        buildPath(nextLeagueSlug, activeFixture?.gameWeek ?? null),
      );
    },
    [buildPath, activeFixture?.gameWeek],
  );

  const handleSelectFixture = useCallback(
    (fx: GwStripFixture) => {
      const target = fixtures.find((f) => f.slug === fx.slug);
      if (!target) return;
      // Try to keep the same league across GWs; if not present, fall back to
      // the new fixture's first league.
      const stillThere =
        leagueSlug && target.competitions.some((c) => c.leagueSlug === leagueSlug)
          ? leagueSlug
          : (target.competitions[0]?.leagueSlug ?? null);
      window.history.replaceState(
        null,
        "",
        buildPath(stillThere, target.gameWeek),
      );
    },
    [fixtures, leagueSlug, buildPath],
  );

  const stripFixtures: GwStripFixture[] = useMemo(
    () =>
      fixtures.map((f) => ({
        slug: f.slug,
        gameWeek: f.gameWeek,
        endDate: f.endDate,
        aasmState: f.aasmState,
        competitionsCount: f.competitions.length,
      })),
    [fixtures],
  );

  if (fixturesQuery.isLoading) {
    return (
      <div className="flex-1 grid place-items-center text-zinc-500 text-sm">
        Loading in-season fixtures…
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 px-6 text-center">
        <p className="text-sm">
          No in-season competitions found in the next upcoming fixtures.
        </p>
        <p className="text-xs text-zinc-500">
          Sorare may be between fixture cycles. Check back shortly.
        </p>
      </div>
    );
  }

  const lockCountdown = selected
    ? formatLockCountdown(selected.cutOffDate)
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Page header */}
      <div className="px-5 py-2.5 border-b border-zinc-800/80 flex items-baseline gap-3 bg-zinc-950/30">
        <h1 className="text-lg font-bold text-zinc-100 tracking-tight">In Season</h1>
        <span className="text-[11px] text-zinc-500">
          Build up to 4 teams in parallel · drag-and-drop
        </span>
        <span className="mono text-[10px] text-zinc-500">·</span>
        <span className="mono text-[10px] uppercase tracking-wider text-zinc-400">
          {isHelper ? `Helping ${forUserSlug}` : forUserSlug}
        </span>
        <div className="ml-auto flex items-center gap-3 mono text-[10px] uppercase tracking-wider">
          <SaveIndicator status={autosave} />
          {lockCountdown && (
            <>
              <span className="text-zinc-500">Locks in</span>
              <span className="text-amber-400 font-bold tabular-nums">
                {lockCountdown}
              </span>
            </>
          )}
        </div>
      </div>

      <GwStrip
        fixtures={stripFixtures}
        activeFixtureSlug={activeFixture?.slug ?? null}
        onSelect={handleSelectFixture}
      />

      <NotesDrawer />

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden">
        <CompetitionsSidebar
          competitions={competitions}
          gameWeek={activeFixture?.gameWeek ?? null}
          fixtureLabel={formatFixtureLabel(activeFixture?.endDate ?? null)}
          selectedLeagueSlug={selected?.leagueSlug ?? ""}
          filledCounts={filledCounts}
          onSelectLeague={handleSelectLeague}
        />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <WorkspaceMain selected={selected} cardsBySlug={cardsBySlug} />
          ) : (
            <div className="flex-1 grid place-items-center text-zinc-600 text-xs">
              No leagues in this game week.
            </div>
          )}
        </main>

        <div className="w-[340px] shrink-0">
          {selected ? (
            <CardPool comp={selected} cards={galleryCards} />
          ) : (
            <div className="h-full bg-zinc-950/40 border-l border-zinc-800/80" />
          )}
        </div>
      </div>

      <DragIndicator cardsBySlug={cardsBySlug} />
    </div>
  );
}

function WorkspaceMain({
  selected,
  cardsBySlug,
}: {
  selected: InSeasonCompetition;
  cardsBySlug: Map<string, SorareCard>;
}) {
  const teamCount = useWorkspaceStore((s) => s.teamCount);
  const targetIdx = useWorkspaceStore((s) => s.targetIdx);
  const playMode = useWorkspaceStore((s) => s.playMode);
  const setTeamCount = useWorkspaceStore((s) => s.setTeamCount);
  const setTargetIdx = useWorkspaceStore((s) => s.setTargetIdx);
  const setPlayMode = useWorkspaceStore((s) => s.setPlayMode);

  // Resolve the active threshold score (mirrors ThresholdStrip's fallback).
  const thresholds = selected.streak?.thresholds ?? [];
  const fallback = [280, 320, 360, 400, 440, 480];
  const target =
    thresholds[targetIdx]?.score ??
    fallback[targetIdx] ??
    fallback[fallback.length - 1];

  // When playMode is "auto", derive an effective mode from the chosen target
  // tier — fast for low targets, balanced in the middle, safe at the top.
  const effectivePlayMode =
    playMode !== "auto"
      ? playMode
      : targetIdx <= 1
        ? "fast"
        : targetIdx === 2
          ? "balanced"
          : "safe";

  return (
    <>
      <WorkspaceSubHeader
        comp={selected}
        eligibleCount={selected.eligibleCardCount}
        teamCount={teamCount}
        onTeamCountChange={setTeamCount}
        playMode={playMode}
        effectivePlayMode={effectivePlayMode}
        onPlayModeChange={setPlayMode}
      />
      <ThresholdStrip
        streak={selected.streak}
        targetIdx={targetIdx}
        onTargetChange={setTargetIdx}
      />
      <AITakeDrawer
        competition={selected}
        cardsBySlug={cardsBySlug}
        target={target}
        rewardLabel={
          selected.streak?.thresholds[targetIdx]?.reward ??
          fallbackReward(target)
        }
      />
      <TeamsRow
        competition={selected}
        cardsBySlug={cardsBySlug}
        target={target}
      />
    </>
  );
}

const FALLBACK_REWARD_BY_THRESHOLD: Record<number, string> = {
  280: "$2",
  320: "$6",
  360: "$15",
  400: "$50",
  440: "$200",
  480: "$1,000",
};

function fallbackReward(target: number): string {
  return FALLBACK_REWARD_BY_THRESHOLD[target] ?? `${target} pts`;
}

function SaveIndicator({
  status,
}: {
  status: { savedAt: Date | null; isFlushing: boolean; error: string | null };
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!status.savedAt) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [status.savedAt]);

  if (status.error) {
    return <span className="text-red-400">save failed</span>;
  }
  if (status.isFlushing) {
    return <span className="text-zinc-500">Saving…</span>;
  }
  if (status.savedAt && now != null) {
    const ageSec = Math.floor((now - status.savedAt.getTime()) / 1000);
    const label =
      ageSec < 5
        ? "just now"
        : ageSec < 60
          ? `${ageSec}s ago`
          : ageSec < 3600
            ? `${Math.floor(ageSec / 60)}m ago`
            : status.savedAt.toLocaleTimeString();
    return (
      <span className="text-zinc-500" title={status.savedAt.toLocaleString()}>
        Saved · {label}
      </span>
    );
  }
  if (status.savedAt) {
    return <span className="text-zinc-500">Saved</span>;
  }
  return null;
}

function formatFixtureLabel(endDate: string | null): string | null {
  if (!endDate) return null;
  const t = new Date(endDate);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLockCountdown(cutOffDate: string): string | null {
  const target = new Date(cutOffDate).getTime();
  if (Number.isNaN(target)) return null;
  const ms = target - Date.now();
  if (ms <= 0) return "locked";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
