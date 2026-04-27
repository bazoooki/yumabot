import { prisma } from "@/lib/db";
import { sorareClient } from "@/lib/sorare-client";
import {
  FIXTURE_LEADERBOARDS_QUERY,
  FIXTURE_LEADERBOARDS_BY_SLUG_QUERY,
  LEADERBOARD_RANKINGS_QUERY,
  LEADERBOARD_STREAK_QUERY,
} from "@/lib/queries";
import { sleep } from "@/lib/rate-limiter";
import { shouldScrapeLeaderboard } from "@/lib/results/leaderboard-filter";
import { recomputeAllForGW } from "@/lib/results/compute-and-cache";
import {
  parseEligibleOrSo5Rewards,
  parseCompletedTasksRewards,
  mergeRewardBreakdowns,
} from "@/lib/rewards";

interface LeaderboardMeta {
  slug: string;
  displayName: string;
  division: number;
  mainRarityType: string;
  seasonality?: string;
  isArena: boolean;
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

// Sorare caps GraphQL query complexity at 30,000 per request. With the
// enriched per-ranking selection (rewards union + completedTasks + appearances),
// a page of 50 measures ~56k, so we halve page size to land safely under the
// cap. MAX_PAGES doubles accordingly to preserve the ~1,000 rankings ceiling.
const PAGE_SIZE = 25;
const MAX_PAGES = 40;
const DELAY_MS = 250;
// Number of parallel workers fetching leaderboards for a GW. Each worker
// has its own slice of `toFetch` and runs its pagination loop independently.
const WORKER_COUNT = 3;

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
            if (lb.isArena) continue;
            const leagueName =
              lb.so5LeaderboardGroup?.displayName ||
              lb.so5League?.displayName ||
              lb.displayName;
            if (!shouldScrapeLeaderboard(lb.displayName, leagueName, lb.division))
              continue;
            allLeaderboards.push(lb);
          }
        }

        const inSeasonCount = allLeaderboards.filter(
          (lb) => lb.seasonality === "IN_SEASON",
        ).length;
        send({
          type: "discovered",
          gameWeek: fixture.gameWeek,
          fixtureSlug: fixture.slug,
          totalLeaderboards: allLeaderboards.length,
          inSeasonCount,
        });

        // Modes:
        //   default → skip rows whose stored data already has the latest
        //             schema (totalEntries > 0 AND rankingsJson contains
        //             thresholdsStreakTask). Failed or stale rows from
        //             older scrapes get refetched automatically.
        //   force   → don't skip anything, refetch everything
        let existingSlugs = new Set<string>();
        if (!force) {
          const slugs = allLeaderboards.map((lb) => lb.slug);
          if (slugs.length > 0) {
            const existing = await prisma.$queryRaw<
              { leaderboardSlug: string }[]
            >`
              SELECT "leaderboardSlug" FROM "LeaderboardResult"
              WHERE "leaderboardSlug" = ANY(${slugs}::text[])
                AND "totalEntries" > 0
                AND position('thresholdsStreakTask' IN "rankingsJson") > 0
            `;
            existingSlugs = new Set(existing.map((e) => e.leaderboardSlug));
          }
        }

        const toFetch = allLeaderboards.filter(
          (lb) => !existingSlugs.has(lb.slug),
        );

        send({
          type: "plan",
          toFetch: toFetch.length,
          skipping: existingSlugs.size,
          mode: force ? "force" : "default",
          workers: WORKER_COUNT,
        });

        const fixtureEnded =
          fixture.aasmState === "closed" ||
          (fixture.endDate && new Date(fixture.endDate).getTime() < Date.now());

        // Partition toFetch across N workers by round-robin index. This keeps
        // each worker's share approximately equal and interleaves league /
        // division variety across all workers so no one worker gets stuck on
        // only-heavy leaderboards.
        const chunks: LeaderboardMeta[][] = Array.from(
          { length: WORKER_COUNT },
          () => [],
        );
        toFetch.forEach((lb, i) => {
          chunks[i % WORKER_COUNT].push(lb);
        });

        let completed = 0;

        // Single-leaderboard fetch+store pipeline used by each worker.
        async function processLeaderboard(
          lb: LeaderboardMeta,
          workerIdx: number,
        ) {
          const leagueName = deriveLeagueName(lb);
          completed += 1;
          const myCurrent = completed;
          send({
            type: "fetching",
            worker: workerIdx + 1,
            leaderboard: leagueName,
            displayName: lb.displayName,
            current: myCurrent,
            total: toFetch.length,
          });

          // Streak thresholds — one small query, in-season only.
          let streakTask: unknown = null;
          if (lb.seasonality === "IN_SEASON") {
            try {
              const streakResult: any = await sorareClient.request(
                LEADERBOARD_STREAK_QUERY,
                { slug: lb.slug },
              );
              streakTask =
                streakResult?.so5?.so5Leaderboard?.so5RankingsPaginated
                  ?.nodes?.[0]?.so5Lineup?.thresholdsStreakTask ?? null;
              send({
                type: "streak",
                worker: workerIdx + 1,
                leaderboard: leagueName,
                displayName: lb.displayName,
                found: streakTask != null,
              });
            } catch (streakErr) {
              send({
                type: "page_error",
                worker: workerIdx + 1,
                leaderboard: leagueName,
                page: 0,
                error: `streak: ${String(streakErr).slice(0, 80)}`,
              });
            }
          }

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
                worker: workerIdx + 1,
                leaderboard: leagueName,
                page,
                totalPages: paginated.pages,
                rankingsSoFar: allNodes.length,
              });

              if (page >= paginated.pages) break;
            } catch (pageErr) {
              send({
                type: "page_error",
                worker: workerIdx + 1,
                leaderboard: leagueName,
                page,
                error: String(pageErr).slice(0, 100),
              });
              break;
            }

            await sleep(DELAY_MS);
          }

          // Enrich + store (same logic as before).
          const enriched = allNodes.map((node, idx) => {
            const n = node as {
              eligibleOrSo5Rewards?: unknown[];
              so5Lineup?: {
                completedTasks?: unknown[];
                thresholdsStreakTask?: unknown;
              };
            };
            const rewards = parseEligibleOrSo5Rewards(
              n.eligibleOrSo5Rewards ?? [],
            );
            mergeRewardBreakdowns(
              rewards,
              parseCompletedTasksRewards(n.so5Lineup?.completedTasks ?? []),
            );
            if (fixtureEnded) rewards.isActual = true;
            const patchedLineup =
              idx === 0 && streakTask
                ? {
                    ...(n.so5Lineup ?? {}),
                    thresholdsStreakTask: streakTask,
                  }
                : n.so5Lineup;
            return {
              ...(node as object),
              so5Lineup: patchedLineup,
              rewards,
            };
          });

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
              rankingsJson: JSON.stringify(enriched),
            },
            update: {
              rankingsJson: JSON.stringify(enriched),
              totalEntries: totalCount,
              fetchedAt: new Date(),
            },
          });

          send({
            type: "stored",
            worker: workerIdx + 1,
            leaderboard: leagueName,
            displayName: lb.displayName,
            rankings: allNodes.length,
            totalEntries: totalCount,
            current: myCurrent,
            total: toFetch.length,
          });

          await sleep(DELAY_MS);
        }

        // Run workers in parallel. Each worker iterates its slice sequentially
        // so we never overshoot Sorare's rate limit beyond WORKER_COUNT req/sec.
        await Promise.all(
          chunks.map(async (chunk, idx) => {
            for (const lb of chunk) {
              try {
                await processLeaderboard(lb, idx);
              } catch (err) {
                send({
                  type: "error",
                  worker: idx + 1,
                  message: `worker ${idx + 1} crashed on ${lb.slug}: ${String(err).slice(0, 120)}`,
                });
              }
            }
          }),
        );

        // Recompute achievements + power rankings
        if (completed > 0) {
          send({ type: "status", message: "Computing..." });
          await recomputeAllForGW(fixture.gameWeek, (step, detail) => {
            send({ type: "compute", step, ...(detail ?? {}) });
          });
          send({ type: "status", message: "Computation complete" });
        } else {
          send({
            type: "status",
            message:
              "No leaderboards fetched (all skipped). Skipping recompute.",
          });
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
