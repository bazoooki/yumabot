// Shared with `src/components/results/streak-achievements-panel.tsx`. Keep
// in sync — the canonical map lives at the canonical knowledge-base entry
// `10-domain-competitions.md`.

const LEAGUE_FLAGS: Record<string, string> = {
  "Premier League": "🇬🇧",
  Bundesliga: "🇩🇪",
  "Ligue 1": "🇫🇷",
  "La Liga": "🇪🇸",
  LaLiga: "🇪🇸",
  Eredivisie: "🇳🇱",
  "J1 League": "🇯🇵",
  "K League 1": "🇰🇷",
  MLS: "🇺🇸",
  "Jupiler Pro League": "🇧🇪",
  Challenger: "🌍",
  Contender: "🏆",
  European: "🌐",
};

export function flagFor(league: string): string | null {
  if (LEAGUE_FLAGS[league]) return LEAGUE_FLAGS[league];
  for (const [name, flag] of Object.entries(LEAGUE_FLAGS)) {
    if (league.toLowerCase().includes(name.toLowerCase())) return flag;
  }
  return null;
}
