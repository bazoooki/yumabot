import type { RarityType, Position } from "@/lib/types";

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
  receivedAt: string; // ISO string on client
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
  createdAt: string; // ISO string on client
}

export type AlertRuleType =
  | "volume_spike"
  | "price_spike"
  | "buyer_concentration"
  | "velocity";

export type AlertSeverity = "info" | "warning" | "critical";

export type MarketConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface MarketFilters {
  rarity: RarityType | null;
  position: Position | null;
  minPriceEth: number | null;
  maxPriceEth: number | null;
  playerSearch: string;
}

// Raw data shape from Sorare's tokenOfferWasUpdated subscription
export interface RawTokenOffer {
  id: string;
  status: string;
  type: string;
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
  player?: {
    id: string;
    displayName: string;
    position: string;
    activeClub: { name: string } | null;
  };
}
