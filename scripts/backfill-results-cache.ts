/**
 * One-shot backfill: populate ComputedResults with `results:{gameWeek}` entries
 * for every existing gameweek in LeaderboardResult. Idempotent (upserts).
 *
 * Usage: npx tsx scripts/backfill-results-cache.ts
 */
import { prisma } from "../src/lib/db";
import { computeResultsForGW } from "../src/lib/results/compute-and-cache";

async function main() {
  const rows = await prisma.leaderboardResult.findMany({
    select: { gameWeek: true },
    distinct: ["gameWeek"],
    orderBy: { gameWeek: "desc" },
  });

  console.log(`[backfill] Found ${rows.length} gameweeks to backfill`);

  let ok = 0;
  let empty = 0;
  for (const { gameWeek } of rows) {
    const result = await computeResultsForGW(gameWeek);
    if (result) ok++;
    else empty++;
  }

  console.log(`[backfill] Done — cached: ${ok}, empty: ${empty}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill] Fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
