export type RarityType =
  | "common"
  | "limited"
  | "rare"
  | "super_rare"
  | "unique"
  | "custom_series";

export type Position = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export interface UpcomingGame {
  date: string;
  homeTeam: { code: string; name: string; pictureUrl: string };
  awayTeam: { code: string; name: string; pictureUrl: string };
  competition: { name: string };
}

export interface SorarePlayer {
  slug: string;
  displayName: string;
  cardPositions: Position[];
  age: number;
  averageScore: number | null;
  country: {
    code: string;
    name: string;
    flagUrl: string;
  } | null;
  activeClub: {
    slug: string;
    name: string;
    code?: string;
    pictureUrl: string;
    domesticLeague: {
      name: string;
    } | null;
    upcomingGames?: UpcomingGame[];
  } | null;
}

export interface LeagueTrackEligibility {
  entrySo5Leaderboard: {
    seasonality: string;
    so5LeaderboardType: string;
    mainRarityType: string;
    so5League: { displayName: string };
  };
}

export interface SorareCard {
  slug: string;
  rarityTyped: RarityType;
  pictureUrl: string;
  seasonYear: number;
  grade: number;
  xp: number;
  xpNeededForNextGrade: number;
  inSeasonEligible: boolean;
  cardEditionName: string | null;
  power: string;
  eligibleUpcomingLeagueTracks?: LeagueTrackEligibility[];
  anyPlayer: SorarePlayer | null;
}

export interface CardsResponse {
  cards: SorareCard[];
  totalCount: number;
}

export interface GalleryFilters {
  search: string;
  cardSet: string | null;
  rarity: RarityType | null;
  tournaments: string[];
  positions: Position[];
  tiers: number[];
  duplicatesOnly: boolean;
}

export interface FacetCounts {
  rarities: Record<string, number>;
  tournaments: Record<string, number>;
  positions: Record<string, number>;
  tiers: Record<number, number>;
  cardSets: Record<string, number>;
}

export type LineupPosition = "GK" | "DEF" | "MID" | "FWD" | "EX";

export interface LineupSlot {
  position: LineupPosition;
  card: SorareCard | null;
  isCaptain: boolean;
}

export interface LineupState {
  slots: LineupSlot[];
  targetScore: number;
}

export interface FixtureGame {
  id: string;
  date: string;
  statusTyped: string;
  sport: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { code: string; name: string; slug: string; pictureUrl: string };
  awayTeam: { code: string; name: string; slug: string; pictureUrl: string };
  competition: { name: string };
}

export interface StatScore {
  category: string;
  stat: string;
  statValue: number;
  totalScore: number;
  points: number;
}

export interface GamePlayerScore {
  score: number;
  scoreStatus: string;
  projectedScore: number | null;
  positionTyped: string;
  anyPlayer: {
    slug: string;
    displayName: string;
    squaredPictureUrl: string | null;
    activeClub: { code: string } | null;
  };
  anyPlayerGameStats: {
    minsPlayed: number;
    fieldStatus: string | null;
  } | null;
  detailedScore: StatScore[];
  positiveDecisiveStats: StatScore[];
  negativeDecisiveStats: StatScore[];
}

/** A detected stat change between two game updates */
export interface GameEvent {
  playerSlug: string;
  playerName: string;
  teamCode: string;
  minute: number;
  stat: string;
  category: "decisive" | "negative" | "all_around";
  pointsDelta: number;
  newValue: number;
  playerTotalScore: number;
  isOwned?: boolean;
  /** Source game ID (for multi-game rooms) */
  gameId?: string;
  /** Display label e.g. "Porto vs Forest" (for multi-game rooms) */
  gameLabel?: string;
  /** For substitution events */
  subPlayerIn?: string;
  subPlayerOut?: string;
  isInjury?: boolean;
  timestamp: number;
}

/** A group of causally-related events (e.g. a goal + all affected players) */
export interface BatchedGameEvent {
  type: "batched";
  id: string;
  /** The headline event — goal, own_goal, red_card, penalty */
  trigger: GameEvent;
  /** Other trigger-level events in the same batch (e.g. assist paired with a goal) */
  relatedTriggers: GameEvent[];
  /** Ripple effects — clean sheet loss, goal_conceded, score changes */
  affected: GameEvent[];
  minute: number;
  timestamp: number;
}

export type FeedItem = GameEvent | BatchedGameEvent;

export function isBatchedEvent(item: FeedItem): item is BatchedGameEvent {
  return "type" in item && item.type === "batched";
}

export interface GameDetail {
  id: string;
  date: string;
  statusTyped: string;
  minute: number;
  periodType: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { code: string; name: string; slug: string; pictureUrl: string };
  awayTeam: { code: string; name: string; slug: string; pictureUrl: string };
  competition: { name: string };
  playerGameScores: GamePlayerScore[];
}

export interface Fixture {
  slug: string;
  displayName: string;
  gameWeek: number;
  startDate: string;
  endDate: string;
  games: FixtureGame[];
}

export interface PlayerGameScore {
  score: number;
  scoreStatus: string;
  projectedScore: number | null;
  projection: { grade: string } | null;
  positionTyped: string;
  anyGame: {
    date: string;
    homeTeam: { code: string; name: string };
    awayTeam: { code: string; name: string };
    competition: { name: string };
    statusTyped: string;
  };
  anyPlayerGameStats: {
    fieldStatus: string;
    footballPlayingStatusOdds: {
      starterOddsBasisPoints: number;
      reliability: string;
    } | null;
    minsPlayed: number;
  } | null;
}

export const RARITY_CONFIG: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  common: { label: "Common", color: "text-green-400", dotColor: "bg-green-400" },
  limited: { label: "Limited", color: "text-yellow-400", dotColor: "bg-yellow-400" },
  rare: { label: "Rare", color: "text-red-400", dotColor: "bg-red-400" },
  super_rare: { label: "Super Rare", color: "text-blue-400", dotColor: "bg-blue-400" },
  unique: { label: "Unique", color: "text-purple-400", dotColor: "bg-purple-400" },
  custom_series: { label: "Custom", color: "text-pink-400", dotColor: "bg-pink-400" },
};

// --- Strategy types ---

export type StrategyTag = "SAFE" | "BALANCED" | "CEILING" | "RISKY";
export type StrategyMode = "floor" | "balanced" | "ceiling";

export interface CardStrategyMetrics {
  expectedScore: number;
  floor: number;
  ceiling: number;
  stdDev: number;
  consistencyScore: number;
  startProbability: number;
  strategyTag: StrategyTag;
  strategyReason: string;
  isDetailedTier: boolean;
}

export interface ScoredCardWithStrategy {
  card: SorareCard;
  expectedPoints: number;
  editionBonus: number;
  editionLabel: string;
  hasGame: boolean;
  isHome: boolean;
  isInjured: boolean;
  strategy: CardStrategyMetrics;
  strategyScore: number;
}

export interface PlayerIntel {
  starterProbability: number | null;
  fieldStatus: string | null;
  reliability: string | null;
}

export interface LivePlayerScore {
  playerSlug: string;
  score: number;
  projectedScore: number | null;
  scoreStatus: string;
  minsPlayed: number;
  fieldStatus: string | null;
  gameStatus: string;
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
}

export interface LineupProbability {
  expectedTotal: number;
  successProbability: number;
  confidenceLevel: "high" | "medium" | "low";
}

// --- In-Season types ---

export interface InSeasonCompetition {
  slug: string;
  displayName: string;
  leagueName: string;
  leagueSlug: string;
  seasonality: string;
  mainRarityType: RarityType;
  division: number;
  teamsCap: number;
  cutOffDate: string;
  canCompose: boolean;
  iconUrl: string;
  stadiumUrl: string | null;
  teams: InSeasonTeam[];
  streak: InSeasonStreak | null;
  eligibleCardCount: number;
}

export interface InSeasonTeam {
  name: string;
  lineupSlug: string | null;
  slots: InSeasonSlot[];
  totalScore: number | null;
  rewardMultiplier: number;
  canEdit: boolean;
  ranking: number | null;
}

export interface InSeasonSlot {
  index: number;
  position: string;
  cardSlug: string | null;
  playerName: string | null;
  playerSlug: string | null;
  pictureUrl: string | null;
  playerPictureUrl: string | null;
  rarityTyped: RarityType | null;
  isCaptain: boolean;
  score: number | null;
  scoreStatus: string | null;
  /** Game date (ISO string) — for showing kickoff time on scheduled players */
  gameDate: string | null;
  /** Game status */
  gameStatus: string | null;
  /** Home team code */
  gameHomeCode: string | null;
  /** Away team code */
  gameAwayCode: string | null;
}

export interface InSeasonStreak {
  currentLevel: number;
  streakCount: number;
  thresholds: InSeasonThreshold[];
}

export interface InSeasonThreshold {
  level: number;
  score: number;
  reward: string;
  isCleared: boolean;
  isCurrent: boolean;
}

export interface InSeasonLineupSlot {
  position: LineupPosition;
  card: SorareCard | null;
  isCaptain: boolean;
}

// --- GW Planner types ---

export interface GWPlan {
  allocations: CompetitionAllocation[];
  contestedCards: ContestedCard[];
  gaps: GapWarning[];
  totalExpectedScore: number;
}

export interface CompetitionAllocation {
  competitionSlug: string;
  lineup: ScoredCardWithStrategy[];
  expectedScore: number;
  filledSlots: number;
  totalSlots: number;
}

export interface ContestedCard {
  card: SorareCard;
  eligibleCompetitions: string[];
  assignedTo: string | null;
  valueByCompetition: Record<string, number>;
}

export interface GapWarning {
  competitionSlug: string;
  position: string;
  message: string;
}

// --- Results types ---

export interface ResultsRanking {
  ranking: number;
  score: number;
  user: {
    slug: string;
    nickname: string;
    pictureUrl: string | null;
  };
  lineup: ResultsAppearance[];
}

export interface ResultsAppearance {
  index: number;
  captain: boolean;
  score: number;
  position: string;
  grade: number;
  bonus: number;
  playerSlug: string;
  playerName: string;
  cardSlug: string | null;
}

export interface LeaderboardSummary {
  slug: string;
  displayName: string;
  leagueName: string;
  division: number;
  mainRarityType: string;
  totalEntries: number;
  podium: ResultsRanking[];
  clanEntries: ResultsRanking[];
}

export interface Achievement {
  type: string;
  title: string;
  description: string;
  userSlug: string;
  userName: string;
  value: number;
  meta: Record<string, unknown>;
}
