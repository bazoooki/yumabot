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

/**
 * Sorare flags some arena/exhibition leaderboards (CHAMPIONS, GLOBAL_ALL_STAR,
 * etc.) as `seasonality: IN_SEASON`, but they aren't part of the streak ladder
 * the home page is meant to surface. The user's authoritative list is the
 * country-specific streak comps plus the cross-league CHALLENGER and CONTENDER
 * tiers — everything in `So5LeaderboardType` named like
 * `IN_SEASON_<COUNTRY>_<RARITY>`, `IN_SEASON_CHALLENGERS_*`,
 * `IN_SEASON_CONTENDERS_*`, plus the `IN_SEASON_*_THRESHOLDS_STREAK` US
 * variants. Anything else (CHAMPIONS, ALL_STAR, etc.) is filtered out.
 */
function isStreakLeaderboardType(type: string | null | undefined): boolean {
  if (!type) return false;
  if (!type.startsWith("IN_SEASON_")) return false;
  if (type.includes("_CHAMPIONS_")) return false;
  if (type.includes("_ALL_STAR")) return false;
  if (type.includes("_GLOBAL_")) return false;
  return true;
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
    // upcoming GW, filtered to leaderboard types that participate in the
    // streak ladder (drops CHAMPIONS / ALL_STAR / GLOBAL — Sorare reports
    // these as `seasonality: IN_SEASON` but the workspace's "real in-season"
    // view excludes them, and the user wants the home page to match).
    //
    // Keyed by `leagueName` — NOT `leagueSlug` — because Sorare's league slug
    // is fixture-scoped so slugs from UPCOMING and LIVE never match.
    const upcomingInSeasonKeys = new Set<string>();
    for (const meta of myStreaksData?.competitions ?? []) {
      if (!isStreakLeaderboardType(meta.so5LeaderboardType)) continue;
      upcomingInSeasonKeys.add(`${meta.leagueName}::${meta.mainRarityType}`);
    }
    // If my-streaks hasn't returned yet (or failed), don't fall through to
    // "let everything through" — that's how arena comps like "European
    // Leagues" leak in from the LIVE fixture. Show nothing until we know.
    const haveAuthoritativeList = upcomingInSeasonKeys.size > 0;
    const isInSeasonKey = (leagueName: string, rarity: string): boolean => {
      if (!haveAuthoritativeList) return false;
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

    // Always seed cross-league streak comps (Challenger / Contender) for
    // every rarity in the upcoming fixture. They aggregate lower- and
    // mid-tier leagues — any user with cards in those leagues can play
    // them — so they shouldn't be gated on LIVE lineup or played-tracks
    // history the way single-league comps are.
    for (const meta of myStreaksData?.competitions ?? []) {
      const type = meta.so5LeaderboardType ?? "";
      const isCrossLeagueStreak =
        type.includes("_CHALLENGERS_") || type.includes("_CONTENDERS_");
      if (!isCrossLeagueStreak) continue;
      seedEntry(meta.leagueName, meta.mainRarityType, meta.iconUrl);
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
