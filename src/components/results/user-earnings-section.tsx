"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUsdFromCents } from "@/lib/rewards";
import { cn } from "@/lib/utils";

const clanSlugs = new Set<string>(CLAN_MEMBERS.map((m) => m.slug));

interface BreakdownRow {
  leaderboardSlug: string;
  leaderboardName: string;
  leagueName: string;
  division: number;
  mainRarityType: string;
  rank: number;
  usdCents: number;
  isActual: boolean;
}

interface EarningsEntry {
  rank: number;
  userSlug: string;
  nickname: string;
  pictureUrl: string | null;
  totalUsdCents: number;
  teamsCount: number;
  anyActual: boolean;
  allActual: boolean;
  status: "LIVE" | "PARTIAL" | "FINAL";
  breakdown: BreakdownRow[];
}

interface EarningsResponse {
  gameWeek: number;
  totalManagers: number;
  rankings: EarningsEntry[];
}

async function fetchEarnings(gameWeek?: number): Promise<EarningsResponse> {
  const url = gameWeek
    ? `/api/results/user-earnings?gameWeek=${gameWeek}`
    : "/api/results/user-earnings";
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch earnings");
  }
  return res.json();
}

function StatusBadge({ status }: { status: EarningsEntry["status"] }) {
  const styles = {
    FINAL: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    PARTIAL: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    LIVE: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  } as const;
  return (
    <span
      className={cn(
        "text-[9px] font-medium px-1.5 py-0.5 rounded border",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}

function EarningsRow({ entry }: { entry: EarningsEntry }) {
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

        <StatusBadge status={entry.status} />

        <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline w-12 text-right">
          {entry.teamsCount} team{entry.teamsCount !== 1 ? "s" : ""}
        </span>

        <span className="text-sm font-bold text-emerald-400 tabular-nums shrink-0 w-16 text-right">
          {formatUsdFromCents(entry.totalUsdCents)}
        </span>
      </button>

      {expanded && entry.breakdown.length > 0 && (
        <div className="px-10 pb-2 space-y-0.5">
          {entry.breakdown
            .slice()
            .sort((a, b) => b.usdCents - a.usdCents)
            .map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[10px] text-zinc-500"
              >
                <span className="truncate">
                  {b.leagueName}
                  {b.division > 1 && ` Div${b.division}`} — #{b.rank}
                  {b.isActual ? "" : " (projected)"}
                </span>
                <span className="text-emerald-400 tabular-nums shrink-0 ml-2">
                  {formatUsdFromCents(b.usdCents)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export function UserEarningsSection({ gameWeek }: { gameWeek: number | null }) {
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-earnings", gameWeek],
    queryFn: () => fetchEarnings(gameWeek ?? undefined),
    enabled: gameWeek !== null,
    staleTime: 60 * 1000,
  });

  const totalPages = data ? Math.ceil(data.rankings.length / PAGE_SIZE) : 0;
  const pagedRankings =
    data?.rankings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];

  const totalPool =
    data?.rankings.reduce((sum, r) => sum + r.totalUsdCents, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-7 rounded" />
        ))}
      </div>
    );
  }

  if (error || !data || data.rankings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-2">
        <DollarSign className="w-10 h-10 text-zinc-600" />
        <p className="text-sm text-zinc-500 text-center">
          No earnings data available.
          <br />
          Scrape the gameweek first — rewards are captured alongside rankings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wide">
            Total pool paid out
          </span>
          <span className="text-lg font-bold text-emerald-400 tabular-nums">
            {formatUsdFromCents(totalPool)}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">
          {data.totalManagers.toLocaleString()} winning managers
        </span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wide">
        <span className="w-3" />
        <span className="w-7 text-right">#</span>
        <span className="w-5" />
        <span className="flex-1">Manager</span>
        <span className="shrink-0 w-12" />
        <span className="shrink-0 w-12 text-right hidden sm:inline">Teams</span>
        <span className="shrink-0 w-16 text-right">Total $</span>
      </div>

      {/* List */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden max-h-[calc(100vh-320px)] overflow-y-auto">
        {pagedRankings.map((entry) => (
          <EarningsRow key={entry.userSlug} entry={entry} />
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
            <span className="text-[10px] text-zinc-500 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
