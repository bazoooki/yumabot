import type { RarityType, Position } from "@/lib/types";

export interface UpcomingGameInfo {
  date: string;
  homeTeam: { code: string; name: string };
  awayTeam: { code: string; name: string };
}

export interface MarketOffer {
  id: number;
  offerId: string;
  playerSlug: string;
  playerName: string;
  position: string | null;
  rarity: string;
  priceWei: string;
  priceEth: number;
  buyerSlug: string | null;
  sellerSlug: string | null;
  clubName: string | null;
  cardSlug: string | null;
  offerType: string | null;
  offerStatus: string | null;
  dealStatus: string | null;
  receivedAt: string;
  upcomingGame: UpcomingGameInfo | null;
  tradeType: TradeType;
  cardGrade: number | null;
  cardPower: string | null;
  cardSeason: number | null;
  cardSerial: number | null;
  counterCards: CounterCard[] | null;
  avgScore: number | null;
}

export interface MarketAlert {
  id: number;
  ruleType: AlertRuleType;
  severity: AlertSeverity;
  playerSlug: string | null;
  playerName: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: string;
}

export type AlertRuleType =
  | "volume_spike"
  | "price_spike"
  | "buyer_concentration"
  | "velocity"
  | "portfolio"
  | "gameweek_signal"
  | "price_drop"
  | "listing_surge"
  | "cancellation_wave"
  | "lineup_lock"
  | "lineup_cluster";

export type AlertSeverity = "info" | "warning" | "critical";

export type MarketConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type MarketSort = "recent" | "sales" | "price_high" | "price_low" | "score";

export interface MarketFilters {
  rarity: RarityType | null;
  position: Position | null;
  minPriceEth: number | null;
  maxPriceEth: number | null;
  playerSearch: string;
  myPlayersOnly: boolean;
  sort: MarketSort;
  tradeType: TradeType | null;
  minSales: number;
}

// Raw data from Sorare's tokenOfferWasUpdated subscription
export interface RawTokenOffer {
  id: string;
  status: string;
  type: string;
  dealStatus: string | null;
  acceptedAt: string | null;
  createdAt: string;
  sender: { slug: string } | null;
  actualReceiver: { slug: string } | null;
  senderSide: {
    wei: string;
    anyCards: RawOfferCard[];
  };
  receiverSide: {
    wei: string;
    anyCards: RawOfferCard[];
  };
}

export interface RawOfferCard {
  assetId: string;
  slug?: string;
  rarity?: string;
  grade?: number;
  power?: string;
  seasonYear?: number;
  serialNumber?: number;
  player?: {
    id: string;
    slug?: string;
    displayName: string;
    position: string;
    averageScore?: number | null;
    activeClub: {
      name: string;
      upcomingGames?: UpcomingGameInfo[];
    } | null;
  };
}

export type TradeType = "sale" | "swap" | "mixed";

export interface CounterCard {
  playerName: string;
  rarity: string;
}

// ── Advanced Analytics: Offer Lifecycle ──

export type OfferLifecycleStatus =
  | "created"
  | "pending"
  | "price_updated"
  | "cancelled"
  | "expired"
  | "rejected"
  | "accepted";

export interface OfferLifecycleEvent {
  offerId: string;
  playerSlug: string;
  playerName: string;
  position: string | null;
  rarity: string;
  priceEth: number;
  previousPriceEth: number | null;
  status: OfferLifecycleStatus;
  sellerSlug: string | null;
  cardSlug: string | null;
  clubName: string | null;
  receivedAt: string;
}

// ── Advanced Analytics: Card State (Lineup Locks) ──

export interface CardStateEvent {
  cardSlug: string;
  playerSlug: string;
  playerName: string;
  rarity: string;
  onSale: boolean;
  inLineup: boolean;
  lineupDetails: {
    competitionName: string;
    gameDate: string;
  } | null;
  ownerSlug: string | null;
  receivedAt: string;
}

// Raw data from Sorare's offerWasUpdated subscription
// Matches the simplified OFFER_UPDATED_QUERY (no senderSide cards, no activeClub)
export interface RawOfferUpdate {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  sender: { slug: string } | null;
  senderSide: {
    wei: string;
  };
  receiverSide: {
    wei: string;
    anyCards: RawOfferCard[];
  };
}

// Raw data from Sorare's anyCardWasUpdated subscription
export interface RawCardUpdate {
  slug: string;
  rarity: string;
  power: string;
  onSale: boolean;
  liveSo5Lineup: {
    so5Leaderboard?: { title?: string };
  } | null;
  player: {
    slug: string;
    displayName: string;
    position: string;
  } | null;
  userOwner: { slug: string } | null;
}
