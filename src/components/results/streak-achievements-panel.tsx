"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Medal, Trophy, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CLAN_MEMBERS } from "@/lib/clan/members";

const clanSlugs = new Set<string>(CLAN_MEMBERS.map((m) => m.slug));

const LEAGUE_FLAGS: Record<string, string> = {
  "Premier League": "🇬🇧",
  Bundesliga: "🇩🇪",
  "Ligue 1": "🇫🇷",
  "La Liga": "🇪🇸",
  LaLiga: "🇪🇸",
  Eredivisie: "🇳🇱",
  "J1 League": "🇯🇵",
  "K League 1": "🇰🇷",
  MLS: "🇺🇸",
  "Jupiler Pro League": "🇧🇪",
  Challenger: "🌍",
  Contender: "🏆",
};

function flagFor(league: string): string | null {
  if (LEAGUE_FLAGS[league]) return LEAGUE_FLAGS[league];
  for (const [name, flag] of Object.entries(LEAGUE_FLAGS)) {
    if (league.toLowerCase().includes(name.toLowerCase())) return flag;
  }
  return null;
}

interface ManagerEntry {
  userSlug: string;
  nickname: string;
  pictureUrl: string | null;
  score: number;
  ranking: number | null;
  teamsCount: number;
  lineup: Array<{
    playerName: string;
    playerSlug: string;
    cardSlug: string | null;
    score: number;
    captain: boolean;
    position: string;
  }>;
}

interface LevelEntry {
  level: number;
  score: number;
  rewardLabel: string;
  rewardKind: "cash" | "essence" | "coin" | "other";
  managerCount: number;
  managers: ManagerEntry[];
}

interface LeaderboardEntry {
  leaderboardSlug: string;
  leaderboardName: string;
  leagueName: string;
  division: number;
  mainRarityType: string;
  totalEntries: number;
  totalManagers: number;
  levels: LevelEntry[];
}

interface StreakAchievementsResponse {
  gameWeek: number;
  leaderboards: LeaderboardEntry[];
}

async function fetchStreakAchievements(
  gameWeek?: number,
): Promise<StreakAchievementsResponse> {
  const url = gameWeek
    ? `/api/results/streak-achievements?gameWeek=${gameWeek}`
    : "/api/results/streak-achievements";
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch streak achievements");
  }
  return res.json();
}

function RewardBadge({
  kind,
  label,
}: {
  kind: LevelEntry["rewardKind"];
  label: string;
}) {
  const color =
    kind === "cash"
      ? "text-emerald-400"
      : kind === "essence"
        ? "text-amber-400"
        : kind === "coin"
          ? "text-sky-400"
          : "text-zinc-400";
  return <span className={cn("text-xs font-bold tabular-nums", color)}>{label}</span>;
}

function ManagerRow({
  m,
  onOpen,
}: {
  m: ManagerEntry;
  onOpen: (m: ManagerEntry) => void;
}) {
  const isClan = clanSlugs.has(m.userSlug);
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/40 transition-colors text-left"
    >
      {m.pictureUrl ? (
        <img
          src={m.pictureUrl}
          alt=""
          className="w-5 h-5 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />
      )}
      <span
        className={cn(
          "text-xs font-medium truncate flex-1",
          isClan ? "text-violet-300" : "text-zinc-200",
        )}
      >
        {m.nickname}
      </span>
      {m.teamsCount > 1 && (
        <span
          className="text-[9px] text-zinc-500 shrink-0"
          title={`${m.teamsCount} teams — showing best`}
        >
          ×{m.teamsCount}
        </span>
      )}
      {m.ranking != null && (
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 w-10 text-right">
          #{m.ranking}
        </span>
      )}
      <span className="text-xs font-bold text-white tabular-nums shrink-0 w-10 text-right">
        {Math.round(m.score)}
      </span>
    </button>
  );
}

function ManagerLineupModal({
  manager,
  level,
  leaderboardName,
  onClose,
}: {
  manager: ManagerEntry;
  level: LevelEntry | null;
  leaderboardName: string;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const isClan = clanSlugs.has(manager.userSlug);
  // Sort lineup slots by their original index, then render as a row.
  const slots = [...manager.lineup].sort((a, b) => {
    const aIdx = (a as unknown as { index?: number }).index ?? 0;
    const bIdx = (b as unknown as { index?: number }).index ?? 0;
    return aIdx - bIdx;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          {manager.pictureUrl ? (
            <img
              src={manager.pictureUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-sm font-semibold truncate",
                isClan ? "text-violet-300" : "text-zinc-100",
              )}
            >
              {manager.nickname}
            </div>
            <div className="text-[10px] text-zinc-500 truncate">
              {leaderboardName}
              {manager.teamsCount > 1 && (
                <span className="ml-1.5 text-zinc-600">
                  · {manager.teamsCount} teams (showing best)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tabular-nums">
              {Math.round(manager.score)}
            </span>
            <span className="text-[10px] text-zinc-500">pts</span>
          </div>
          {manager.ranking != null && (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-zinc-300 tabular-nums">
                #{manager.ranking}
              </span>
              <span className="text-[10px] text-zinc-500">rank</span>
            </div>
          )}
          {level && (
            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wide">
                LVL {level.level}
              </span>
              <RewardBadge kind={level.rewardKind} label={level.rewardLabel} />
            </div>
          )}
        </div>

        {/* Lineup grid */}
        <div className="px-4 py-4">
          {slots.length === 0 ? (
            <p className="text-[11px] text-zinc-500 text-center py-4">
              No lineup details captured
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {slots.map((s, i) => (
                <div
                  key={`${s.playerSlug || s.cardSlug || ""}-${i}`}
                  className={cn(
                    "rounded-lg border bg-zinc-900/60 p-2 flex flex-col items-center gap-1 text-center",
                    s.captain
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-zinc-800",
                  )}
                >
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wide">
                    {s.position || "—"}
                    {s.captain && (
                      <span className="ml-0.5 text-amber-400">C</span>
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-200 truncate w-full">
                    {s.playerName || "—"}
                  </div>
                  <div className="text-sm font-bold text-white tabular-nums">
                    {Math.round(s.score)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeagueRow({
  leaderboard,
  level,
  onOpenManager,
}: {
  leaderboard: LeaderboardEntry;
  level: LevelEntry;
  onOpenManager: (m: ManagerEntry, level: LevelEntry, lb: LeaderboardEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const flag = flagFor(leaderboard.leagueName);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
        )}
        <span className="text-base shrink-0 leading-none w-5 text-center">
          {flag ?? "·"}
        </span>
        <span className="text-xs font-semibold text-zinc-200 truncate flex-1 text-left">
          {leaderboard.leagueName}
        </span>
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {level.score}
          <span className="text-[9px] text-zinc-600 ml-0.5">pts</span>
        </span>
        <RewardBadge kind={level.rewardKind} label={level.rewardLabel} />
        <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
          <span className="text-xs font-bold text-zinc-100 tabular-nums">
            {level.managerCount.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-600">
            {level.managerCount === 1 ? "mgr" : "mgrs"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 max-h-72 overflow-y-auto">
          {level.managers.length === 0 ? (
            <p className="text-[11px] text-zinc-500 text-center py-4">
              No managers cleared this level
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {level.managers.map((m) => (
                <ManagerRow
                  key={m.userSlug}
                  m={m}
                  onOpen={(manager) => onOpenManager(manager, level, leaderboard)}
                />
              ))}
              {level.managerCount > level.managers.length && (
                <p className="text-[10px] text-zinc-600 text-center py-1.5">
                  … and{" "}
                  {(level.managerCount - level.managers.length).toLocaleString()}{" "}
                  more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StreakAchievementsPanel({
  gameWeek,
}: {
  gameWeek: number | null;
}) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [modal, setModal] = useState<{
    manager: ManagerEntry;
    level: LevelEntry;
    leaderboard: LeaderboardEntry;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["streak-achievements", gameWeek],
    queryFn: () => fetchStreakAchievements(gameWeek ?? undefined),
    enabled: gameWeek !== null,
    staleTime: 60 * 1000,
    retry: false,
  });

  // One entry per competition — prefer lowest division (top tier).
  const dedupedLeaderboards = useMemo<LeaderboardEntry[]>(() => {
    if (!data) return [];
    const byLeague = new Map<string, LeaderboardEntry>();
    for (const lb of data.leaderboards) {
      const existing = byLeague.get(lb.leagueName);
      if (!existing || lb.division < existing.division) {
        byLeague.set(lb.leagueName, lb);
      }
    }
    return Array.from(byLeague.values()).sort((a, b) =>
      a.leagueName.localeCompare(b.leagueName),
    );
  }, [data]);

  const availableLevels = useMemo<number[]>(() => {
    const s = new Set<number>();
    for (const lb of dedupedLeaderboards) {
      for (const l of lb.levels) s.add(l.level);
    }
    return [...s].sort((a, b) => a - b);
  }, [dedupedLeaderboards]);

  const activeLevel = useMemo<number | null>(() => {
    if (availableLevels.length === 0) return null;
    if (selectedLevel != null && availableLevels.includes(selectedLevel)) {
      return selectedLevel;
    }
    return availableLevels[0];
  }, [availableLevels, selectedLevel]);

  const leagueRows = useMemo(() => {
    if (activeLevel == null) return [];
    return dedupedLeaderboards
      .map((lb) => ({ lb, level: lb.levels.find((l) => l.level === activeLevel) }))
      .filter((r): r is { lb: LeaderboardEntry; level: LevelEntry } => !!r.level)
      .sort((a, b) => b.level.managerCount - a.level.managerCount);
  }, [dedupedLeaderboards, activeLevel]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Medal className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-zinc-200">
          Manager Achievements
        </h2>
        {data && (
          <span className="text-[10px] text-zinc-600 ml-auto">
            GW {data.gameWeek}
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-7 rounded" />
      ) : error || !data || data.leaderboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2 text-center">
          <Trophy className="w-8 h-8 text-zinc-700" />
          <p className="text-[11px] text-zinc-500 max-w-[240px]">
            No streak data for this gameweek. Rescrape the GW to capture streak
            thresholds.
          </p>
        </div>
      ) : (
        <>
          {/* Level tabs */}
          <div className="flex items-stretch gap-1 rounded-md bg-zinc-900/60 border border-zinc-800 p-1 shrink-0">
            {availableLevels.map((lvl) => {
              const isActive = lvl === activeLevel;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60",
                  )}
                >
                  Level {lvl}
                </button>
              );
            })}
          </div>

          {/* League list for selected level */}
          <div className="space-y-1.5 overflow-y-auto flex-1">
            {leagueRows.length === 0 ? (
              <p className="text-[11px] text-zinc-500 text-center py-4">
                No data for this level
              </p>
            ) : (
              leagueRows.map(({ lb, level }) => (
                <LeagueRow
                  key={lb.leaderboardSlug}
                  leaderboard={lb}
                  level={level}
                  onOpenManager={(manager, lvl, lbArg) =>
                    setModal({ manager, level: lvl, leaderboard: lbArg })
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {modal && (
        <ManagerLineupModal
          manager={modal.manager}
          level={modal.level}
          leaderboardName={modal.leaderboard.leagueName}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
