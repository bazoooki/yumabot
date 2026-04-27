import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { USER_CARDS_QUERY } from "@/lib/queries";
import { prisma } from "@/lib/db";
import type { SorareCard, RarityType } from "@/lib/types";

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

// Same five rarities the user gallery cares about. `custom_series` is
// intentionally omitted — it isn't surfaced anywhere in the UI today, and
// running an extra worker for it just costs Sorare requests for nothing.
const ALL_RARITIES: RarityType[] = [
  "limited",
  "rare",
  "super_rare",
  "unique",
  "common",
];

const VALID_RARITIES = new Set<RarityType>(ALL_RARITIES);
const MAX_PAGES_PER_RARITY = 100;

function parseRaritiesParam(raw: string | null): RarityType[] | null {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as RarityType[];
  const valid = parts.filter((r) => VALID_RARITIES.has(r));
  return valid.length > 0 ? valid : null;
}

// One worker = one rarity, paginating sequentially through that rarity's
// connection. Mirrors the per-leaderboard worker in /api/admin/scrape.
async function fetchRarity(
  slug: string,
  rarity: RarityType,
): Promise<SorareCard[]> {
  const cards: SorareCard[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    const result: CardsResponse = await sorareClient.request<CardsResponse>(
      USER_CARDS_QUERY,
      { slug, cursor, first: 50, rarities: [rarity] },
    );
    const connection = result?.user?.cards;
    if (!connection) break;

    cards.push(...connection.nodes);
    cursor = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null;
    page++;

    console.log(
      `[cards:${rarity}] page ${page}: +${connection.nodes.length} (total ${cards.length})`,
    );
  } while (cursor && page < MAX_PAGES_PER_RARITY);

  return cards;
}

export async function fetchFromSorare(
  slug: string,
  rarities: RarityType[] = ALL_RARITIES,
): Promise<SorareCard[]> {
  // Run one worker per rarity in parallel. Each worker does its own sequential
  // pagination — same shape as the WORKER_COUNT loop in /api/admin/scrape.
  const buckets = await Promise.all(
    rarities.map((r) => fetchRarity(slug, r)),
  );
  return buckets.flat();
}

async function readCache(slug: string): Promise<{
  cards: SorareCard[];
  fetchedAt: Date;
} | null> {
  const cached = await prisma.cardCache.findUnique({ where: { userSlug: slug } });
  if (!cached) return null;
  return {
    cards: JSON.parse(cached.cardsJson) as SorareCard[],
    fetchedAt: cached.fetchedAt,
  };
}

async function writeCache(slug: string, cards: SorareCard[]): Promise<void> {
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
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || process.env.SORARE_USER_SLUG;
  const forceRefresh = searchParams.get("refresh") === "true";
  const rarityFilter = parseRaritiesParam(searchParams.get("rarities"));

  if (!slug) {
    return NextResponse.json({ error: "Missing user slug" }, { status: 400 });
  }

  try {
    if (!forceRefresh) {
      const cached = await readCache(slug);
      if (cached) {
        const ageMin = Math.round(
          (Date.now() - cached.fetchedAt.getTime()) / 60000,
        );
        const cards = rarityFilter
          ? cached.cards.filter(
              (c) => c.rarityTyped && rarityFilter.includes(c.rarityTyped),
            )
          : cached.cards;
        console.log(
          `[cards] Serving ${cards.length} cards from cache (age: ${ageMin}min, filter: ${rarityFilter?.join(",") ?? "all"})`,
        );
        return NextResponse.json({
          cards,
          totalCount: cards.length,
          cached: true,
          cachedAt: cached.fetchedAt.toISOString(),
        });
      }
    }

    const targetRarities = rarityFilter ?? ALL_RARITIES;
    console.log(
      `[cards] Fetching fresh cards for ${slug} (rarities: ${targetRarities.join(",")})...`,
    );
    const fresh = await fetchFromSorare(slug, targetRarities);

    // Merge into existing cache: drop cards of the rarities we just refetched,
    // keep everything else. This lets the client refresh just `limited,rare,
    // super_rare,unique` without losing previously-cached `common` cards.
    const existing = await readCache(slug);
    const targetSet = new Set<RarityType>(targetRarities);
    const kept = existing
      ? existing.cards.filter(
          (c) => !c.rarityTyped || !targetSet.has(c.rarityTyped),
        )
      : [];
    const merged = [...kept, ...fresh];

    await writeCache(slug, merged);

    // Response carries the full merged set so the client can drop it straight
    // into the cache and render. The `partial` flag tells the client whether
    // a follow-up phase is still expected (only when a rarity filter was used).
    return NextResponse.json({
      cards: merged,
      totalCount: merged.length,
      cached: false,
      cachedAt: new Date().toISOString(),
      partial: rarityFilter != null,
      fetchedRarities: targetRarities,
    });
  } catch (error: unknown) {
    console.error("Error fetching cards:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
