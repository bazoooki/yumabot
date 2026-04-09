import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { prisma } from "@/lib/db";
import { PAST_FIXTURES_LIST_QUERY } from "@/lib/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(parseInt(searchParams.get("count") ?? "30", 10), 100);

  try {
    const result: any = await sorareClient.request(PAST_FIXTURES_LIST_QUERY, {
      first: count,
    });

    const fixtures = (result?.so5?.so5Fixtures?.nodes ?? [])
      .map((f: any) => ({
        slug: f.slug,
        gameWeek: f.gameWeek,
        aasmState: f.aasmState,
        endDate: f.endDate,
      }))
      .sort((a: any, b: any) => b.gameWeek - a.gameWeek);

    // Check which are already scraped
    const scraped = await prisma.leaderboardResult.findMany({
      select: { gameWeek: true },
      distinct: ["gameWeek"],
    });
    const scrapedGWs = new Set(scraped.map((r) => r.gameWeek));

    const enriched = fixtures.map((f: any) => ({
      ...f,
      scraped: scrapedGWs.has(f.gameWeek),
    }));

    return NextResponse.json({ fixtures: enriched });
  } catch (error) {
    console.error("[admin-fixtures] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 500 },
    );
  }
}
