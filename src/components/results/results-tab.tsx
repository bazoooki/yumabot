"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy, Award, Shield, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { useResultsStore } from "@/lib/results-store";
import type { LeaderboardSummary, Achievement } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GameweekSelector } from "./gameweek-selector";
import { FetchTrigger } from "./fetch-trigger";
import { PodiumsSection } from "./podiums-section";
import { AchievementsSection } from "./achievements-section";
import { ClanSection } from "./clan-section";
import { UserEarningsSection } from "./user-earnings-section";
import { StreakAchievementsPanel } from "./streak-achievements-panel";

interface ResultsResponse {
  gameWeek: number;
  fixtureSlug: string;
  leaderboards: LeaderboardSummary[];
}

interface AchievementsResponse {
  gameWeek: number;
  achievements: Achievement[];
}

async function fetchResults(gameWeek?: number): Promise<ResultsResponse> {
  const url = gameWeek
    ? `/api/results?gameWeek=${gameWeek}`
    : "/api/results";
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch results");
  }
  return res.json();
}

async function fetchAchievements(
  gameWeek?: number,
): Promise<AchievementsResponse> {
  const url = gameWeek
    ? `/api/results/achievements?gameWeek=${gameWeek}`
    : "/api/results/achievements";
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch achievements");
  }
  return res.json();
}

async function fetchGameweeks(): Promise<number[]> {
  const res = await fetch("/api/results/gameweeks");
  if (!res.ok) return [];
  const data = await res.json();
  return data.gameWeeks ?? [];
}

const SECTIONS = [
  { key: "podiums" as const, label: "Podiums", icon: Trophy },
  { key: "achievements" as const, label: "Achievements", icon: Award },
  { key: "earnings" as const, label: "Earnings", icon: DollarSign },
  { key: "clan" as const, label: "Clan", icon: Shield },
];

export function ResultsTab() {
  const store = useResultsStore();
  const clanSlugs = useMemo(
    () => new Set(CLAN_MEMBERS.map((m) => m.slug)),
    [],
  );

  // Fetch available gameweeks
  const { data: gameWeeks, refetch: refetchGWs } = useQuery({
    queryKey: ["results-gameweeks"],
    queryFn: fetchGameweeks,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (gameWeeks) store.setAvailableGameWeeks(gameWeeks);
  }, [gameWeeks, store.setAvailableGameWeeks]);

  // Auto-select latest GW
  const selectedGW = store.gameWeek ?? gameWeeks?.[0] ?? null;

  // Fetch results for selected GW
  const {
    data: results,
    isLoading: resultsLoading,
    error: resultsError,
    refetch: refetchResults,
  } = useQuery({
    queryKey: ["results", selectedGW],
    queryFn: () => fetchResults(selectedGW ?? undefined),
    enabled: selectedGW !== null,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch achievements for selected GW
  const { data: achievementsData } = useQuery({
    queryKey: ["results-achievements", selectedGW],
    queryFn: () => fetchAchievements(selectedGW ?? undefined),
    enabled: selectedGW !== null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (results) {
      store.setResults(
        results.gameWeek,
        results.fixtureSlug,
        results.leaderboards,
      );
    }
  }, [results, store.setResults]);

  useEffect(() => {
    if (achievementsData) {
      store.setAchievements(achievementsData.achievements);
    }
  }, [achievementsData, store.setAchievements]);

  const handleFetchComplete = () => {
    void refetchGWs();
    void refetchResults();
  };

  const hasData = (gameWeeks?.length ?? 0) > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-zinc-800 px-3 md:px-6 py-2 flex items-center gap-3 shrink-0">
        <Medal className="w-4 h-4 text-emerald-400 shrink-0" />
        <h1 className="text-sm font-semibold text-zinc-200">Results</h1>

        {/* Section tabs */}
        {hasData && (
          <div className="flex items-center gap-0.5 ml-4 bg-zinc-900 rounded-md p-0.5">
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => store.setActiveSection(section.key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                  store.activeSection === section.key
                    ? "bg-zinc-700 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                <section.icon className="w-3 h-3" />
                {section.label}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto">
          <FetchTrigger onComplete={handleFetchComplete} />
        </div>
      </div>

      {/* GW selector */}
      {hasData && (
        <div className="px-3 md:px-6 py-2 border-b border-zinc-800">
          <GameweekSelector
            available={store.availableGameWeeks}
            selected={selectedGW}
            onSelect={(gw) =>
              store.setResults(gw, store.fixtureSlug ?? "", store.leaderboards)
            }
          />
        </div>
      )}

      {/* Content: left (existing sections) + right (streak achievements panel) */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 md:p-6 min-w-0">
          {resultsError ? (
            <QueryError
              error={
                resultsError instanceof Error
                  ? resultsError
                  : new Error("Failed to load results")
              }
              retry={() => void refetchResults()}
            />
          ) : resultsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Medal className="w-10 h-10 text-zinc-600" />
              <p className="text-sm text-zinc-500 text-center">
                No results fetched yet.
                <br />
                Click &quot;Fetch Results&quot; to load the current GW
                leaderboards.
              </p>
            </div>
          ) : (
            <>
              {store.activeSection === "podiums" && (
                <PodiumsSection
                  leaderboards={store.leaderboards}
                  clanSlugs={clanSlugs}
                />
              )}
              {store.activeSection === "achievements" && (
                <AchievementsSection achievements={store.achievements} />
              )}
              {store.activeSection === "earnings" && (
                <UserEarningsSection gameWeek={selectedGW} />
              )}
              {store.activeSection === "clan" && (
                <ClanSection leaderboards={store.leaderboards} />
              )}
            </>
          )}
        </div>

        {/* Right side: Manager Achievements panel (streak clearance counts) */}
        {hasData && (
          <aside className="hidden lg:flex flex-col w-[360px] xl:w-[400px] shrink-0 border-l border-zinc-800 bg-zinc-950/30 p-3 md:p-4 overflow-hidden">
            <StreakAchievementsPanel gameWeek={selectedGW} />
          </aside>
        )}
      </div>
    </div>
  );
}
