"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import type { SorareCard, InSeasonCompetition } from "@/lib/types";
import { useInSeasonStore, useSelectedCompetition } from "@/lib/in-season-store";
import { CompetitionSelector } from "./competition-selector";
import { InSeasonMain } from "./in-season-main";
import { cn } from "@/lib/utils";

type FixtureMode = "UPCOMING" | "LIVE";

interface CompetitionsResponse {
  fixtureSlug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: InSeasonCompetition[];
}

async function fetchCompetitions(
  userSlug: string,
  type: string,
): Promise<CompetitionsResponse> {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=${type}`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch competitions");
  }
  return res.json();
}

export function InSeasonTab({
  cards,
  userSlug,
}: {
  cards: SorareCard[];
  userSlug: string;
}) {
  const [fixtureMode, setFixtureMode] = useState<FixtureMode>("UPCOMING");
  const setCompetitions = useInSeasonStore((s) => s.setCompetitions);
  const competitions = useInSeasonStore((s) => s.competitions);
  const selected = useSelectedCompetition();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["in-season-competitions", userSlug, fixtureMode],
    queryFn: () => fetchCompetitions(userSlug, fixtureMode),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Sync API data into the store
  useEffect(() => {
    if (data?.competitions) {
      setCompetitions(
        data.competitions,
        data.fixtureSlug,
        data.gameWeek,
      );
    }
  }, [data, setCompetitions]);

  // Reset selection when switching modes
  const handleModeChange = (mode: FixtureMode) => {
    if (mode === fixtureMode) return;
    setFixtureMode(mode);
    useInSeasonStore.setState({ selectedCompSlug: null, selectedTeamIndex: 0 });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Fixture mode tabs */}
      <div className="border-b border-zinc-800 px-3 md:px-6 flex items-center gap-1 shrink-0">
        {([
          { key: "UPCOMING" as const, label: "Next GW" },
          { key: "LIVE" as const, label: "Current GW" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleModeChange(tab.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors",
              fixtureMode === tab.key
                ? "text-amber-300 border-b-2 border-amber-400"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
            {data && fixtureMode === tab.key && data.gameWeek && (
              <span className="ml-1.5 text-zinc-600">GW{data.gameWeek}</span>
            )}
          </button>
        ))}
        {isLoading && (
          <Skeleton className="w-3.5 h-3.5 rounded-full ml-2" />
        )}
      </div>

      {/* Content */}
      {error ? (
        <QueryError error={error instanceof Error ? error : new Error("Failed to load in-season data")} retry={() => void refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar skeleton */}
          <div className="flex md:flex-col md:w-64 md:border-r border-b md:border-b-0 border-zinc-800 p-3 md:p-4 gap-2 md:gap-0 md:space-y-3 overflow-x-auto md:overflow-y-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-zinc-900 space-y-2 shrink-0 min-w-[140px] md:min-w-0">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
          {/* Main content skeleton */}
          <div className="flex-1 p-4 md:p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ) : competitions.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm text-zinc-500">
              No in-season competitions found for this gameweek
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <CompetitionSelector
            competitions={competitions}
            gameWeek={data?.gameWeek ?? null}
          />
          {selected ? (
            <InSeasonMain comp={selected} cards={cards} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              Select a competition
            </div>
          )}
        </div>
      )}
    </div>
  );
}
