import type {
  SorareCard,
  InSeasonCompetition,
  PlayerIntel,
  GWPlan,
  CompetitionAllocation,
  ContestedCard,
  GapWarning,
  ScoredCardWithStrategy,
} from "./types";
import { recommendInSeasonLineup, scoreCardsForInSeason } from "./ai-lineup";

const CROSS_LEAGUE_KEYWORDS = ["challenger", "contender", "european", "global"];

function isCrossLeague(comp: InSeasonCompetition): boolean {
  return CROSS_LEAGUE_KEYWORDS.some((kw) =>
    comp.leagueName.toLowerCase().includes(kw),
  );
}

/** Filter cards eligible for a specific competition (mirrors useEligibleCards logic) */
export function getEligibleCardsForCompetition(
  cards: SorareCard[],
  comp: InSeasonCompetition,
): SorareCard[] {
  // Prefer precise league track eligibility when available
  const compCross = isCrossLeague(comp);

  return cards.filter((c) => {
    if (c.rarityTyped !== comp.mainRarityType) return false;
    if (!c.anyPlayer) return false;
    if (!c.anyPlayer.activeClub?.upcomingGames?.length) return false;

    // Use eligibleUpcomingLeagueTracks for precise matching
    const tracks = c.eligibleUpcomingLeagueTracks;
    if (tracks && tracks.length > 0) {
      return tracks.some(
        (t) =>
          t.entrySo5Leaderboard.seasonality === "IN_SEASON" &&
          t.entrySo5Leaderboard.mainRarityType === comp.mainRarityType &&
          t.entrySo5Leaderboard.so5League.displayName
            .toLowerCase()
            .includes(comp.leagueName.toLowerCase().split(" ")[0]),
      );
    }

    // Fallback: heuristic league-name matching
    if (!compCross && comp.leagueName) {
      const playerLeague = c.anyPlayer.activeClub?.domesticLeague?.name;
      if (playerLeague && playerLeague !== comp.leagueName) return false;
    }

    return true;
  });
}

/** Build bidirectional eligibility map between cards and competitions */
export function buildEligibilityMap(
  cards: SorareCard[],
  competitions: InSeasonCompetition[],
): {
  cardToCompetitions: Map<string, string[]>;
  competitionToCards: Map<string, SorareCard[]>;
  contestedCards: ContestedCard[];
} {
  const cardToCompetitions = new Map<string, string[]>();
  const competitionToCards = new Map<string, SorareCard[]>();

  for (const comp of competitions) {
    const eligible = getEligibleCardsForCompetition(cards, comp);
    competitionToCards.set(comp.slug, eligible);

    for (const card of eligible) {
      const existing = cardToCompetitions.get(card.slug) ?? [];
      existing.push(comp.slug);
      cardToCompetitions.set(card.slug, existing);
    }
  }

  // Build contested cards list (eligible for 2+ competitions)
  const contestedCards: ContestedCard[] = [];
  for (const [cardSlug, compSlugs] of cardToCompetitions) {
    if (compSlugs.length < 2) continue;
    const card = cards.find((c) => c.slug === cardSlug);
    if (!card) continue;
    contestedCards.push({
      card,
      eligibleCompetitions: compSlugs,
      assignedTo: null,
      valueByCompetition: {},
    });
  }

  return { cardToCompetitions, competitionToCards, contestedCards };
}

/** Main GW planner: allocate cards across all competitions */
export async function planGameweek(
  cards: SorareCard[],
  competitions: InSeasonCompetition[],
  playerIntel: Record<string, PlayerIntel> | null,
): Promise<GWPlan> {
  const { competitionToCards, contestedCards } = buildEligibilityMap(
    cards,
    competitions,
  );

  // Sort competitions by constraint tightness (fewest eligible cards first)
  const sortedComps = [...competitions].sort((a, b) => {
    const aEligible = competitionToCards.get(a.slug)?.length ?? 0;
    const bEligible = competitionToCards.get(b.slug)?.length ?? 0;
    return aEligible - bEligible;
  });

  const allocations: CompetitionAllocation[] = [];
  const allocatedCards = new Map<string, string>(); // cardSlug → competitionSlug
  const gaps: GapWarning[] = [];

  // Score contested cards per competition for value analysis
  for (const contested of contestedCards) {
    for (const compSlug of contested.eligibleCompetitions) {
      const comp = competitions.find((c) => c.slug === compSlug);
      if (!comp) continue;
      const targetScore = comp.streak?.thresholds.find((t) => t.isCurrent)?.score ?? 360;
      const scored = scoreCardsForInSeason(
        [contested.card],
        {
          allowedRarities: [comp.mainRarityType],
          leagueRestriction: isCrossLeague(comp) ? null : comp.leagueName,
        },
        targetScore,
        null,
        playerIntel,
      );
      contested.valueByCompetition[compSlug] =
        scored[0]?.strategyScore ?? 0;
    }
  }

  // Greedy allocation pass
  for (const comp of sortedComps) {
    const compCross = isCrossLeague(comp);
    const targetScore =
      comp.streak?.thresholds.find((t) => t.isCurrent)?.score ?? 360;

    // Cards already allocated to other competitions (advisory — Sorare allows reuse)
    const usedSlugs = new Set(
      [...allocatedCards.entries()]
        .filter(([, assignedComp]) => assignedComp !== comp.slug)
        .map(([slug]) => slug),
    );

    const { lineup, warnings } = await recommendInSeasonLineup(
      cards,
      {
        allowedRarities: [comp.mainRarityType],
        leagueRestriction: compCross ? null : comp.leagueName,
        minInSeasonCards: 4,
      },
      targetScore,
      playerIntel,
      usedSlugs,
    );

    // Track allocations
    for (const sc of lineup) {
      allocatedCards.set(sc.card.slug, comp.slug);
    }

    const expectedScore = lineup.reduce(
      (sum, sc) => sum + sc.strategy.expectedScore,
      0,
    );

    allocations.push({
      competitionSlug: comp.slug,
      lineup,
      expectedScore,
      filledSlots: lineup.length,
      totalSlots: 5,
    });

    // Detect gaps
    if (lineup.length < 5) {
      const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;
      const filledPositions = new Set<string | undefined>(
        lineup.map((sc) => sc.card.anyPlayer?.cardPositions?.[0]),
      );
      for (const pos of positions) {
        if (!filledPositions.has(pos)) {
          gaps.push({
            competitionSlug: comp.slug,
            position: pos,
            message: `No eligible ${pos} for ${comp.displayName}`,
          });
        }
      }
    }

    for (const w of warnings) {
      if (w.includes("in-season eligible")) {
        gaps.push({
          competitionSlug: comp.slug,
          position: "general",
          message: w,
        });
      }
    }
  }

  // Update contested card assignments
  for (const contested of contestedCards) {
    contested.assignedTo = allocatedCards.get(contested.card.slug) ?? null;
  }

  // Sort contested cards by contention score (more competitions × higher value = more contested)
  contestedCards.sort((a, b) => {
    const aScore =
      a.eligibleCompetitions.length *
      Math.max(...Object.values(a.valueByCompetition), 0);
    const bScore =
      b.eligibleCompetitions.length *
      Math.max(...Object.values(b.valueByCompetition), 0);
    return bScore - aScore;
  });

  // Re-sort allocations to match original competition order
  const compOrder = new Map(competitions.map((c, i) => [c.slug, i]));
  allocations.sort(
    (a, b) =>
      (compOrder.get(a.competitionSlug) ?? 0) -
      (compOrder.get(b.competitionSlug) ?? 0),
  );

  const totalExpectedScore = allocations.reduce(
    (sum, a) => sum + a.expectedScore,
    0,
  );

  return { allocations, contestedCards, gaps, totalExpectedScore };
}
