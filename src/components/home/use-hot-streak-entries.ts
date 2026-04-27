import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  InSeasonCompetition,
  InSeasonTeam,
  InSeasonStreak,
  RarityType,
} from "@/lib/types";
import type { MyStreaksResponse } from "@/app/api/in-season/my-streaks/route";
import type { PlayedTracksResponse } from "@/app/api/in-season/played-tracks/route";

/**
 * One row per (league, rarity). All divisions the user plays in that pair are
 * merged into the same entry (thresholds are the same across divisions within
 * a league+rarity).
 */
export interface HotStreakEntry {
  key: string; // `${leagueName}::${mainRarityType}` — stable across fixtures
  leagueName: string;
  mainRarityType: RarityType;
  iconUrl: string | null;
  streak: InSeasonStreak | null;
  liveDivisions: Array<{
    division: number;
    competition: InSeasonCompetition;
    activeTeams: InSeasonTeam[];
  }>;
  hasLiveLineup: boolean;
}

async function fetchMyStreaks(): Promise<MyStreaksResponse | null> {
  const res = await fetch(`/api/in-season/my-streaks`);
  if (!res.ok) return null;
  return (await res.json()) as MyStreaksResponse;
}

async function fetchPlayedTracks(
  userSlug: string,
): Promise<PlayedTracksResponse | null> {
  const res = await fetch(
    `/api/in-season/played-tracks?userSlug=${encodeURIComponent(userSlug)}&fixtures=6`,
  );
  if (!res.ok) return null;
  return (await res.json()) as PlayedTracksResponse;
}

interface UseHotStreakEntriesResult {
  entries: HotStreakEntry[];
  gameWeek: number | undefined;
  loading: boolean;
}

/**
 * Merge LIVE in-season competitions, upcoming in-season metadata, and the
 * user's recent played-tracks history into a single per-(league, rarity) list.
 * Consumed by both HotStreaksPanel and AISuggestionsPanel so they show the
 * same set of competitions.
 */
export function useHotStreakEntries({
  liveCompetitions,
  liveLoading,
  liveGameWeek,
  userSlug,
}: {
  liveCompetitions: InSeasonCompetition[] | undefined;
  liveLoading: boolean;
  liveGameWeek: number | undefined;
  userSlug: string;
}): UseHotStreakEntriesResult {
  const { data: myStreaksData, isLoading: myStreaksLoading } = useQuery({
    queryKey: ["in-season-my-streaks"],
    queryFn: fetchMyStreaks,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: playedTracksData, isLoading: playedLoading } = useQuery({
    queryKey: ["in-season-played-tracks", userSlug],
    queryFn: () => fetchPlayedTracks(userSlug),
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(userSlug),
  });

  const entries = useMemo<HotStreakEntry[]>(() => {
    const inSeasonLive = (liveCompetitions ?? []).filter(
      (c) => c.seasonality === "IN_SEASON",
    );

    // Authoritative set of in-season (leagueName, rarity) keys for the
    // upcoming GW. Used to drop arena/leaderboard-only comps like "All Star",
    // "Champion", "European Leagues" that can appear in LIVE or played-tracks
    // but aren't real in-season tracks.
    //
    // Keyed by `leagueName` — NOT `leagueSlug` — because Sorare's league slug
    // is fixture-scoped so slugs from UPCOMING and LIVE never match.
    const upcomingInSeasonKeys = new Set<string>();
    for (const meta of myStreaksData?.competitions ?? []) {
      upcomingInSeasonKeys.add(`${meta.leagueName}::${meta.mainRarityType}`);
    }
    const isInSeasonKey = (leagueName: string, rarity: string): boolean => {
      if (upcomingInSeasonKeys.size === 0) return true;
      return upcomingInSeasonKeys.has(`${leagueName}::${rarity}`);
    };

    const out = new Map<string, HotStreakEntry>();
    const seedEntry = (
      leagueName: string,
      rarity: RarityType,
      iconUrl: string | null,
    ): HotStreakEntry => {
      const key = `${leagueName}::${rarity}`;
      let entry = out.get(key);
      if (!entry) {
        entry = {
          key,
          leagueName,
          mainRarityType: rarity,
          iconUrl,
          streak: null,
          liveDivisions: [],
          hasLiveLineup: false,
        };
        out.set(key, entry);
      } else if (!entry.iconUrl && iconUrl) {
        entry.iconUrl = iconUrl;
      }
      return entry;
    };

    for (const live of inSeasonLive) {
      if (!isInSeasonKey(live.leagueName, live.mainRarityType)) continue;
      const entry = seedEntry(
        live.leagueName,
        live.mainRarityType,
        live.iconUrl ?? null,
      );
      if (!entry.streak && live.streak && live.streak.thresholds.length > 0) {
        entry.streak = live.streak;
      }
      const activeTeams = live.teams.filter((t) =>
        t.slots.some((s) => s.cardSlug),
      );
      if (activeTeams.length > 0) {
        entry.liveDivisions.push({
          division: live.division,
          competition: live,
          activeTeams,
        });
        entry.hasLiveLineup = true;
      }
    }

    for (const t of playedTracksData?.tracks ?? []) {
      if (!isInSeasonKey(t.leagueName, t.mainRarityType)) continue;
      seedEntry(t.leagueName, t.mainRarityType as RarityType, null);
    }

    for (const meta of myStreaksData?.competitions ?? []) {
      const key = `${meta.leagueName}::${meta.mainRarityType}`;
      const entry = out.get(key);
      if (!entry) continue;
      if (!entry.iconUrl) entry.iconUrl = meta.iconUrl;
    }

    for (const entry of out.values()) {
      entry.liveDivisions.sort((a, b) => a.division - b.division);
    }

    const result = Array.from(out.values());
    result.sort((a, b) => {
      if (a.hasLiveLineup !== b.hasLiveLineup)
        return a.hasLiveLineup ? -1 : 1;
      const aStreak = a.streak ? 1 : 0;
      const bStreak = b.streak ? 1 : 0;
      if (aStreak !== bStreak) return bStreak - aStreak;
      const aLvl = a.streak?.currentLevel ?? 0;
      const bLvl = b.streak?.currentLevel ?? 0;
      if (aLvl !== bLvl) return bLvl - aLvl;
      return a.leagueName.localeCompare(b.leagueName);
    });

    return result;
  }, [myStreaksData, liveCompetitions, playedTracksData]);

  return {
    entries,
    gameWeek: myStreaksData?.gameWeek ?? liveGameWeek,
    loading: liveLoading || myStreaksLoading || playedLoading,
  };
}
