import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchFromSorare } from "@/app/api/cards/route";
import { buildPortfolioIndex } from "@/lib/market/portfolio-utils";
import type { SorareCard } from "@/lib/types";
import type { OwnedPlayerInfo } from "@/lib/market/portfolio-utils";

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const STAGGER_MS = 500;

const RARITY_WEIGHTS: Record<string, number> = {
  limited: 1,
  rare: 1.5,
  super_rare: 2,
  unique: 3,
};

/** Stripped-down card for tools — only fields needed for search/analysis */
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
  /** In-season eligible competition league names (e.g. ["K League 1"]) */
  inSeasonLeagues: string[];
  /** All eligible leaderboard types (e.g. ["IN_SEASON_KOREA_LIMITED_PVP"]) */
  eligibleTypes: string[];
}

interface MemberSummary {
  stats: {
    cardCount: number;
    rarityBreakdown: Record<string, number>;
    portfolioScore: number;
  };
  /** Player slug -> ownership info (serializable) */
  ownedPlayers: Record<string, OwnedPlayerInfo>;
  /** Lowercase display name -> player slug (for name-based lookup) */
  nameIndex: Record<string, string>;
  /** Slim card data for AI tools */
  cards: SlimCard[];
}

async function fetchUserCards(slug: string): Promise<SorareCard[]> {
  const cached = await prisma.cardCache.findUnique({ where: { userSlug: slug } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_MAX_AGE_MS) {
    return JSON.parse(cached.cardsJson) as SorareCard[];
  }

  const cards = await fetchFromSorare(slug);

  await prisma.cardCache.upsert({
    where: { userSlug: slug },
    update: {
      cardsJson: JSON.stringify(cards),
      cardCount: cards.length,
      fetchedAt: new Date(),
    },
    create: {
      userSlug: slug,
      cardsJson: JSON.stringify(cards),
      cardCount: cards.length,
    },
  });

  return cards;
}

function summarize(cards: SorareCard[]): MemberSummary {
  // Stats
  const rarityBreakdown: Record<string, number> = {};
  const scored: number[] = [];

  for (const card of cards) {
    rarityBreakdown[card.rarityTyped] = (rarityBreakdown[card.rarityTyped] || 0) + 1;
    const avg = card.anyPlayer?.averageScore;
    if (avg && avg > 0) {
      const weight = RARITY_WEIGHTS[card.rarityTyped] || 1;
      scored.push(avg * weight);
    }
  }

  scored.sort((a, b) => b - a);
  const portfolioScore = Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0) * 100) / 100;

  // Portfolio index (serialized as plain objects)
  const index = buildPortfolioIndex(cards);
  const ownedPlayers: Record<string, OwnedPlayerInfo> = {};
  for (const [slug, info] of index.bySlug) {
    ownedPlayers[slug] = info;
  }
  const nameIndex: Record<string, string> = {};
  for (const [name, slug] of index.byName) {
    nameIndex[name] = slug;
  }

  return {
    stats: { cardCount: cards.length, rarityBreakdown, portfolioScore },
    ownedPlayers,
    nameIndex,
    cards: [],
  };
}

function slimCards(cards: SorareCard[]): SlimCard[] {
  return cards.map((c) => {
    const tracks = c.eligibleUpcomingLeagueTracks || [];
    const inSeasonTracks = tracks.filter(
      (t) => t.entrySo5Leaderboard.seasonality === "IN_SEASON",
    );

    // Unique in-season league names
    const inSeasonLeagues = [
      ...new Set(inSeasonTracks.map((t) => t.entrySo5Leaderboard.so5League.displayName)),
    ];

    // All eligible leaderboard types (for precise matching)
    const eligibleTypes = tracks.map((t) => t.entrySo5Leaderboard.so5LeaderboardType);

    return {
      slug: c.slug,
      rarityTyped: c.rarityTyped,
      inSeasonEligible: c.inSeasonEligible,
      power: c.power,
      edition: c.cardEditionName ?? null,
      playerName: c.anyPlayer?.displayName ?? null,
      playerSlug: c.anyPlayer?.slug ?? null,
      position: c.anyPlayer?.cardPositions?.[0] ?? null,
      averageScore: c.anyPlayer?.averageScore ?? null,
      clubName: c.anyPlayer?.activeClub?.name ?? null,
      league: c.anyPlayer?.activeClub?.domesticLeague?.name ?? null,
      inSeasonLeagues,
      eligibleTypes,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slugsParam = searchParams.get("slugs");

  if (!slugsParam) {
    return NextResponse.json({ error: "Missing slugs parameter" }, { status: 400 });
  }

  const slugs = slugsParam.split(",").filter(Boolean);
  if (slugs.length === 0 || slugs.length > 10) {
    return NextResponse.json({ error: "Provide 1-10 slugs" }, { status: 400 });
  }

  try {
    const result: Record<string, MemberSummary> = {};

    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      try {
        const cards = await fetchUserCards(slug);
        const summary = summarize(cards);
        summary.cards = slimCards(cards);
        result[slug] = summary;
      } catch (err) {
        console.error(`[clan/cards] Failed to fetch ${slug}:`, err);
        result[slug] = {
          stats: { cardCount: 0, rarityBreakdown: {}, portfolioScore: 0 },
          ownedPlayers: {},
          nameIndex: {},
          cards: [],
        };
      }
      if (i < slugs.length - 1) {
        await new Promise((r) => setTimeout(r, STAGGER_MS));
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[clan/cards] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch clan cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
