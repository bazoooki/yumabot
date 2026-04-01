import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { USER_CARDS_QUERY } from "@/lib/queries";
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || process.env.SORARE_USER_SLUG;

  if (!slug) {
    return NextResponse.json(
      { error: "Missing user slug" },
      { status: 400 }
    );
  }

  try {
    const allCards: SorareCard[] = [];
    let cursor: string | null = null;
    let page = 0;
    const MAX_PAGES = 30; // Safety limit ~1500 cards

    do {
      const result: CardsResponse =
        await sorareClient.request<CardsResponse>(USER_CARDS_QUERY, {
          slug,
          cursor,
          first: 50,
        });

      const connection = result?.user?.cards;
      if (!connection) break;

      // Only keep stellar cards
      const stellar = connection.nodes.filter(
        (c) => c.cardEditionName?.toLowerCase().includes("stellar")
      );
      allCards.push(...stellar);
      cursor = connection.pageInfo.hasNextPage
        ? connection.pageInfo.endCursor
        : null;
      page++;

      console.log(
        `[cards] Page ${page}: fetched ${connection.nodes.length}, total: ${allCards.length}`
      );
    } while (cursor && page < MAX_PAGES);

    return NextResponse.json({
      cards: allCards,
      totalCount: allCards.length,
    });
  } catch (error: unknown) {
    console.error("Error fetching cards:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
