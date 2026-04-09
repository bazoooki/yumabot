"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Shield, Info, X } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const clanSlugs = new Set<string>(CLAN_MEMBERS.map((m) => m.slug));

interface RankedEntry {
  rank: number;
  userSlug: string;
  nickname: string;
  pictureUrl: string | null;
  totalPoints: number;
  leaderboardCount: number;
  bestFinish: number;
  topBreakdown: {
    leagueName: string;
    division: number;
    ranking: number;
    totalEntries: number;
    points: number;
  }[];
}

interface PowerRankingsResponse {
  cumulative: boolean;
  gameWeeks: number[];
  totalManagers: number;
  rankings: RankedEntry[];
  clanRankings: RankedEntry[];
}

async function fetchPowerRankings(
  gameWeek?: number,
  cumulative?: boolean,
): Promise<PowerRankingsResponse> {
  const params = new URLSearchParams({ limit: "500" });
  if (cumulative) params.set("cumulative", "true");
  else if (gameWeek) params.set("gameWeek", String(gameWeek));
  const res = await fetch(`/api/results/power-rankings?${params}`);
  if (!res.ok) throw new Error("Failed to fetch power rankings");
  return res.json();
}

function RankRow({ entry, compact }: { entry: RankedEntry; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isClan = clanSlugs.has(entry.userSlug);

  return (
    <div className="border-b border-zinc-800/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/20 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
        )}

        <span
          className={cn(
            "text-xs font-bold tabular-nums w-7 text-right shrink-0",
            entry.rank <= 3
              ? "text-amber-400"
              : entry.rank <= 10
                ? "text-emerald-400"
                : "text-zinc-500",
          )}
        >
          {entry.rank}
        </span>

        {entry.pictureUrl ? (
          <img
            src={entry.pictureUrl}
            alt=""
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />
        )}

        <span
          className={cn(
            "text-xs font-medium truncate flex-1 text-left",
            isClan ? "text-violet-300" : "text-zinc-200",
          )}
        >
          {entry.nickname}
        </span>

        {!compact && (
          <>
            <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">
              {entry.leaderboardCount} LBs
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0 w-14 text-right hidden sm:inline">
              top {entry.bestFinish.toFixed(1)}%
            </span>
          </>
        )}
        <span className="text-xs font-semibold text-emerald-400 tabular-nums shrink-0 w-12 text-right">
          {entry.totalPoints}
        </span>
      </button>

      {expanded && entry.topBreakdown.length > 0 && (
        <div className="px-10 pb-2 space-y-0.5">
          {entry.topBreakdown.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[10px] text-zinc-500"
            >
              <span>
                {b.leagueName}
                {b.division > 1 && ` Div${b.division}`} — #{b.ranking}/
                {b.totalEntries.toLocaleString()}
              </span>
              <span className="text-zinc-400 tabular-nums">+{b.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormulaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-md w-full mx-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Power Ranking Formula</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-zinc-400">
          <div>
            <h3 className="text-zinc-300 font-medium mb-1">Placement Points</h3>
            <p className="mb-1.5">Based on your percentile finish in each competition:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 bg-zinc-800/50 rounded-lg p-2 font-mono text-[11px]">
              <span className="text-emerald-400">Top 1%</span><span className="text-right">100 pts</span>
              <span className="text-emerald-400">Top 5%</span><span className="text-right">80 pts</span>
              <span className="text-zinc-300">Top 10%</span><span className="text-right">60 pts</span>
              <span className="text-zinc-300">Top 25%</span><span className="text-right">40 pts</span>
              <span className="text-zinc-500">Top 50%</span><span className="text-right">20 pts</span>
              <span className="text-zinc-500">Top 100%</span><span className="text-right">5 pts</span>
            </div>
          </div>

          <div>
            <h3 className="text-zinc-300 font-medium mb-1">Division Multiplier</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 bg-zinc-800/50 rounded-lg p-2 font-mono text-[11px]">
              <span className="text-amber-400">Division 1</span><span className="text-right">&times;2.0</span>
              <span className="text-zinc-300">Division 2</span><span className="text-right">&times;1.5</span>
              <span className="text-zinc-500">Division 3+</span><span className="text-right">&times;1.0</span>
            </div>
          </div>

          <div>
            <h3 className="text-zinc-300 font-medium mb-1">Rules</h3>
            <ul className="space-y-1 list-disc list-inside text-zinc-500">
              <li>Only your <span className="text-zinc-300">best entry per competition</span> counts (best across all divisions)</li>
              <li>Only your <span className="text-zinc-300">best team</span> if you have multiple in one leaderboard</li>
              <li>Points are <span className="text-zinc-300">summed across all competitions</span> you enter</li>
              <li>All Time = cumulative across all scraped gameweeks</li>
              <li>GWs with fewer than 3 competitions with data are excluded</li>
            </ul>
          </div>

          <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
            Example: Rank #50 out of 10,000 in All Star Div 1 = top 0.5% = 100 pts &times; 2.0 = 200 pts
          </div>
        </div>
      </div>
    </div>
  );
}

function ClanSidebar({ clanRankings, totalManagers }: { clanRankings: RankedEntry[]; totalManagers: number }) {
  if (clanRankings.length === 0) {
    return (
      <div className="text-xs text-zinc-500 text-center py-6">
        No clan members in rankings
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clanRankings.map((entry) => {
        const clanMember = CLAN_MEMBERS.find((m) => m.slug === entry.userSlug);
        return (
          <div
            key={entry.userSlug}
            className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 space-y-1.5"
          >
            {/* Rank badge */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {entry.pictureUrl ? (
                  <img
                    src={entry.pictureUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700" />
                )}
                <div className="text-sm font-semibold text-violet-300">
                  {clanMember?.name ?? entry.nickname}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-2.5 py-1.5">
              <div>
                <div className="text-lg font-bold text-zinc-100 tabular-nums">
                  #{entry.rank.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">
                  of {totalManagers.toLocaleString()} managers
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-400 tabular-nums">
                  {entry.totalPoints.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">points</div>
              </div>
            </div>

            <div className="space-y-0.5">
              {entry.topBreakdown.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-[9px] text-zinc-500"
                >
                  <span className="truncate">
                    {b.leagueName}
                    {b.division > 1 && ` D${b.division}`}
                  </span>
                  <span className="text-zinc-400 tabular-nums shrink-0 ml-1">
                    +{b.points}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[10px] text-zinc-600 pt-0.5 border-t border-zinc-800/50">
              <span>{entry.leaderboardCount} competitions</span>
              <span>top {entry.bestFinish.toFixed(1)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PAGE_SIZE = 50;

export function PowerRankingsSection({
  gameWeek,
}: {
  gameWeek: number | null;
}) {
  const [cumulative, setCumulative] = useState(true);
  const [page, setPage] = useState(0);
  const [showFormula, setShowFormula] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["power-rankings", cumulative ? "all" : gameWeek, cumulative],
    queryFn: () =>
      fetchPowerRankings(
        cumulative ? undefined : (gameWeek ?? undefined),
        cumulative,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const totalPages = data ? Math.ceil(data.rankings.length / PAGE_SIZE) : 0;
  const pagedRankings = data?.rankings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  return (
    <div className="flex gap-4">
      {/* Main rankings table */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Toggle + stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 bg-zinc-900 rounded-md p-0.5">
            <button
              onClick={() => { setCumulative(true); setPage(0); }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                cumulative
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              All Time
            </button>
            <button
              onClick={() => { setCumulative(false); setPage(0); }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded transition-colors",
                !cumulative
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              This GW
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFormula(true)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 rounded-md border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <Info className="w-3 h-3" />
              Formula
            </button>
            {data && (
              <span className="text-[10px] text-zinc-600">
                {data.totalManagers.toLocaleString()} managers
                {data.cumulative && ` · ${data.gameWeeks.length} GWs`}
              </span>
            )}
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wide">
          <span className="w-3" />
          <span className="w-7 text-right">#</span>
          <span className="w-5" />
          <span className="flex-1">Manager</span>
          <span className="shrink-0 hidden sm:inline">Entries</span>
          <span className="shrink-0 w-14 text-right hidden sm:inline">
            Best %
          </span>
          <span className="shrink-0 w-12 text-right">Points</span>
        </div>

        {/* Rankings list */}
        {isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-7 rounded" />
            ))}
          </div>
        ) : !data || data.rankings.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No power ranking data available
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
              {pagedRankings.map((entry) => (
                <RankRow key={entry.userSlug} entry={entry} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-600">
                  {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, data.rankings.length)} of{" "}
                  {data.rankings.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 10) }).map(
                    (_, i) => {
                      // Show pages around current page
                      let pageNum: number;
                      if (totalPages <= 10) {
                        pageNum = i;
                      } else if (page < 5) {
                        pageNum = i;
                      } else if (page > totalPages - 6) {
                        pageNum = totalPages - 10 + i;
                      } else {
                        pageNum = page - 4 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={cn(
                            "w-6 h-6 text-[10px] rounded",
                            page === pageNum
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "text-zinc-500 hover:bg-zinc-800",
                          )}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    },
                  )}
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={page >= totalPages - 1}
                    className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clan sidebar */}
      <div className="w-56 shrink-0 hidden lg:block space-y-2">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-violet-400" />
          <h3 className="text-xs font-medium text-violet-300">Clan Rankings</h3>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : data ? (
          <ClanSidebar
            clanRankings={data.clanRankings}
            totalManagers={data.totalManagers}
          />
        ) : null}
      </div>

      {showFormula && <FormulaModal onClose={() => setShowFormula(false)} />}
    </div>
  );
}
