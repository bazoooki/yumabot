import type {
  InSeasonCompetition,
  RarityType,
  SorareCard,
} from "@/lib/types";

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
 * Whether a `So5LeaderboardType` (e.g. `IN_SEASON_CHALLENGERS_LIMITED`,
 * `IN_SEASON_CONTENDERS_RARE`) belongs to one of Sorare's cross-league streak
 * comps. Used by `isCardEligibleFor` to swap from displayName matching to
 * exact leaderboard-type matching — `displayName` on cross-league tracks is
 * the underlying domestic league (e.g. "Primeira Liga") rather than the
 * cross-league name, so name matching breaks for these comps.
 */
export function isCrossLeagueLeaderboardType(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  return type.includes("_CHALLENGERS_") || type.includes("_CONTENDERS_");
}

/**
 * Whether a card itself is in-season (newest-season edition), independent of
 * any competition. Use this when picking lineups — Sorare allows max 1 classic
 * card per in-season lineup, so the picker needs a card-level signal.
 *
 * The boolean `inSeasonEligible` is the same field Sorare's own card picker
 * uses (their internal `tournamentLineupCards` filter sends
 * `inSeasonEligible: true` to scope to in-season cards). Keep this helper as
 * the single source of truth so a future signal change is one edit.
 *
 * Do NOT confuse this with `entrySo5Leaderboard.seasonality` on a track —
 * that describes the *competition*, not the card. A classic card can still
 * have IN_SEASON tracks because Sorare allows it 1 slot in an in-season
 * lineup; using the track's seasonality as a card-level filter leaks
 * classic cards into AI suggestions.
 */
export function isCardInSeason(card: SorareCard): boolean {
  return card.inSeasonEligible === true;
}

export interface EligibilityCriteria {
  mainRarityType: RarityType;
  leagueName: string;
  /** "IN_SEASON" or "CLASSIC". */
  seasonality: string;
  /** Sorare's leaderboard-type enum (e.g. `IN_SEASON_CHALLENGERS_LIMITED`).
   *  Required for correct cross-league matching — see below. */
  so5LeaderboardType?: string | null;
}

/**
 * Whether a card is eligible for a leaderboard matching the given criteria.
 *
 * Two match strategies depending on the competition:
 *
 *   1. **Cross-league comps** (Challenger / Contender) — match by exact
 *      `track.entrySo5Leaderboard.so5LeaderboardType`. Sorare emits one track
 *      per leaderboard the card can actually play in, so the type match is
 *      authoritative — no need to maintain a list of permitted leagues. The
 *      old shortcut (skip displayName, allow any IN_SEASON track at the
 *      right rarity) was wrong: it let any in-season Limited card pass for
 *      Challenger, exploding the eligible count to 1k+.
 *
 *   2. **Single-league comps** — match by `(seasonality, mainRarityType,
 *      so5League.displayName)`. Seasonality is critical: a player can have
 *      both an IN_SEASON track (newest card) and a CLASSIC track (older
 *      card); without the filter classic cards leak into the in-season pool.
 *
 * Do NOT fall back to `activeClub.domesticLeague` for league matching —
 * misses loanees / dual-eligible cards.
 */
export function isCardEligibleFor(
  card: SorareCard,
  { mainRarityType, leagueName, seasonality, so5LeaderboardType }: EligibilityCriteria,
): boolean {
  if (card.rarityTyped !== mainRarityType) return false;

  const tracks = card.eligibleUpcomingLeagueTracks ?? [];
  if (tracks.length === 0) return false;

  const matchesSeasonality = (t: { entrySo5Leaderboard: { seasonality: string } }) =>
    t.entrySo5Leaderboard.seasonality === seasonality;

  if (isCrossLeagueLeaderboardType(so5LeaderboardType)) {
    return tracks.some(
      (t) =>
        matchesSeasonality(t) &&
        t.entrySo5Leaderboard.so5LeaderboardType === so5LeaderboardType,
    );
  }

  return tracks.some(
    (t) =>
      matchesSeasonality(t) &&
      t.entrySo5Leaderboard.mainRarityType === mainRarityType &&
      t.entrySo5Leaderboard.so5League.displayName === leagueName,
  );
}

/**
 * Convenience wrapper around `isCardEligibleFor` for an `InSeasonCompetition`.
 */
export function isEligibleForCompetition(
  card: SorareCard,
  comp: InSeasonCompetition,
): boolean {
  return isCardEligibleFor(card, {
    mainRarityType: comp.mainRarityType,
    leagueName: comp.leagueName,
    seasonality: comp.seasonality,
    so5LeaderboardType: comp.so5LeaderboardType,
  });
}
