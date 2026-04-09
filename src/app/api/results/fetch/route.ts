import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sorareClient } from "@/lib/sorare-client";
import {
  FIXTURE_LEADERBOARDS_QUERY,
  FIXTURE_LEADERBOARDS_BY_SLUG_QUERY,
  LEADERBOARD_RANKINGS_QUERY,
} from "@/lib/queries";
import { sleep } from "@/lib/rate-limiter";
import { shouldScrapeLeaderboard } from "@/lib/results/leaderboard-filter";

interface LeaderboardMeta {
  slug: string;
  displayName: string;
  division: number;
  mainRarityType: string;
  so5LineupsCount: number;
  so5League: { slug: string; displayName: string };
  so5LeaderboardGroup: { displayName: string } | null;
}

interface RankingsPage {
  so5: {
    so5Leaderboard: {
      slug: string;
      so5RankingsPaginated: {
        currentPage: number;
        pages: number;
        totalCount: number;
        nodes: unknown[];
      };
    };
  };
}

function deriveLeagueName(lb: LeaderboardMeta): string {
  return (
    lb.so5LeaderboardGroup?.displayName ||
    lb.so5League?.displayName ||
    lb.displayName
  );
}

const PAGE_SIZE = 50; // 50 per page to stay under Sorare's 30k complexity limit
const MAX_PAGES = 20; // 50 * 20 = top 1000
const DELAY_MS = 250;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureType = searchParams.get("type") || "LIVE";
  const fixtureSlugParam = searchParams.get("fixture"); // e.g. "football-9-03-apr-2026"
  const force = searchParams.get("force") === "true";

  try {
    // 1. Discover fixture and all leaderboards
    let result: any;
    if (fixtureSlugParam) {
      result = await sorareClient.request(
        FIXTURE_LEADERBOARDS_BY_SLUG_QUERY,
        { slug: fixtureSlugParam },
      );
    } else {
      result = await sorareClient.request(
        FIXTURE_LEADERBOARDS_QUERY,
        { type: fixtureType },
      );
    }

    const fixture = result?.so5?.so5Fixture;
    if (!fixture) {
      return NextResponse.json(
        { error: "No fixture found" },
        { status: 404 },
      );
    }

    // 2. Extract all leaderboards, filter to Limited + skip high-div secondary comps
    const allLeaderboards: LeaderboardMeta[] = [];
    for (const league of fixture.so5Leagues ?? []) {
      for (const lb of league.so5Leaderboards ?? []) {
        if (lb.mainRarityType !== "limited") continue;
        const leagueName = deriveLeagueName(lb);
        if (!shouldScrapeLeaderboard(lb.displayName, leagueName, lb.division)) continue;
        allLeaderboards.push(lb);
      }
    }

    console.log(
      `[results-fetch] GW${fixture.gameWeek}: found ${allLeaderboards.length} Limited leaderboards`,
    );

    // 3. Check which are already fetched (idempotent unless force=true)
    let existingSlugs = new Set<string>();
    if (!force) {
      const existing = await prisma.leaderboardResult.findMany({
        where: {
          leaderboardSlug: { in: allLeaderboards.map((lb) => lb.slug) },
        },
        select: { leaderboardSlug: true },
      });
      existingSlugs = new Set(existing.map((e) => e.leaderboardSlug));
    }

    const toFetch = allLeaderboards.filter(
      (lb) => !existingSlugs.has(lb.slug),
    );

    console.log(
      `[results-fetch] ${toFetch.length} to fetch, ${existingSlugs.size} already stored`,
    );

    let fetched = 0;

    // 4. Fetch rankings for each leaderboard
    for (const lb of toFetch) {
      const allNodes: unknown[] = [];
      let totalCount = 0;

      for (let page = 1; page <= MAX_PAGES; page++) {
        try {
          const rankResult = (await sorareClient.request(
            LEADERBOARD_RANKINGS_QUERY,
            { slug: lb.slug, page, pageSize: PAGE_SIZE },
          )) as RankingsPage;

          const paginated =
            rankResult.so5.so5Leaderboard.so5RankingsPaginated;
          totalCount = paginated.totalCount;
          allNodes.push(...paginated.nodes);

          // Stop if no more pages
          if (page >= paginated.pages) break;
        } catch (pageErr) {
          console.error(
            `[results-fetch] Error fetching ${lb.slug} page ${page}:`,
            pageErr,
          );
          break;
        }

        await sleep(DELAY_MS);
      }

      // 5. Store in DB
      const leagueName = deriveLeagueName(lb);
      await prisma.leaderboardResult.upsert({
        where: { leaderboardSlug: lb.slug },
        create: {
          fixtureSlug: fixture.slug,
          gameWeek: fixture.gameWeek,
          leaderboardSlug: lb.slug,
          leaderboardName: lb.displayName,
          leagueSlug: lb.so5League?.slug ?? "",
          leagueName,
          division: lb.division,
          mainRarityType: lb.mainRarityType,
          totalEntries: totalCount,
          rankingsJson: JSON.stringify(allNodes),
        },
        update: {
          rankingsJson: JSON.stringify(allNodes),
          totalEntries: totalCount,
          fetchedAt: new Date(),
        },
      });

      fetched++;
      console.log(
        `[results-fetch] Stored ${lb.displayName}: ${allNodes.length} rankings`,
      );

      await sleep(DELAY_MS);
    }

    return NextResponse.json({
      gameWeek: fixture.gameWeek,
      fixtureSlug: fixture.slug,
      fetched,
      skipped: existingSlugs.size,
      total: allLeaderboards.length,
    });
  } catch (error) {
    console.error("[results-fetch] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 },
    );
  }
}
