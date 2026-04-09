/** Leaderboard names where we only want Div 1 and Div 2 */
const DIV2_MAX_KEYWORDS = [
  "all star",
  "under 23",
  "champion",
  "contender",
  "challenger",
  "retro",
];

/**
 * Returns true if this leaderboard should be scraped.
 * Filters out Div 3+ for cross-league / secondary competitions.
 */
export function shouldScrapeLeaderboard(
  displayName: string,
  leagueName: string,
  division: number,
): boolean {
  if (division <= 2) return true;

  const nameLower = `${displayName} ${leagueName}`.toLowerCase();
  const isSecondary = DIV2_MAX_KEYWORDS.some((kw) => nameLower.includes(kw));
  return !isSecondary;
}
