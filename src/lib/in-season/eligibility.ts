import type { InSeasonCompetition, SorareCard } from "@/lib/types";

const CROSS_LEAGUE_KEYWORDS = ["challenger", "contender", "european", "global"];

/**
 * Stable, fixture-independent slug for a league name. Sorare's `so5League.slug`
 * (and the outer `so5Leagues.slug`) is sometimes scoped to the fixture (e.g.
 * `football-24-28-apr-2026-seasonal-germany`) which makes URLs unstable when
 * switching GWs. Use this on the way OUT of the API parsers so anything we
 * compare or put into a URL is consistent across weeks.
 */
export function slugifyLeague(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isCrossLeagueCompetition(leagueName: string): boolean {
  const lower = leagueName.toLowerCase();
  return CROSS_LEAGUE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Whether a card is eligible to enter the given in-season competition.
 *
 * Authoritative rule: walk `eligibleUpcomingLeagueTracks` and look for a
 * matching `(mainRarityType, so5League.displayName)`. Do NOT fall back to
 * `inSeasonEligible` or `activeClub.domesticLeague` — both are stale and
 * miss loanees / dual-eligible cards.
 */
export function isEligibleForCompetition(
  card: SorareCard,
  comp: InSeasonCompetition,
): boolean {
  if (card.rarityTyped !== comp.mainRarityType) return false;

  const tracks = card.eligibleUpcomingLeagueTracks ?? [];
  if (tracks.length === 0) return false;

  if (isCrossLeagueCompetition(comp.leagueName)) {
    return tracks.some(
      (t) => t.entrySo5Leaderboard.mainRarityType === comp.mainRarityType,
    );
  }

  return tracks.some(
    (t) =>
      t.entrySo5Leaderboard.mainRarityType === comp.mainRarityType &&
      t.entrySo5Leaderboard.so5League.displayName === comp.leagueName,
  );
}
