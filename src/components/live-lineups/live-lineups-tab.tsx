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

async function fetchLiveLineups(
  userSlug: string,
): Promise<CompetitionsResponse> {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=LIVE&seasonality=all`,
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch live lineups");
  }
  return res.json();
}

export function LiveLineupsTab({
  cards,
  userSlug,
}: {
  cards: SorareCard[];
  userSlug: string;
}) {
  const [variant, setVariant] = useState<LineupCardVariant>("compact");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["in-season-competitions", userSlug, "LIVE"],
    queryFn: () => fetchLiveLineups(userSlug),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  // Flatten all competitions into (competition, teamIndex) tuples for filled teams
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
    return result;
  }, [data]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 py-2">
          <span className="text-xs font-medium text-zinc-300">
            Live Lineups
          </span>
          {data?.gameWeek && (
            <span className="text-xs text-zinc-600">GW{data.gameWeek}</span>
          )}
          {isLoading && (
            <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 animate-pulse" />
          )}
          {lineups.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              {lineups.length} lineup{lineups.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Variant toggle */}
        <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
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
        <div className="flex-1 overflow-y-auto p-4">
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
              No live lineups this gameweek
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
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
