import type { PortfolioIndex } from "@/lib/market/portfolio-utils";

export interface ClanMember {
  slug: string;
  name: string;
}

export interface ClanPortfolioStats {
  cardCount: number;
  rarityBreakdown: Record<string, number>;
  portfolioScore: number;
}

export interface ClanActivityItem {
  memberSlug: string;
  memberName: string;
  playerSlug: string;
  playerName: string;
  saleCount: number;
  latestPrice: number;
  ownedCount: number;
  ownedRarities: string[];
  signal: "dump" | "accumulation" | "active";
  lastSeen: string;
}

export interface ClanLeaderboardEntry {
  slug: string;
  name: string;
  portfolioScore: number;
  cardCount: number;
  rank: number;
}

export interface ClanPortfolios {
  indexes: Record<string, PortfolioIndex>;
  stats: Record<string, ClanPortfolioStats>;
}
