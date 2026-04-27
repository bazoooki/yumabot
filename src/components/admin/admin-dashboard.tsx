"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Circle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LeaderboardDetail {
  slug: string;
  name: string;
  leagueName: string;
  division: number;
  totalEntries: number;
  rankingsCount: number;
  fetchedAt: string;
}

interface GWStatus {
  gameWeek: number;
  fixtureSlug: string;
  leaderboardCount: number;
  withDataCount: number;
  totalRankings: number;
  fetchedAt: string;
  leaderboards: LeaderboardDetail[];
}

interface FixtureInfo {
  slug: string;
  gameWeek: number;
  aasmState: string;
  endDate: string;
  scraped: boolean;
}

interface ScrapeEvent {
  type: string;
  message?: string;
  gameWeek?: number;
  fixtureSlug?: string;
  totalLeaderboards?: number;
  inSeasonCount?: number;
  toFetch?: number;
  skipping?: number;
  mode?: string;
  workers?: number;
  worker?: number;
  leaderboard?: string;
  displayName?: string;
  current?: number;
  total?: number;
  page?: number;
  totalPages?: number;
  rankingsSoFar?: number;
  rankings?: number;
  totalEntries?: number;
  fetched?: number;
  skipped?: number;
  error?: string;
  found?: boolean;
  step?: string;
  ms?: number;
}

async function fetchGWStatus(): Promise<{ gameWeeks: GWStatus[] }> {
  const res = await fetch("/api/admin/gw-status");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchFixtures(): Promise<{ fixtures: FixtureInfo[] }> {
  const res = await fetch("/api/admin/fixtures?count=30");
  if (!res.ok) throw new Error("Failed to fetch fixtures");
  return res.json();
}

function GWCard({
  gw,
  onRescrape,
  isScraping,
}: {
  gw: GWStatus;
  onRescrape: (
    fixture: string,
    gameWeek?: number,
    opts?: { full?: boolean },
  ) => void;
  isScraping: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const fetchedDate = new Date(gw.fetchedAt);
  const age = Math.round(
    (Date.now() - fetchedDate.getTime()) / (1000 * 60 * 60),
  );

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}

        <span className="text-sm font-semibold text-zinc-200">
          GW {gw.gameWeek}
        </span>

        <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
          {gw.fixtureSlug}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {gw.withDataCount > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-xs text-zinc-400">
              {gw.withDataCount}/{gw.leaderboardCount} LBs
            </span>
          </div>

          <span className="text-xs text-zinc-500 tabular-nums">
            {gw.totalRankings.toLocaleString()} rankings
          </span>

          <span className="text-[10px] text-zinc-600">{age}h ago</span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRescrape(gw.fixtureSlug, gw.gameWeek, {
                full: e.shiftKey,
              });
            }}
            disabled={isScraping}
            className="p-1 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50"
            title="Re-scrape failed leaderboards only · shift-click for full refetch"
          >
            <RefreshCw className="w-3 h-3 text-zinc-500" />
          </button>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-2 space-y-0.5 max-h-[300px] overflow-y-auto">
          {gw.leaderboards.map((lb) => (
            <div
              key={lb.slug}
              className="flex items-center justify-between py-1 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    lb.rankingsCount > 0 ? "bg-emerald-500" : "bg-zinc-600",
                  )}
                />
                <span className="text-zinc-300 truncate">
                  {lb.leagueName}
                </span>
                {lb.division > 1 && (
                  <span className="text-zinc-600">Div {lb.division}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-zinc-500 tabular-nums">
                  {lb.rankingsCount.toLocaleString()} /{" "}
                  {lb.totalEntries.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const [scrapeLog, setScrapeLog] = useState<ScrapeEvent[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-gw-status"],
    queryFn: fetchGWStatus,
    staleTime: 30 * 1000,
  });

  const { data: fixturesData, refetch: refetchFixtures } = useQuery({
    queryKey: ["admin-fixtures"],
    queryFn: fetchFixtures,
    staleTime: 60 * 1000,
  });

  const startScrape = useCallback(
    async (params: string) => {
      setIsScraping(true);
      setScrapeLog([]);

      try {
        const res = await fetch(`/api/admin/scrape?${params}`, {
          method: "POST",
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: ScrapeEvent = JSON.parse(line.slice(6));
                setScrapeLog((prev) => [...prev, event]);
                setTimeout(() => {
                  logRef.current?.scrollTo({
                    top: logRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }, 50);
              } catch {}
            }
          }
        }
      } catch (err) {
        setScrapeLog((prev) => [
          ...prev,
          { type: "error", message: String(err) },
        ]);
      }

      setIsScraping(false);
      void refetch();
      void refetchFixtures();
    },
    [refetch, refetchFixtures],
  );

  const handleScrapeFixture = (fixtureSlug: string) => {
    void startScrape(`fixture=${fixtureSlug}`);
  };

  const handleRescrape = (
    fixtureSlug: string,
    gameWeek?: number,
    opts?: { full?: boolean },
  ) => {
    const label = gameWeek != null ? `GW ${gameWeek}` : fixtureSlug;
    if (opts?.full) {
      if (
        !window.confirm(
          `FULL refetch ${label}? This refetches every leaderboard regardless of freshness. Normal rescrape only picks up stale/failed rows.`,
        )
      )
        return;
      void startScrape(`fixture=${fixtureSlug}&force=true`);
    } else {
      if (
        !window.confirm(
          `Rescrape ${label}? Stale and failed leaderboards will be refetched; fresh ones are skipped. Shift-click for full refetch.`,
        )
      )
        return;
      void startScrape(`fixture=${fixtureSlug}`);
    }
  };

  // Progress from log
  const lastStored = scrapeLog.filter((e) => e.type === "stored");
  const doneEvent = scrapeLog.find((e) => e.type === "done");
  const planEvent = scrapeLog.find((e) => e.type === "plan");
  const currentFetching = scrapeLog.findLast((e) => e.type === "fetching");
  const currentPage = scrapeLog.findLast((e) => e.type === "page");

  // Split fixtures into scraped and not
  const fixtures = fixturesData?.fixtures ?? [];
  const unscraped = fixtures.filter(
    (f) => !f.scraped && f.aasmState !== "preparing",
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-emerald-400" />
        <h1 className="text-lg font-semibold text-zinc-200">Results Admin</h1>
      </div>

      {/* Available GWs to scrape */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-4">
        <h2 className="text-sm font-medium text-zinc-300">
          Available Gameweeks
          {unscraped.length > 0 && (
            <span className="text-zinc-600 ml-2">
              ({unscraped.length} not scraped)
            </span>
          )}
        </h2>

        <div className="flex flex-wrap gap-1.5">
          {fixtures.map((f) => (
            <button
              key={f.slug}
              onClick={(e) =>
                f.scraped
                  ? handleRescrape(f.slug, f.gameWeek, { full: e.shiftKey })
                  : handleScrapeFixture(f.slug)
              }
              disabled={isScraping}
              className={cn(
                "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                f.scraped
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  : f.aasmState === "playing"
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700",
                isScraping && "opacity-50",
              )}
              title={
                f.scraped
                  ? `Re-fetch failed LBs · shift-click for full refetch (${f.slug})`
                  : `${f.slug} (${f.aasmState})`
              }
            >
              {f.scraped ? (
                <>
                  <CheckCircle2 className="w-3 h-3 group-hover:hidden" />
                  <RefreshCw className="w-3 h-3 hidden group-hover:block" />
                </>
              ) : f.aasmState === "playing" ? (
                <Circle className="w-3 h-3 fill-amber-400" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              GW {f.gameWeek}
            </button>
          ))}
        </div>
      </div>

      {/* Scrape progress */}
      {(isScraping || scrapeLog.length > 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
          <h2 className="text-sm font-medium text-zinc-300">
            {isScraping ? "Scraping..." : "Last Scrape"}
          </h2>

          {/* Progress bar */}
          {isScraping && planEvent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {currentFetching?.leaderboard ?? "Preparing..."}
                  {currentPage
                    ? ` (page ${currentPage.page}/${currentPage.totalPages})`
                    : ""}
                </span>
                <span className="tabular-nums">
                  {lastStored.length}/{planEvent.toFetch}
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(lastStored.length / (planEvent.toFetch ?? 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Done summary */}
          {doneEvent && !isScraping && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              GW {doneEvent.gameWeek}: {doneEvent.fetched} fetched,{" "}
              {doneEvent.skipped} skipped
            </div>
          )}

          {/* Live log */}
          <div
            ref={logRef}
            className="max-h-[200px] overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-2 space-y-0.5 font-mono text-[10px]"
          >
            {scrapeLog.map((event, i) => (
              <div
                key={i}
                className={cn(
                  event.type === "error"
                    ? "text-red-400"
                    : event.type === "stored"
                      ? "text-emerald-400"
                      : event.type === "done"
                        ? "text-amber-300 font-bold"
                        : "text-zinc-500",
                )}
              >
                {event.type === "status" && event.message}
                {event.type === "discovered" &&
                  `Found GW ${event.gameWeek} (${event.fixtureSlug}) — ${event.totalLeaderboards} Limited LBs (${event.inSeasonCount ?? 0} in-season)`}
                {event.type === "streak" &&
                  `${event.worker ? `[W${event.worker}]` : "  "} streak ${event.found ? "✓" : "∅"} ${event.leaderboard} — ${event.displayName}`}
                {event.type === "plan" &&
                  `Plan [${event.mode ?? "default"}${event.workers ? ` · ${event.workers}×` : ""}]: ${event.toFetch} to fetch, ${event.skipping} skipping`}
                {event.type === "fetching" &&
                  `${event.worker ? `[W${event.worker}] ` : ""}[${event.current}/${event.total}] Fetching ${event.leaderboard}...`}
                {event.type === "page" &&
                  `${event.worker ? `[W${event.worker}] ` : "  "}page ${event.page}/${event.totalPages} (${event.rankingsSoFar} so far)`}
                {event.type === "page_error" &&
                  `${event.worker ? `[W${event.worker}] ` : "  "}ERROR page ${event.page}: ${event.error}`}
                {event.type === "stored" &&
                  (event.rankings === 0
                    ? `${event.worker ? `[W${event.worker}] ` : ""}⚠ ${event.leaderboard} — 0 rankings (0 total entries) — Sorare returned empty`
                    : `${event.worker ? `[W${event.worker}] ` : ""}✓ ${event.leaderboard} — ${event.rankings} rankings (${event.totalEntries} total entries)`)}
                {event.type === "compute" &&
                  `  compute[${event.step}]${
                    event.ms != null ? ` (${event.ms}ms)` : ""
                  }${event.error ? ` — ERR ${event.error}` : ""}`}
                {event.type === "done" &&
                  `DONE: GW ${event.gameWeek} — ${event.fetched} fetched, ${event.skipped} skipped`}
                {event.type === "error" && `ERROR: ${event.message}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stored GWs */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">
          Stored Gameweeks
          {data && (
            <span className="text-zinc-600 ml-2">
              ({data.gameWeeks.length})
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !data || data.gameWeeks.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            No gameweeks stored yet. Click a GW above to scrape it.
          </div>
        ) : (
          <div className="space-y-2">
            {data.gameWeeks.map((gw) => (
              <GWCard
                key={gw.gameWeek}
                gw={gw}
                onRescrape={handleRescrape}
                isScraping={isScraping}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
