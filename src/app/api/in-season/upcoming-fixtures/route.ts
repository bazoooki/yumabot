import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import {
  IN_SEASON_UPCOMING_LIST_QUERY,
  IN_SEASON_FIXTURE_LEAGUES_QUERY,
} from "@/lib/queries";
import { slugifyLeague } from "@/lib/in-season/eligibility";
import { prisma } from "@/lib/db";
import type { InSeasonCompetition, InSeasonStreak } from "@/lib/types";
import type { RarityType, InSeasonTeam } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic";

// Fixture metadata barely moves — bump the TTL high so HMR reloads, repeated
// dev-iteration requests, and multiple users all reuse one Sorare round-trip.
const CACHE_KEY = "in-season-upcoming-fixtures:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;
// On a 429, set a short-circuit lock so we don't keep re-hammering Sorare
// while the cool-off window runs. Default 60s if Sorare doesn't tell us.
const RATE_LIMIT_KEY = "in-season-upcoming-fixtures:rate-limited-until";
const DEFAULT_BACKOFF_MS = 60 * 1000;

interface SorareErrorLike {
  response?: { status?: number; headers?: { get?(name: string): string | null } };
}

function parseRetryAfterMs(err: unknown): number {
  const r = (err as SorareErrorLike | undefined)?.response;
  if (!r || r.status !== 429) return 0;
  const header = r.headers?.get?.("retry-after");
  const seconds = header ? Number.parseInt(header, 10) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return DEFAULT_BACKOFF_MS;
}

interface FixtureMetadata {
  slug: string;
  aasmState: string;
  gameWeek: number;
  endDate: string;
}

interface UpcomingFixtureNode extends FixtureMetadata {
  competitions: InSeasonCompetition[];
}

function deriveLeagueName(lb: any): string {
  return (
    lb.so5LeaderboardGroup?.displayName ??
    lb.so5League?.displayName ??
    lb.displayName ??
    ""
  );
}

function parseUpcomingFixture(fixture: any): InSeasonCompetition[] {
  const leagues = fixture?.so5Leagues ?? [];
  const competitions: InSeasonCompetition[] = [];

  for (const league of leagues) {
    const leaderboards = league.so5Leaderboards ?? [];
    for (const lb of leaderboards) {
      if (lb.seasonality !== "IN_SEASON") continue;

      const streak: InSeasonStreak | null = null;
      const emptyTeams: InSeasonTeam[] = Array.from(
        { length: lb.teamsCap ?? 4 },
        (_, i) => ({
          name: `Team #${i + 1}`,
          lineupSlug: null,
          slots: [],
          totalScore: null,
          rewardMultiplier: 1,
          canEdit: true,
          ranking: null,
          rewardUsdCents: 0,
          rewardEssence: [],
          rewardIsActual: false,
        }),
      );

      const leagueName = deriveLeagueName(lb);
      competitions.push({
        slug: lb.slug,
        displayName: lb.displayName ?? "",
        leagueName,
        leagueSlug: slugifyLeague(leagueName),
        seasonality: lb.seasonality,
        mainRarityType: (lb.mainRarityType as RarityType) ?? "limited",
        division: lb.division ?? 1,
        teamsCap: lb.teamsCap ?? 4,
        cutOffDate: lb.cutOffDate ?? "",
        canCompose: lb.canCompose?.value ?? false,
        iconUrl: lb.iconUrl ?? league.iconUrl ?? "",
        stadiumUrl: lb.stadiumUrl ?? null,
        teams: emptyTeams,
        streak,
        eligibleCardCount: 0,
      });
    }
  }

  competitions.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  return competitions;
}

// Returns the next N fixtures that carry at least one IN_SEASON leaderboard,
// anchored on "now". The list query returns descending by date; we sort
// ascending by endDate and keep entries whose end is recent-ish (we include
// the currently-in-progress fixture even if its lock has passed) up to a
// few weeks out. This is what the user means by "current GW" — the fixture
// covering the present, plus the next handful.
export async function GET() {
  // 1. Fresh cache → serve.
  let cachedRow: { dataJson: string; computedAt: Date } | null = null;
  try {
    cachedRow = await prisma.computedResults.findUnique({
      where: { key: CACHE_KEY },
    });
    if (cachedRow && Date.now() - cachedRow.computedAt.getTime() < CACHE_TTL_MS) {
      return NextResponse.json(JSON.parse(cachedRow.dataJson));
    }
  } catch (err) {
    console.warn("[in-season] upcoming-fixtures cache read failed", err);
  }

  // 2. Inside a rate-limit cool-off → don't try Sorare. Return whatever
  //    cache we have (even if stale), or an empty payload as a soft 200
  //    so the UI doesn't show an error during the cool-down.
  try {
    const lock = await prisma.computedResults.findUnique({
      where: { key: RATE_LIMIT_KEY },
    });
    if (lock) {
      const until = JSON.parse(lock.dataJson).until as number;
      if (Date.now() < until) {
        if (cachedRow) {
          return NextResponse.json({
            ...JSON.parse(cachedRow.dataJson),
            stale: true,
            rateLimitedUntil: until,
          });
        }
        return NextResponse.json({
          fixtures: [],
          stale: true,
          rateLimitedUntil: until,
        });
      }
    }
  } catch (err) {
    console.warn("[in-season] rate-limit lock read failed", err);
  }

  try {
    const listResult = (await sorareClient.request(
      IN_SEASON_UPCOMING_LIST_QUERY,
      { first: 16 },
    )) as { so5?: { so5Fixtures?: { nodes?: FixtureMetadata[] } } };

    const meta = listResult?.so5?.so5Fixtures?.nodes ?? [];
    if (meta.length === 0) {
      return NextResponse.json({ fixtures: [] });
    }

    // Anchor on now. Keep fixtures whose endDate is within [now - 4d, +∞)
    // so the in-progress GW (already locked, possibly finishing today)
    // still shows next to upcoming ones. Cap the output to the closest 10.
    const now = Date.now();
    const lookbackMs = 4 * 24 * 60 * 60 * 1000;
    const sorted = meta
      .filter((m) => {
        const t = new Date(m.endDate).getTime();
        return Number.isFinite(t) && t >= now - lookbackMs;
      })
      .sort(
        (a, b) =>
          new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
      )
      .slice(0, 10);

    // Fan out per-fixture lookups in parallel — Sorare won't return the
    // leaderboards for plural connections, so this is the only path.
    const detailed = await Promise.all(
      sorted.map(async (m) => {
        try {
          const result = (await sorareClient.request(
            IN_SEASON_FIXTURE_LEAGUES_QUERY,
            { slug: m.slug },
          )) as { so5?: { so5Fixture?: any } };
          const f = result?.so5?.so5Fixture;
          if (!f) return null;
          const competitions = parseUpcomingFixture(f);
          if (competitions.length === 0) return null;
          const node: UpcomingFixtureNode = {
            slug: m.slug,
            aasmState: m.aasmState,
            gameWeek: m.gameWeek,
            endDate: m.endDate,
            competitions,
          };
          return node;
        } catch (err) {
          console.warn(
            `[in-season] failed to load fixture ${m.slug}:`,
            err,
          );
          return null;
        }
      }),
    );

    const fixtures = detailed.filter(
      (f): f is UpcomingFixtureNode => f !== null,
    );
    const payload = { fixtures };

    try {
      await prisma.computedResults.upsert({
        where: { key: CACHE_KEY },
        create: { key: CACHE_KEY, dataJson: JSON.stringify(payload) },
        update: {
          dataJson: JSON.stringify(payload),
          computedAt: new Date(),
        },
      });
    } catch (err) {
      console.warn("[in-season] upcoming-fixtures cache write failed", err);
    }

    return NextResponse.json(payload);
  } catch (error) {
    const backoffMs = parseRetryAfterMs(error);
    if (backoffMs > 0) {
      const until = Date.now() + backoffMs;
      console.warn(
        `[in-season] Sorare 429 — locking out for ${Math.round(backoffMs / 1000)}s`,
      );
      try {
        await prisma.computedResults.upsert({
          where: { key: RATE_LIMIT_KEY },
          create: { key: RATE_LIMIT_KEY, dataJson: JSON.stringify({ until }) },
          update: {
            dataJson: JSON.stringify({ until }),
            computedAt: new Date(),
          },
        });
      } catch (lockErr) {
        console.warn("[in-season] rate-limit lock write failed", lockErr);
      }
      // Return whatever we have, soft. The UI's empty state is benign.
      if (cachedRow) {
        return NextResponse.json({
          ...JSON.parse(cachedRow.dataJson),
          stale: true,
          rateLimitedUntil: until,
        });
      }
      return NextResponse.json({
        fixtures: [],
        stale: true,
        rateLimitedUntil: until,
      });
    }

    console.error("[in-season] upcoming-fixtures error:", error);
    if (cachedRow) {
      return NextResponse.json({
        ...JSON.parse(cachedRow.dataJson),
        stale: true,
      });
    }
    return NextResponse.json(
      { error: "Failed to fetch upcoming fixtures" },
      { status: 500 },
    );
  }
}
