"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCards } from "@/providers/cards-provider";
import { useWorkspaceStore } from "@/lib/in-season/workspace-store";
import { useWorkspaceAutosave } from "@/lib/in-season/use-workspace-autosave";
import type { InSeasonCompetition, SorareCard } from "@/lib/types";
import { ChevronLeft } from "lucide-react";
import { CompetitionsSidebar } from "./competitions-sidebar";
import { WorkspaceSubHeader } from "./workspace-sub-header";
import { ThresholdStrip } from "./threshold-strip";
import { TeamsRow } from "./teams-row";
import { CardPool } from "./card-pool";
import { DragIndicator } from "./drag-indicator";
import { NotesDrawer } from "./notes-drawer";

interface CompetitionsResponse {
  fixtureSlug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: InSeasonCompetition[];
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

async function fetchCompetitions(userSlug: string): Promise<CompetitionsResponse> {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=UPCOMING`,
  );
  if (!res.ok) throw new Error("Failed to load competitions");
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

export function InSeasonWorkspace({
  competitionSlug,
}: {
  competitionSlug: string;
}) {
  const { userSlug, cards: ownCards } = useCards();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forUserSlug = searchParams.get("for") ?? userSlug ?? "";
  const helperQuery = searchParams.get("for") ? `?for=${searchParams.get("for")}` : "";

  // When helping another user, fetch their gallery; otherwise reuse the
  // logged-in user's cards from the provider.
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
    enabled: !!forUserSlug && forUserSlug !== userSlug,
    staleTime: 5 * 60 * 1000,
  });

  const galleryCards = useMemo<SorareCard[]>(
    () =>
      forUserSlug && forUserSlug !== userSlug
        ? (helperCardsQuery.data ?? [])
        : ownCards,
    [forUserSlug, userSlug, helperCardsQuery.data, ownCards],
  );

  const cardsBySlug = useMemo(() => {
    const m = new Map<string, SorareCard>();
    for (const c of galleryCards) m.set(c.slug, c);
    return m;
  }, [galleryCards]);

  const competitionsQuery = useQuery({
    queryKey: ["in-season-competitions", userSlug, "UPCOMING"],
    queryFn: () => fetchCompetitions(userSlug ?? ""),
    enabled: !!userSlug,
    staleTime: 5 * 60 * 1000,
  });

  const fixtureSlug = competitionsQuery.data?.fixtureSlug ?? null;
  const competitions = useMemo(
    () => competitionsQuery.data?.competitions ?? [],
    [competitionsQuery.data?.competitions],
  );
  const selected = competitions.find((c) => c.slug === competitionSlug) ?? null;

  const draftsListQuery = useQuery({
    queryKey: ["in-season-drafts-list", userSlug, fixtureSlug],
    queryFn: () => fetchDraftsList(userSlug!, fixtureSlug!),
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
    queryKey: ["in-season-draft", userSlug, forUserSlug, competitionSlug, fixtureSlug],
    queryFn: () =>
      fetchDraft({
        userSlug: userSlug!,
        forUserSlug,
        competitionSlug,
        fixtureSlug: fixtureSlug!,
      }),
    enabled: !!userSlug && !!forUserSlug && !!fixtureSlug,
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

  const handleSelectComp = useCallback(
    (slug: string) => {
      router.push(`/in-season/${slug}${helperQuery}`);
    },
    [router, helperQuery],
  );

  if (competitionsQuery.isLoading) {
    return (
      <div className="flex-1 grid place-items-center text-zinc-500 text-sm">
        Loading competitions…
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <p className="text-sm">Competition not found in the upcoming fixture.</p>
        <Link
          href="/in-season"
          className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-3 h-3" /> Back to In Season
        </Link>
      </div>
    );
  }

  const isHelper = forUserSlug !== userSlug;
  const lockCountdown = formatLockCountdown(selected.cutOffDate);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
      {/* Page header */}
      <div className="px-5 py-2.5 border-b border-zinc-800/80 flex items-baseline gap-3 bg-zinc-950/30">
        <Link
          href="/in-season"
          className="text-zinc-500 hover:text-zinc-300 inline-flex items-center"
          aria-label="Back to In Season"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold text-zinc-100 tracking-tight">In Season</h1>
        <span className="text-[11px] text-zinc-500">
          Build up to 4 teams in parallel · drag-and-drop
        </span>
        {isHelper && (
          <span className="text-[10px] mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
            Helping {forUserSlug}
          </span>
        )}
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

      <NotesDrawer />

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden">
        <CompetitionsSidebar
          competitions={competitions}
          gameWeek={competitionsQuery.data?.gameWeek ?? null}
          fixtureLabel={formatFixtureLabel(competitionsQuery.data?.endDate ?? null)}
          selectedSlug={competitionSlug}
          filledCounts={filledCounts}
          onSelect={handleSelectComp}
        />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <WorkspaceMain selected={selected} cardsBySlug={cardsBySlug} />
        </main>

        <div className="w-[340px] shrink-0">
          <CardPool comp={selected} cards={galleryCards} />
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
  const setTeamCount = useWorkspaceStore((s) => s.setTeamCount);
  const setTargetIdx = useWorkspaceStore((s) => s.setTargetIdx);

  // Resolve the active threshold score (mirrors ThresholdStrip's fallback).
  const thresholds = selected.streak?.thresholds ?? [];
  const fallback = [280, 320, 360, 400, 440, 480];
  const target =
    thresholds[targetIdx]?.score ??
    fallback[targetIdx] ??
    fallback[fallback.length - 1];

  return (
    <>
      <WorkspaceSubHeader
        comp={selected}
        eligibleCount={selected.eligibleCardCount}
        teamCount={teamCount}
        onTeamCountChange={setTeamCount}
      />
      <ThresholdStrip
        streak={selected.streak}
        targetIdx={targetIdx}
        onTargetChange={setTargetIdx}
      />
      <TeamsRow
        competition={selected}
        cardsBySlug={cardsBySlug}
        target={target}
      />
    </>
  );
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
