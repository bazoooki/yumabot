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
  /** Sorare's leaderboard-type enum (e.g. `IN_SEASON_CHALLENGERS_LIMITED`).
   *  Used by the eligibility check to match cards by track-type for
   *  cross-league competitions where displayName matching doesn't work. */
  so5LeaderboardType: string | null;
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

interface OpenLineupsResponse {
  fixtureSlug: string;
  gameWeek: number;
  endDate: string;
  aasmState: string;
  competitions: InSeasonCompetition[];
}

/**
 * Fetch the user's existing lineups for an arbitrary fixture (typically the
 * UPCOMING one). Backed by `IN_SEASON_BY_FIXTURE_QUERY`, which returns the
 * same `userFixtureResults` shape as the LIVE query but for any fixture
 * slug — exactly what we need between GWs when LIVE is empty/stale.
 */
async function fetchOpenLineups(
  userSlug: string,
  fixtureSlug: string,
): Promise<OpenLineupsResponse | null> {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&fixtureSlug=${encodeURIComponent(fixtureSlug)}&seasonality=all`,
  );
  if (!res.ok) return null;
  return (await res.json()) as OpenLineupsResponse;
}

interface StreakEntriesResult {
  entries: HotStreakEntry[];
  gameWeek: number | undefined;
  loading: boolean;
}

// ─── LIVE mode — drives the "My Hot Streaks" panel (current GW) ───

/**
 * Build entries for the gameweek currently being played. Source of truth is
 * the user's LIVE in-season competitions plus their lineups in the open
 * upcoming fixture (LIVE wins on conflict, OPEN fills gaps for the
 * between-GW state). We do NOT seed from played-tracks here — see the
 * comment in the merge block.
 */
export function useLiveStreakEntries({
  liveCompetitions,
  liveLoading,
  liveGameWeek,
  userSlug,
}: {
  liveCompetitions: InSeasonCompetition[] | undefined;
  liveLoading: boolean;
  liveGameWeek: number | undefined;
  userSlug: string;
}): StreakEntriesResult {
  // Sorare's `?type=LIVE` returns the *currently-playing* fixture. Between
  // gameweeks (after a GW closes and before the next kicks off) it has no
  // games scheduled, so it returns the previously-closed fixture — which
  // typically does NOT contain the lineups the user just submitted for the
  // upcoming GW. Pull those via the upcoming-fixture slug from my-streaks
  // and merge below so the panel reflects the manager's current state.
  const { data: myStreaksData, isLoading: myStreaksLoading } = useQuery({
    queryKey: ["in-season-my-streaks"],
    queryFn: fetchMyStreaks,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const upcomingFixtureSlug = myStreaksData?.fixtureSlug ?? null;

  const { data: openLineupsData, isLoading: openLoading } = useQuery({
    queryKey: ["in-season-competitions", userSlug, "OPEN", upcomingFixtureSlug],
    queryFn: () => fetchOpenLineups(userSlug, upcomingFixtureSlug!),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    enabled: Boolean(userSlug) && Boolean(upcomingFixtureSlug),
  });

  const entries = useMemo<HotStreakEntry[]>(() => {
    const out = new Map<string, HotStreakEntry>();
    const seedEntry = (
      leagueName: string,
      rarity: RarityType,
      iconUrl: string | null,
      so5LeaderboardType: string | null,
    ): HotStreakEntry => {
      const key = `${leagueName}::${rarity}`;
      let entry = out.get(key);
      if (!entry) {
        entry = {
          key,
          leagueName,
          mainRarityType: rarity,
          so5LeaderboardType,
          iconUrl,
          streak: null,
          liveDivisions: [],
          hasLiveLineup: false,
        };
        out.set(key, entry);
      } else {
        if (!entry.iconUrl && iconUrl) entry.iconUrl = iconUrl;
        if (!entry.so5LeaderboardType && so5LeaderboardType) {
          entry.so5LeaderboardType = so5LeaderboardType;
        }
      }
      return entry;
    };

    /** Fold a competition into the entries map, dedup'd by leaderboard slug
     *  so we don't show the same lineup twice when LIVE and UPCOMING both
     *  return the same closed-GW fixture. */
    const seenLeaderboardSlugs = new Set<string>();
    const ingest = (comp: InSeasonCompetition) => {
      if (comp.seasonality !== "IN_SEASON") return;
      if (!isStreakLeaderboardType(comp.so5LeaderboardType)) return;
      if (seenLeaderboardSlugs.has(comp.slug)) return;
      seenLeaderboardSlugs.add(comp.slug);

      const entry = seedEntry(
        comp.leagueName,
        comp.mainRarityType,
        comp.iconUrl ?? null,
        comp.so5LeaderboardType ?? null,
      );
      if (!entry.streak && comp.streak && comp.streak.thresholds.length > 0) {
        entry.streak = comp.streak;
      }
      const activeTeams = comp.teams.filter((t) =>
        t.slots.some((s) => s.cardSlug),
      );
      if (activeTeams.length > 0) {
        entry.liveDivisions.push({
          division: comp.division,
          competition: comp,
          activeTeams,
        });
        entry.hasLiveLineup = true;
      }
    };

    // LIVE first — when a GW is actually being played, its scoring data is
    // what the user wants to see. UPCOMING then fills in any leaderboards
    // that didn't appear in LIVE (e.g. between-GW state, or leagues whose
    // schedule didn't overlap the live window).
    //
    // We deliberately do NOT seed from `played-tracks` here. That endpoint
    // returns leaderboards the user touched in *recent* GWs, not the ones
    // they're currently playing — so it surfaces stale rows like "MLS
    // LIMITED" when the user's last MLS lineup was 6 GWs ago. Keeping the
    // panel grounded in LIVE + OPEN contender data avoids those false
    // positives.
    for (const live of liveCompetitions ?? []) ingest(live);
    for (const open of openLineupsData?.competitions ?? []) ingest(open);

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
  }, [liveCompetitions, openLineupsData]);

  // Prefer the gameweek of whichever source actually has the user's
  // lineups: if openLineups has the fixture they just submitted to, surface
  // that GW number; otherwise fall back to the LIVE GW Sorare reported.
  const openHasLineups = (openLineupsData?.competitions ?? []).some((c) =>
    c.teams.some((t) => t.slots.some((s) => s.cardSlug)),
  );
  const displayGameWeek = openHasLineups
    ? (openLineupsData?.gameWeek ?? liveGameWeek)
    : liveGameWeek;

  return {
    entries,
    gameWeek: displayGameWeek,
    loading: liveLoading || myStreaksLoading || openLoading,
  };
}

// ─── UPCOMING mode — drives the "Next GW AI Suggestions" panel ───

/**
 * Build entries for the upcoming gameweek (the one the user is about to
 * submit a lineup for). Source of truth is `my-streaks` (Sorare's UPCOMING
 * fixture). We enrich each entry with the user's current streak progress
 * from LIVE so AI suggestions aim at the right next-up level — without LIVE
 * we have no signal that the user already cleared Lv.2 and should be
 * targeting Lv.3.
 */
export function useUpcomingStreakEntries({
  liveCompetitions,
  userSlug,
}: {
  liveCompetitions: InSeasonCompetition[] | undefined;
  userSlug: string;
}): StreakEntriesResult {
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
    // Build a (leagueName, rarity) → live streak lookup so we can stamp
    // the user's progression onto upcoming entries. LIVE comps are the only
    // source of `thresholds` data the my-streaks endpoint can't return.
    const liveStreakByKey = new Map<string, InSeasonStreak>();
    const liveIconByKey = new Map<string, string>();
    for (const live of liveCompetitions ?? []) {
      if (live.seasonality !== "IN_SEASON") continue;
      const key = `${live.leagueName}::${live.mainRarityType}`;
      if (live.streak && live.streak.thresholds.length > 0) {
        const existing = liveStreakByKey.get(key);
        if (!existing) liveStreakByKey.set(key, live.streak);
      }
      if (!liveIconByKey.has(key) && live.iconUrl) {
        liveIconByKey.set(key, live.iconUrl);
      }
    }

    const out = new Map<string, HotStreakEntry>();
    const seedEntry = (
      leagueName: string,
      rarity: RarityType,
      iconUrl: string | null,
      so5LeaderboardType: string | null,
    ): HotStreakEntry => {
      const key = `${leagueName}::${rarity}`;
      let entry = out.get(key);
      if (!entry) {
        entry = {
          key,
          leagueName,
          mainRarityType: rarity,
          so5LeaderboardType,
          iconUrl: iconUrl ?? liveIconByKey.get(key) ?? null,
          streak: liveStreakByKey.get(key) ?? null,
          liveDivisions: [],
          hasLiveLineup: false,
        };
        out.set(key, entry);
      } else {
        if (!entry.iconUrl && iconUrl) entry.iconUrl = iconUrl;
        if (!entry.so5LeaderboardType && so5LeaderboardType) {
          entry.so5LeaderboardType = so5LeaderboardType;
        }
      }
      return entry;
    };

    // Authoritative upcoming list — these are the comps the user can submit
    // a lineup for next GW.
    for (const meta of myStreaksData?.competitions ?? []) {
      if (!isStreakLeaderboardType(meta.so5LeaderboardType)) continue;
      seedEntry(
        meta.leagueName,
        meta.mainRarityType,
        meta.iconUrl,
        meta.so5LeaderboardType,
      );
    }

    // Played-tracks fills in icons / seeds entries that haven't loaded
    // through my-streaks yet (e.g. cross-league comps the user's history
    // proves they're playing).
    for (const t of playedTracksData?.tracks ?? []) {
      seedEntry(t.leagueName, t.mainRarityType as RarityType, null, null);
    }

    const result = Array.from(out.values());
    result.sort((a, b) => {
      const aLvl = a.streak?.currentLevel ?? 0;
      const bLvl = b.streak?.currentLevel ?? 0;
      if (aLvl !== bLvl) return bLvl - aLvl;
      return a.leagueName.localeCompare(b.leagueName);
    });

    return result;
  }, [myStreaksData, playedTracksData, liveCompetitions]);

  return {
    entries,
    gameWeek: myStreaksData?.gameWeek,
    loading: myStreaksLoading || playedLoading,
  };
}
