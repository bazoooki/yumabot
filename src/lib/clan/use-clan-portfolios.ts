"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { CLAN_MEMBERS } from "./members";
import { setClanContext } from "@/lib/command-bar/tools/clan";
import type { PortfolioIndex, OwnedPlayerInfo } from "@/lib/market/portfolio-utils";
import type { ClanPortfolios, ClanPortfolioStats } from "./types";

/** Slim card shape from API */
interface SlimCard {
  slug: string;
  rarityTyped: string;
  inSeasonEligible: boolean;
  power: string;
  edition: string | null;
  playerName: string | null;
  playerSlug: string | null;
  position: string | null;
  averageScore: number | null;
  clubName: string | null;
  league: string | null;
  inSeasonLeagues: string[];
  eligibleTypes: string[];
}

/** Shape returned by /api/clan/cards per member */
interface MemberSummary {
  stats: ClanPortfolioStats;
  ownedPlayers: Record<string, OwnedPlayerInfo>;
  nameIndex: Record<string, string>;
  cards?: SlimCard[];
}

type ApiResponse = Record<string, MemberSummary>;

async function fetchClanSummary(): Promise<ApiResponse> {
  const slugs = CLAN_MEMBERS.map((m) => m.slug).join(",");
  const res = await fetch(`/api/clan/cards?slugs=${slugs}`);
  if (!res.ok) throw new Error("Failed to fetch clan cards");
  return res.json();
}

export function useClanPortfolios(userSlug: string): {
  data: ClanPortfolios | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: summaryMap, isLoading, error } = useQuery({
    queryKey: ["clan-cards"],
    queryFn: fetchClanSummary,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });

  const portfolios = useMemo<ClanPortfolios | null>(() => {
    if (!summaryMap) return null;

    const indexes: ClanPortfolios["indexes"] = {};
    const stats: ClanPortfolios["stats"] = {};

    for (const [slug, summary] of Object.entries(summaryMap)) {
      stats[slug] = summary.stats;

      const bySlug = new Map<string, OwnedPlayerInfo>();
      for (const [playerSlug, info] of Object.entries(summary.ownedPlayers)) {
        bySlug.set(playerSlug, info);
      }
      const byName = new Map<string, string>();
      for (const [name, playerSlug] of Object.entries(summary.nameIndex)) {
        byName.set(name, playerSlug);
      }

      indexes[slug] = { bySlug, byName } as PortfolioIndex;
    }

    return { indexes, stats };
  }, [summaryMap]);

  // Set clan context for tools whenever data changes
  useEffect(() => {
    if (!summaryMap) return;

    const allCards: Record<string, SlimCard[]> = {};
    let totalCards = 0;
    for (const [slug, summary] of Object.entries(summaryMap)) {
      allCards[slug] = summary.cards || [];
      totalCards += allCards[slug].length;
    }

    console.log(`[clan] Setting context: ${Object.keys(allCards).length} members, ${totalCards} total cards`);
    setClanContext({ userSlug, allCards });
  }, [summaryMap, userSlug]);

  return { data: portfolios, isLoading, error: error as Error | null };
}
