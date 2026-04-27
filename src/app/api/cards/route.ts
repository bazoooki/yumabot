import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { USER_CARDS_QUERY } from "@/lib/queries";
import { prisma } from "@/lib/db";
import type { SorareCard } from "@/lib/types";

interface CardsResponse {
  user: {
    cards: {
      nodes: SorareCard[];
      pageInfo: {
        endCursor: string | null;
        hasNextPage: boolean;
      };
    };
  };
}

export async function fetchFromSorare(slug: string): Promise<SorareCard[]> {
  const allCards: SorareCard[] = [];
  let cursor: string | null = null;
  let page = 0;
  const MAX_PAGES = 100;

  do {
    const result: CardsResponse =
      await sorareClient.request<CardsResponse>(USER_CARDS_QUERY, {
        slug,
        cursor,
        first: 50,
      });

    const connection = result?.user?.cards;
    if (!connection) break;

    allCards.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
    page++;

    console.log(
      `[cards] Page ${page}: fetched ${connection.nodes.length}, total: ${allCards.length}`
    );
  } while (cursor && page < MAX_PAGES);

  return allCards;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || process.env.SORARE_USER_SLUG;
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!slug) {
    return NextResponse.json(
      { error: "Missing user slug" },
      { status: 400 }
    );
  }

  try {
    // Cache is sticky: always serve it if it exists. Only refetch from
    // Sorare when the caller explicitly asks with ?refresh=true.
    if (!forceRefresh) {
      const cached = await prisma.cardCache.findUnique({ where: { userSlug: slug } });
      if (cached) {
        const cards = JSON.parse(cached.cardsJson) as SorareCard[];
        const ageMin = Math.round((Date.now() - cached.fetchedAt.getTime()) / 60000);
        console.log(`[cards] Serving ${cards.length} cards from cache (age: ${ageMin}min)`);
        return NextResponse.json({
          cards,
          totalCount: cards.length,
          cached: true,
          cachedAt: cached.fetchedAt.toISOString(),
        });
      }
    }

    // Fetch fresh from Sorare API (no cache, or explicit refresh)
    console.log(`[cards] Fetching fresh cards for ${slug}...`);
    const allCards = await fetchFromSorare(slug);

    // Save to cache
    await prisma.cardCache.upsert({
      where: { userSlug: slug },
      update: {
        cardsJson: JSON.stringify(allCards),
        cardCount: allCards.length,
        fetchedAt: new Date(),
      },
      create: {
        userSlug: slug,
        cardsJson: JSON.stringify(allCards),
        cardCount: allCards.length,
      },
    });

    return NextResponse.json({
      cards: allCards,
      totalCount: allCards.length,
      cached: false,
      cachedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error fetching cards:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
