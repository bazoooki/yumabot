"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, LayoutGrid, List } from "lucide-react";
import { LineupCardSkeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import type { SorareCard, InSeasonCompetition } from "@/lib/types";
import { LineupCard, type LineupCardVariant } from "@/components/lineup-card/lineup-card";
import { cn } from "@/lib/utils";

interface CompetitionsResponse {
  fixtureSlug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: InSeasonCompetition[];
}

interface PastFixture {
  slug: string;
  gameWeek: number;
  aasmState: string;
  endDate: string;
  scraped: boolean;
}

async function fetchLineups(
  userSlug: string,
  fixtureSlug: string | null,
): Promise<CompetitionsResponse> {
  const params = new URLSearchParams({
    userSlug,
    seasonality: "all",
  });
  if (fixtureSlug) {
    params.set("fixtureSlug", fixtureSlug);
  } else {
    params.set("type", "LIVE");
  }
  const res = await fetch(`/api/in-season/competitions?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch lineups");
  }
  return res.json();
}

async function fetchPastFixtures(): Promise<PastFixture[]> {
  const res = await fetch("/api/admin/fixtures?count=20");
  if (!res.ok) return [];
  const data = await res.json();
  return (data.fixtures ?? []) as PastFixture[];
}

export function LiveLineupsTab({
  cards,
  userSlug,
}: {
  cards: SorareCard[];
  userSlug: string;
}) {
  const [variant, setVariant] = useState<LineupCardVariant>("compact");
  // null = live (default). Otherwise a past fixture slug.
  const [selectedFixtureSlug, setSelectedFixtureSlug] = useState<string | null>(
    null,
  );

  const { data: pastFixtures } = useQuery({
    queryKey: ["past-fixtures"],
    queryFn: fetchPastFixtures,
    staleTime: 5 * 60 * 1000,
  });

  const isLive = selectedFixtureSlug === null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["in-season-competitions", userSlug, selectedFixtureSlug ?? "LIVE"],
    queryFn: () => fetchLineups(userSlug, selectedFixtureSlug),
    staleTime: isLive ? 60 * 1000 : 5 * 60 * 1000,
    refetchInterval: isLive ? 60 * 1000 : false,
    retry: 1,
  });

  // Flatten all competitions into (competition, teamIndex) tuples for filled teams,
  // then sort by: $ desc → essence desc → score desc.
  const lineups = useMemo(() => {
    if (!data?.competitions) return [];
    const result: { competition: InSeasonCompetition; teamIndex: number }[] = [];
    for (const comp of data.competitions) {
      for (let i = 0; i < comp.teams.length; i++) {
        const team = comp.teams[i];
        if (team.slots.length > 0 && team.slots.some((s) => s.cardSlug)) {
          result.push({ competition: comp, teamIndex: i });
        }
      }
    }
    result.sort((a, b) => {
      const ta = a.competition.teams[a.teamIndex];
      const tb = b.competition.teams[b.teamIndex];
      if (tb.rewardUsdCents !== ta.rewardUsdCents) {
        return tb.rewardUsdCents - ta.rewardUsdCents;
      }
      const ea = ta.rewardEssence.reduce((s, e) => s + e.quantity, 0);
      const eb = tb.rewardEssence.reduce((s, e) => s + e.quantity, 0);
      if (eb !== ea) return eb - ea;
      return (tb.totalScore ?? 0) - (ta.totalScore ?? 0);
    });
    return result;
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-zinc-800 px-3 md:px-6 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 py-2 min-w-0">
          <span className="text-xs font-medium text-zinc-300 shrink-0">
            {isLive ? "Live Lineups" : "Lineups"}
          </span>

          {/* GW selector pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            <button
              onClick={() => setSelectedFixtureSlug(null)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors shrink-0 border",
                isLive
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 border-transparent",
              )}
            >
              LIVE
            </button>
            {(pastFixtures ?? []).map((f) => (
              <button
                key={f.slug}
                onClick={() => setSelectedFixtureSlug(f.slug)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors shrink-0 border",
                  selectedFixtureSlug === f.slug
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 border-transparent",
                )}
              >
                GW{f.gameWeek}
              </button>
            ))}
          </div>

          {isLoading && (
            <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 animate-pulse shrink-0" />
          )}
          {lineups.length > 0 && (
            <span className="text-[10px] text-zinc-600 shrink-0 hidden md:inline">
              {lineups.length} lineup{lineups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Variant toggle */}
        <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-md p-0.5 shrink-0">
          <button
            onClick={() => setVariant("default")}
            className={cn(
              "p-1.5 rounded transition-colors",
              variant === "default"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300",
            )}
            title="Card view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVariant("compact")}
            className={cn(
              "p-1.5 rounded transition-colors",
              variant === "compact"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300",
            )}
            title="Compact view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <QueryError error={error instanceof Error ? error : new Error("Failed to load live lineups")} retry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LineupCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : lineups.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm text-zinc-500">
              {isLive
                ? "No live lineups this gameweek"
                : `No lineups for GW${data?.gameWeek ?? ""}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div
            className={cn(
              "grid gap-3 mx-auto",
              variant === "compact"
                ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {lineups.map(({ competition, teamIndex }) => (
              <LineupCard
                key={`${competition.slug}-${teamIndex}`}
                competition={competition}
                teamIndex={teamIndex}
                variant={variant}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
