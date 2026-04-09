import { prisma } from "@/lib/db";
import { sorareClient } from "@/lib/sorare-client";
import {
  FIXTURE_LEADERBOARDS_QUERY,
  FIXTURE_LEADERBOARDS_BY_SLUG_QUERY,
  LEADERBOARD_RANKINGS_QUERY,
} from "@/lib/queries";
import { sleep } from "@/lib/rate-limiter";
import { shouldScrapeLeaderboard } from "@/lib/results/leaderboard-filter";
import { recomputeAllForGW } from "@/lib/results/compute-and-cache";

interface LeaderboardMeta {
  slug: string;
  displayName: string;
  division: number;
  mainRarityType: string;
  so5LineupsCount: number;
  so5League: { slug: string; displayName: string };
  so5LeaderboardGroup: { displayName: string } | null;
}

function deriveLeagueName(lb: LeaderboardMeta): string {
  return (
    lb.so5LeaderboardGroup?.displayName ||
    lb.so5League?.displayName ||
    lb.displayName
  );
}

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const DELAY_MS = 250;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureType = searchParams.get("type") || "PAST";
  const fixtureSlugParam = searchParams.get("fixture");
  const force = searchParams.get("force") === "true";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        send({ type: "status", message: "Discovering leaderboards..." });

        let result: any;
        if (fixtureSlugParam) {
          result = await sorareClient.request(
            FIXTURE_LEADERBOARDS_BY_SLUG_QUERY,
            { slug: fixtureSlugParam },
          );
        } else {
          result = await sorareClient.request(FIXTURE_LEADERBOARDS_QUERY, {
            type: fixtureType,
          });
        }

        const fixture = result?.so5?.so5Fixture;
        if (!fixture) {
          send({ type: "error", message: "No fixture found" });
          controller.close();
          return;
        }

        const allLeaderboards: LeaderboardMeta[] = [];
        for (const league of fixture.so5Leagues ?? []) {
          for (const lb of league.so5Leaderboards ?? []) {
            if (lb.mainRarityType !== "limited") continue;
            const leagueName =
              lb.so5LeaderboardGroup?.displayName ||
              lb.so5League?.displayName ||
              lb.displayName;
            if (!shouldScrapeLeaderboard(lb.displayName, leagueName, lb.division))
              continue;
            allLeaderboards.push(lb);
          }
        }

        send({
          type: "discovered",
          gameWeek: fixture.gameWeek,
          fixtureSlug: fixture.slug,
          totalLeaderboards: allLeaderboards.length,
        });

        // Check existing
        let existingSlugs = new Set<string>();
        if (!force) {
          const existing = await prisma.leaderboardResult.findMany({
            where: {
              leaderboardSlug: {
                in: allLeaderboards.map((lb) => lb.slug),
              },
            },
            select: { leaderboardSlug: true },
          });
          existingSlugs = new Set(existing.map((e) => e.leaderboardSlug));
        }

        const toFetch = allLeaderboards.filter(
          (lb) => !existingSlugs.has(lb.slug),
        );

        send({
          type: "plan",
          toFetch: toFetch.length,
          skipping: existingSlugs.size,
        });

        let completed = 0;

        for (const lb of toFetch) {
          const leagueName = deriveLeagueName(lb);
          send({
            type: "fetching",
            leaderboard: leagueName,
            displayName: lb.displayName,
            current: completed + 1,
            total: toFetch.length,
          });

          const allNodes: unknown[] = [];
          let totalCount = 0;

          for (let page = 1; page <= MAX_PAGES; page++) {
            try {
              const rankResult: any = await sorareClient.request(
                LEADERBOARD_RANKINGS_QUERY,
                { slug: lb.slug, page, pageSize: PAGE_SIZE },
              );

              const paginated =
                rankResult.so5.so5Leaderboard.so5RankingsPaginated;
              totalCount = paginated.totalCount;
              allNodes.push(...paginated.nodes);

              send({
                type: "page",
                leaderboard: leagueName,
                page,
                totalPages: paginated.pages,
                rankingsSoFar: allNodes.length,
              });

              if (page >= paginated.pages) break;
            } catch (pageErr) {
              send({
                type: "page_error",
                leaderboard: leagueName,
                page,
                error: String(pageErr).slice(0, 100),
              });
              break;
            }

            await sleep(DELAY_MS);
          }

          // Store
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

          completed++;
          send({
            type: "stored",
            leaderboard: leagueName,
            displayName: lb.displayName,
            rankings: allNodes.length,
            totalEntries: totalCount,
            current: completed,
            total: toFetch.length,
          });

          await sleep(DELAY_MS);
        }

        // Recompute achievements + power rankings
        if (completed > 0) {
          send({ type: "status", message: "Computing achievements & power rankings..." });
          await recomputeAllForGW(fixture.gameWeek);
          send({ type: "status", message: "Computation complete" });
        }

        send({
          type: "done",
          gameWeek: fixture.gameWeek,
          fetched: completed,
          skipped: existingSlugs.size,
          total: allLeaderboards.length,
        });
      } catch (error) {
        send({
          type: "error",
          message: String(error).slice(0, 200),
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
