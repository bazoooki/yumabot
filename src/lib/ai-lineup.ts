import type { SorareCard } from "./types";

export interface ScoredCard {
  card: SorareCard;
  expectedPoints: number;
  editionBonus: number;
  editionLabel: string;
  hasGame: boolean;
  isHome: boolean;
  isInjured: boolean;
}

export interface EditionInfo {
  bonus: number;
  label: string;
  tier: "base" | "shiny" | "holo" | "legendary";
  variation: string | null;
}

export function getEditionInfo(card: SorareCard): EditionInfo {
  const edition = (card.cardEditionName || "").toLowerCase();

  // Check variations first (they include the base edition bonus)
  if (edition.includes("signed")) {
    return { bonus: 0.40, label: "Signed +40%", tier: "legendary", variation: "Signed" };
  }
  if (edition.includes("meteor")) {
    return { bonus: 0.25, label: "Meteor +25%", tier: "shiny", variation: "Meteor Striker" };
  }
  if (edition.includes("jersey")) {
    return { bonus: 0.20, label: "Jersey +20%", tier: "shiny", variation: "Jersey" };
  }

  // Base editions
  if (edition.includes("legendary")) {
    return { bonus: 0.30, label: "Legendary +30%", tier: "legendary", variation: null };
  }
  if (edition.includes("holo")) {
    return { bonus: 0.10, label: "Holo +10%", tier: "holo", variation: null };
  }
  if (edition.includes("shiny")) {
    return { bonus: 0.05, label: "Shiny +5%", tier: "shiny", variation: null };
  }

  return { bonus: 0, label: "Base", tier: "base", variation: null };
}

function getExpectedPoints(card: SorareCard): ScoredCard {
  const player = card.anyPlayer;
  if (!player) {
    return { card, expectedPoints: 0, editionBonus: 0, editionLabel: "Base", hasGame: false, isHome: false, isInjured: false };
  }

  const avgScore = player.averageScore || 0;
  const power = parseFloat(card.power) || 1;
  const upcomingGames = player.activeClub?.upcomingGames || [];
  const hasGame = upcomingGames.length > 0;
  const clubCode = player.activeClub?.code;
  const editionInfo = getEditionInfo(card);

  // Check if home game
  const isHome = hasGame && upcomingGames[0]?.homeTeam?.code === clubCode;

  let expectedPoints = avgScore * power * (1 + editionInfo.bonus);

  // No game = 0 points
  if (!hasGame) {
    expectedPoints = 0;
  }

  // Home game bonus (+5%)
  if (isHome) {
    expectedPoints *= 1.05;
  }

  return {
    card,
    expectedPoints,
    editionBonus: editionInfo.bonus,
    editionLabel: editionInfo.label,
    hasGame,
    isHome,
    isInjured: false,
  };
}

export function scoreCards(cards: SorareCard[]): ScoredCard[] {
  return cards.map(getExpectedPoints).sort((a, b) => b.expectedPoints - a.expectedPoints);
}

export function recommendLineup(cards: SorareCard[], count = 5): SorareCard[] {
  const scored = scoreCards(cards);

  // Try to ensure positional diversity: at least 1 GK, 1 DEF, 1 MID, 1 FWD
  const positionMap: Record<string, ScoredCard[]> = {
    Goalkeeper: [],
    Defender: [],
    Midfielder: [],
    Forward: [],
  };

  for (const sc of scored) {
    const pos = sc.card.anyPlayer?.cardPositions?.[0];
    if (pos && positionMap[pos]) {
      positionMap[pos].push(sc);
    }
  }

  const selected: ScoredCard[] = [];
  const usedPlayerSlugs = new Set<string>();

  // Pick best from each position first (dedup by player, not card edition)
  for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward"]) {
    const playerSlug = (sc: ScoredCard) => sc.card.anyPlayer?.slug ?? sc.card.slug;
    const best = positionMap[pos].find((sc) => !usedPlayerSlugs.has(playerSlug(sc)));
    if (best && selected.length < count) {
      selected.push(best);
      usedPlayerSlugs.add(playerSlug(best));
    }
  }

  // Fill remaining slots with best available
  for (const sc of scored) {
    if (selected.length >= count) break;
    const playerSlug = sc.card.anyPlayer?.slug ?? sc.card.slug;
    if (!usedPlayerSlugs.has(playerSlug)) {
      selected.push(sc);
      usedPlayerSlugs.add(playerSlug);
    }
  }

  return selected.map((sc) => sc.card);
}

export function estimateTotalScore(cards: (SorareCard | null)[]): number {
  return cards.reduce((total, card) => {
    if (!card) return total;
    const sc = getExpectedPoints(card);
    return total + sc.expectedPoints;
  }, 0);
}
