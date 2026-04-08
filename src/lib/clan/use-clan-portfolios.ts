"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  pictureUrl: string | null;
  playerName: string | null;
  playerSlug: string | null;
  position: string | null;
  averageScore: number | null;
  clubName: string | null;
  league: string | null;
  inSeasonLeagues: string[];
  eligibleTypes: string[];
  hasUpcomingGame: boolean;
  isActiveAtClub: boolean;
  clubCode: string | null;
  clubPictureUrl: string | null;
  upcomingGame: {
    date: string;
    homeTeamCode: string;
    awayTeamCode: string;
  } | null;
}

/** Shape returned by /api/clan/cards per member */
interface MemberSummary {
  stats: ClanPortfolioStats;
  ownedPlayers: Record<string, OwnedPlayerInfo>;
  nameIndex: Record<string, string>;
  cards?: SlimCard[];
}

export interface MemberLoadState {
  slug: string;
  name: string;
  status: "pending" | "loading" | "loaded" | "error";
  cardCount?: number;
}

async function fetchMemberCards(slug: string): Promise<MemberSummary> {
  const res = await fetch(`/api/clan/cards?slugs=${slug}`);
  if (!res.ok) throw new Error(`Failed to fetch ${slug}`);
  const data = await res.json();
  return data[slug] as MemberSummary;
}

export function useClanPortfolios(userSlug: string): {
  data: ClanPortfolios | null;
  isLoading: boolean;
  error: Error | null;
  memberStates: MemberLoadState[];
  refresh: () => void;
} {
  const [memberStates, setMemberStates] = useState<MemberLoadState[]>(
    CLAN_MEMBERS.map((m) => ({ slug: m.slug, name: m.name, status: "pending" as const })),
  );
  const [portfolios, setPortfolios] = useState<ClanPortfolios | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const summaryRef = useRef<Record<string, MemberSummary>>({});
  const loadingRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    summaryRef.current = {};
    setPortfolios(null);
    setError(null);
    setMemberStates(
      CLAN_MEMBERS.map((m) => ({ slug: m.slug, name: m.name, status: "loading" as const })),
    );

    // Fetch all members in parallel
    const promises = CLAN_MEMBERS.map(async (m) => {
      try {
        const summary = await fetchMemberCards(m.slug);
        summaryRef.current[m.slug] = summary;
        setMemberStates((prev) =>
          prev.map((s) =>
            s.slug === m.slug
              ? { ...s, status: "loaded" as const, cardCount: summary.stats.cardCount }
              : s,
          ),
        );
      } catch (err) {
        console.error(`[clan] Failed to fetch ${m.slug}:`, err);
        setMemberStates((prev) =>
          prev.map((s) =>
            s.slug === m.slug ? { ...s, status: "error" as const } : s,
          ),
        );
      }
    });

    await Promise.all(promises);

    // Build portfolios from collected data
    const summaryMap = summaryRef.current;
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

    setPortfolios({ indexes, stats });

    // Set clan context for tools
    const allCards: Record<string, SlimCard[]> = {};
    let totalCards = 0;
    for (const [slug, summary] of Object.entries(summaryMap)) {
      allCards[slug] = summary.cards || [];
      totalCards += allCards[slug].length;
    }

    console.log(`[clan] Setting context: ${Object.keys(allCards).length} members, ${totalCards} total cards`);
    setClanContext({ userSlug, allCards });

    loadingRef.current = false;
  }, [userSlug]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const isLoading = memberStates.some((s) => s.status === "loading" || s.status === "pending");

  return {
    data: portfolios,
    isLoading,
    error,
    memberStates,
    refresh: loadAll,
  };
}
