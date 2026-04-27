import type {
  InSeasonCompetition,
  InSeasonSlot,
  InSeasonTeam,
  PlayerIntel,
  RarityType,
  ScoredCardWithStrategy,
} from "@/lib/types";

export interface SuggestedLineup {
  strategy: "safe" | "balanced" | "ceiling";
  cards: ScoredCardWithStrategy[];
  captainSlug: string;
  expectedTotal: number;
  successProbability: number;
}

interface BuildInput {
  leagueName: string;
  mainRarityType: RarityType;
  iconUrl: string | null;
  targetScore: number;
  suggestions: SuggestedLineup[];
  playerIntel: Record<string, PlayerIntel> | null;
}

/**
 * Synthesise an InSeasonCompetition so LineupCard variant="compact" can render
 * a suggested lineup using the same visual treatment as My Live Lineups. Each
 * strategy becomes a `team`; slot.projectedScore surfaces as "PROJ" in the
 * card's StatsRow.
 */
export function buildSuggestedCompetition(input: BuildInput): InSeasonCompetition {
  const teams: InSeasonTeam[] = input.suggestions.map((s) => {
    const slots: InSeasonSlot[] = s.cards.map((sc, index) => {
      const player = sc.card.anyPlayer;
      const upcoming = player?.activeClub?.upcomingGames?.[0];
      const homeCode = upcoming?.homeTeam?.code ?? null;
      const awayCode = upcoming?.awayTeam?.code ?? null;
      const homeCrest = upcoming?.homeTeam?.pictureUrl ?? null;
      const awayCrest = upcoming?.awayTeam?.pictureUrl ?? null;
      const gameDate = upcoming?.date ?? null;
      const playerSlug = player?.slug ?? null;

      const intel = playerSlug ? input.playerIntel?.[playerSlug] ?? null : null;
      return {
        index,
        position: player?.cardPositions?.[0] ?? "",
        cardSlug: sc.card.slug,
        playerName: player?.displayName ?? null,
        playerSlug,
        pictureUrl: sc.card.pictureUrl ?? null,
        playerPictureUrl: player?.avatarPictureUrl ?? null,
        rarityTyped: (sc.card.rarityTyped as RarityType) ?? null,
        isCaptain: playerSlug === s.captainSlug,
        score: null,
        scoreStatus: null,
        projectedScore: Math.round(sc.strategy.expectedScore),
        projectionGrade: intel?.projectionGrade ?? null,
        startProbability: intel?.starterProbability ?? null,
        gameDate,
        gameStatus: null,
        gameHomeCode: homeCode,
        gameAwayCode: awayCode,
        gameHomeCrestUrl: homeCrest,
        gameAwayCrestUrl: awayCrest,
      };
    });

    return {
      name: s.strategy.toUpperCase(),
      lineupSlug: null,
      slots,
      totalScore: null,
      rewardMultiplier: 1,
      canEdit: true,
      ranking: null,
      rewardUsdCents: 0,
      rewardEssence: [],
      rewardIsActual: false,
    };
  });

  return {
    slug: `suggestion:${input.leagueName}:${input.mainRarityType}`,
    displayName: input.leagueName,
    leagueName: input.leagueName,
    leagueSlug: "",
    seasonality: "IN_SEASON",
    mainRarityType: input.mainRarityType,
    division: 0,
    teamsCap: teams.length,
    cutOffDate: "",
    canCompose: true,
    iconUrl: input.iconUrl ?? "",
    stadiumUrl: null,
    teams,
    streak: null,
    eligibleCardCount: 0,
  };
}
