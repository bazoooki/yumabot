import type { SorareCard, UpcomingGame } from "@/lib/types";

export interface OwnedPlayerInfo {
  playerSlug: string;
  displayName: string;
  cardCount: number;
  rarities: string[];
  upcomingGame: UpcomingGame | null;
  clubName: string | null;
}

export interface PortfolioIndex {
  bySlug: Map<string, OwnedPlayerInfo>;
  byName: Map<string, string>; // lowercase displayName → playerSlug
}

const TRADEABLE_RARITIES = new Set(["limited", "rare", "super_rare", "unique"]);

export function buildPortfolioIndex(cards: SorareCard[]): PortfolioIndex {
  const bySlug = new Map<string, OwnedPlayerInfo>();
  const byName = new Map<string, string>();

  for (const card of cards) {
    if (!TRADEABLE_RARITIES.has(card.rarityTyped)) continue;
    const player = card.anyPlayer;
    if (!player) continue;

    const slug = player.slug;
    const existing = bySlug.get(slug);

    if (existing) {
      existing.cardCount++;
      if (!existing.rarities.includes(card.rarityTyped)) {
        existing.rarities.push(card.rarityTyped);
      }
      // Keep the first upcoming game found
      if (!existing.upcomingGame && player.activeClub?.upcomingGames?.[0]) {
        existing.upcomingGame = player.activeClub.upcomingGames[0];
      }
    } else {
      bySlug.set(slug, {
        playerSlug: slug,
        displayName: player.displayName,
        cardCount: 1,
        rarities: [card.rarityTyped],
        upcomingGame: player.activeClub?.upcomingGames?.[0] || null,
        clubName: player.activeClub?.name || null,
      });
    }

    byName.set(player.displayName.toLowerCase(), slug);
  }

  return { bySlug, byName };
}

export function lookupOwned(
  portfolio: PortfolioIndex,
  playerSlug: string,
  playerName: string
): OwnedPlayerInfo | undefined {
  return (
    portfolio.bySlug.get(playerSlug) ||
    portfolio.bySlug.get(portfolio.byName.get(playerName.toLowerCase()) || "")
  );
}
