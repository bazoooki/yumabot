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
    name: string;
    code?: string;
    pictureUrl: string;
    domesticLeague: {
      name: string;
    } | null;
    upcomingGames?: UpcomingGame[];
  } | null;
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
}

export interface LineupState {
  slots: LineupSlot[];
  targetScore: number;
}

export interface FixtureGame {
  id: string;
  date: string;
  statusTyped: string;
  homeTeam: { code: string; name: string; slug: string; pictureUrl: string };
  awayTeam: { code: string; name: string; slug: string; pictureUrl: string };
  competition: { name: string };
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
    status: string;
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

export const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MD",
  Forward: "FW",
};
