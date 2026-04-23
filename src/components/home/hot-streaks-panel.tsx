"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type {
  InSeasonCompetition,
  InSeasonTeam,
  InSeasonStreak,
  RarityType,
} from "@/lib/types";
import {
  computeTeamClearance,
  type TeamClearance,
} from "@/lib/in-season/clearance-odds";
import type { MyStreaksResponse } from "@/app/api/in-season/my-streaks/route";
import type { PlayedTracksResponse } from "@/app/api/in-season/played-tracks/route";
import { LineupCard } from "@/components/lineup-card/lineup-card";
import {
  Flame,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Trophy,
  Sparkles,
} from "lucide-react";

// One row per (league, rarity). All divisions the user plays in that league+
// rarity are merged into the same row (thresholds are the same across
// divisions in the same league+rarity). Each "liveDivision" carries its own
// live InSeasonCompetition with teams so we can render team-level detail on
// expand.
interface HotStreakEntry {
  key: string; // `${leagueName}::${mainRarityType}` — stable across fixtures
  leagueName: string;
  mainRarityType: RarityType;
  iconUrl: string | null;
  streak: InSeasonStreak | null;
  // Every division the user has a live lineup in, grouped into one entry.
  liveDivisions: Array<{
    division: number;
    competition: InSeasonCompetition;
    activeTeams: InSeasonTeam[];
  }>;
  hasLiveLineup: boolean;
}

async function fetchMyStreaks(): Promise<MyStreaksResponse | null> {
  const res = await fetch(`/api/in-season/my-streaks`);
  if (!res.ok) return null;
  return (await res.json()) as MyStreaksResponse;
}

async function fetchPlayedTracks(
  userSlug: string,
): Promise<PlayedTracksResponse | null> {
  const res = await fetch(
    `/api/in-season/played-tracks?userSlug=${encodeURIComponent(userSlug)}&fixtures=6`,
  );
  if (!res.ok) return null;
  return (await res.json()) as PlayedTracksResponse;
}

interface HotStreaksPanelProps {
  liveCompetitions: InSeasonCompetition[] | undefined;
  liveLoading: boolean;
  liveGameWeek: number | undefined;
  userSlug: string;
  onNavigate: (tab: string) => void;
}

export function HotStreaksPanel({
  liveCompetitions,
  liveLoading,
  liveGameWeek,
  userSlug,
  onNavigate,
}: HotStreaksPanelProps) {
  const { data: myStreaksData, isLoading: myStreaksLoading } = useQuery({
    queryKey: ["in-season-my-streaks"],
    queryFn: fetchMyStreaks,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: playedTracksData, isLoading: playedLoading } = useQuery({
    queryKey: ["in-season-played-tracks", userSlug],
    queryFn: () => fetchPlayedTracks(userSlug),
    staleTime: 10 * 60 * 1000,
    enabled: Boolean(userSlug),
  });

  const entries: HotStreakEntry[] = useMemo(() => {
    const inSeasonLive = (liveCompetitions ?? []).filter(
      (c) => c.seasonality === "IN_SEASON",
    );

    // Authoritative set of in-season (leagueName, rarity) keys for the
    // upcoming GW. Used to drop arena/leaderboard-only comps like "All Star",
    // "Champion", "European Leagues" that can appear in LIVE or played-tracks
    // but aren't real in-season tracks.
    //
    // Note: we key by `leagueName` (e.g. "Jupiler Pro League") — NOT
    // `leagueSlug` — because Sorare's league slug is fixture-scoped
    // (`football-21-apr-…-seasonal-jupiler` vs `football-24-apr-…-seasonal-jupiler`)
    // so slugs from the UPCOMING and LIVE fixtures never match.
    const upcomingInSeasonKeys = new Set<string>();
    for (const meta of myStreaksData?.competitions ?? []) {
      upcomingInSeasonKeys.add(`${meta.leagueName}::${meta.mainRarityType}`);
    }
    const isInSeasonKey = (leagueName: string, rarity: string): boolean => {
      // If the upcoming fixture hasn't loaded yet, don't filter aggressively
      // (fall back to trusting the LIVE seasonality field + played-tracks).
      if (upcomingInSeasonKeys.size === 0) return true;
      return upcomingInSeasonKeys.has(`${leagueName}::${rarity}`);
    };

    const out = new Map<string, HotStreakEntry>();
    const seedEntry = (
      leagueName: string,
      rarity: RarityType,
      iconUrl: string | null,
    ): HotStreakEntry => {
      const key = `${leagueName}::${rarity}`;
      let entry = out.get(key);
      if (!entry) {
        entry = {
          key,
          leagueName,
          mainRarityType: rarity,
          iconUrl,
          streak: null,
          liveDivisions: [],
          hasLiveLineup: false,
        };
        out.set(key, entry);
      } else if (!entry.iconUrl && iconUrl) {
        entry.iconUrl = iconUrl;
      }
      return entry;
    };

    // 1. LIVE is the primary source of truth — it carries streak + teams. Seed
    //    every in-season live comp, regardless of whether the user has a
    //    lineup in it. Some entries will be streak-only (no current teams).
    for (const live of inSeasonLive) {
      if (!isInSeasonKey(live.leagueName, live.mainRarityType)) continue;
      const entry = seedEntry(
        live.leagueName,
        live.mainRarityType,
        live.iconUrl ?? null,
      );
      if (!entry.streak && live.streak && live.streak.thresholds.length > 0) {
        entry.streak = live.streak;
      }
      const activeTeams = live.teams.filter((t) =>
        t.slots.some((s) => s.cardSlug),
      );
      if (activeTeams.length > 0) {
        entry.liveDivisions.push({
          division: live.division,
          competition: live,
          activeTeams,
        });
        entry.hasLiveLineup = true;
      }
    }

    // 2. Played-tracks: add rows for leagues the user has played in the past
    //    but isn't active in right now. Skip if already seeded from LIVE, and
    //    drop arena/leaderboard-only comps that aren't real in-season tracks.
    for (const t of playedTracksData?.tracks ?? []) {
      if (!isInSeasonKey(t.leagueName, t.mainRarityType)) continue;
      seedEntry(t.leagueName, t.mainRarityType as RarityType, null);
    }

    // 3. Upcoming metadata: purely enrichment — fill in icons for entries we
    //    already have (skip entries we don't already have to avoid flooding
    //    with every upcoming in-season leaderboard).
    for (const meta of myStreaksData?.competitions ?? []) {
      const key = `${meta.leagueName}::${meta.mainRarityType}`;
      const entry = out.get(key);
      if (!entry) continue;
      if (!entry.iconUrl) entry.iconUrl = meta.iconUrl;
    }

    // Within each entry, keep divisions ordered low→high (top division first).
    for (const entry of out.values()) {
      entry.liveDivisions.sort((a, b) => a.division - b.division);
    }

    // Sort: entries with live lineups first, then with streak data, then name.
    const result = Array.from(out.values());
    result.sort((a, b) => {
      if (a.hasLiveLineup !== b.hasLiveLineup)
        return a.hasLiveLineup ? -1 : 1;
      const aStreak = a.streak ? 1 : 0;
      const bStreak = b.streak ? 1 : 0;
      if (aStreak !== bStreak) return bStreak - aStreak;
      const aLvl = a.streak?.currentLevel ?? 0;
      const bLvl = b.streak?.currentLevel ?? 0;
      if (aLvl !== bLvl) return bLvl - aLvl;
      return a.leagueName.localeCompare(b.leagueName);
    });

    return result;
  }, [myStreaksData, liveCompetitions, playedTracksData]);

  const loading = liveLoading || myStreaksLoading || playedLoading;
  const gameWeek = myStreaksData?.gameWeek ?? liveGameWeek;

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-bold text-white">My Hot Streaks</h2>
        <span className="text-[10px] text-zinc-500">{entries.length}</span>
        {gameWeek && (
          <span className="text-[10px] text-zinc-600">GW{gameWeek}</span>
        )}
        <button
          onClick={() => onNavigate("in-season")}
          className="ml-auto text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
        >
          In Season <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
          <div className="h-14 rounded-lg bg-zinc-800/40 animate-pulse" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">
          No active hot streaks.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <CompetitionStreakRow key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Row ---

const RARITY_LABEL: Record<string, string> = {
  limited: "Limited",
  rare: "Rare",
  super_rare: "SR",
  unique: "Unique",
};
const RARITY_CLASS: Record<string, string> = {
  limited: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  rare: "bg-red-500/15 text-red-400 border-red-500/20",
  super_rare: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  unique: "bg-zinc-100/15 text-zinc-100 border-zinc-100/20",
};

interface AggregateTeam {
  division: number;
  team: InSeasonTeam;
  clearance: TeamClearance;
}

function CompetitionStreakRow({
  entry,
}: {
  entry: HotStreakEntry;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const streak = entry.streak;
  const currentThreshold =
    streak?.thresholds.find((t) => t.isCurrent) ??
    streak?.thresholds.find((t) => !t.isCleared) ??
    (streak && streak.thresholds[streak.thresholds.length - 1]) ??
    undefined;
  const currentLevelNum =
    currentThreshold?.level ?? streak?.currentLevel ?? null;
  const currentScore = currentThreshold?.score ?? 0;
  const nextThreshold =
    streak && currentThreshold
      ? streak.thresholds.find(
          (t) => t.level === currentThreshold.level + 1,
        )
      : undefined;

  const rarityLabel =
    RARITY_LABEL[entry.mainRarityType] ?? entry.mainRarityType;
  const rarityClass =
    RARITY_CLASS[entry.mainRarityType] ??
    "bg-zinc-800 text-zinc-400 border-zinc-700";

  // Collect clearance across every team in every division.
  const aggregateTeams: AggregateTeam[] = entry.liveDivisions.flatMap((ld) =>
    ld.activeTeams.map((team) => ({
      division: ld.division,
      team,
      clearance: computeTeamClearance(team, currentScore),
    })),
  );
  const bestAgg = aggregateTeams.reduce<AggregateTeam | null>((best, cur) => {
    if (!best) return cur;
    return cur.clearance.projectedTotal > best.clearance.projectedTotal
      ? cur
      : best;
  }, null);

  const bumpCandidate =
    nextThreshold && bestAgg
      ? bestAgg.clearance.projectedTotal >= nextThreshold.score
      : false;

  const canExpand = entry.hasLiveLineup;

  return (
    <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/40 overflow-hidden">
      <button
        type="button"
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        disabled={!canExpand}
        className={cn(
          "w-full text-left px-3 py-2.5 transition-colors",
          canExpand && "hover:bg-zinc-800/60 cursor-pointer",
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {entry.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.iconUrl}
              alt=""
              className="w-5 h-5 rounded shrink-0"
            />
          ) : (
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {entry.leagueName}
          </span>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
              rarityClass,
            )}
          >
            {rarityLabel}
          </span>
          {entry.liveDivisions.length > 0 && (
            <span className="text-[9px] text-zinc-500">
              {entry.liveDivisions.map((d) => `D${d.division}`).join(" · ")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {currentLevelNum != null ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-400">
                Lv.{currentLevelNum}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/50 text-[10px] font-semibold text-zinc-500">
                no lineup
              </span>
            )}
            {currentThreshold?.reward && (
              <span className="text-base font-bold text-green-400 tabular-nums">
                {currentThreshold.reward}
              </span>
            )}
            {bumpCandidate && nextThreshold && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300">
                <TrendingUp className="w-2.5 h-2.5" />
                Lv.{nextThreshold.level} {nextThreshold.reward}
              </span>
            )}
            {canExpand && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-zinc-500 transition-transform shrink-0",
                  expanded && "rotate-180",
                )}
              />
            )}
          </div>
        </div>

        {bestAgg && (
          <div className="flex items-center gap-2 mb-2 text-[11px]">
            <span className="text-zinc-400">
              Best team:{" "}
              <span className="tabular-nums text-zinc-200 font-semibold">
                {bestAgg.clearance.projectedTotal}
              </span>
              <span className="text-zinc-500"> / {currentScore}</span>
            </span>
            {bestAgg.clearance.pendingCount > 0 && (
              <span className="text-zinc-500">
                · {bestAgg.clearance.pendingCount} to play
              </span>
            )}
            <ClearancePill
              probability={bestAgg.clearance.successProbability}
            />
          </div>
        )}

        {streak ? (
          <div className="flex gap-1 flex-wrap">
            {streak.thresholds.map((t) => (
              <span
                key={t.level}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border tabular-nums",
                  t.isCleared
                    ? "bg-green-500/15 text-green-400 border-green-500/20"
                    : t.isCurrent
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30 ring-1 ring-amber-500/20"
                      : "bg-zinc-800/60 text-zinc-500 border-zinc-700/50",
                )}
              >
                {t.score}
                {t.reward && <span className="ml-1 opacity-70">{t.reward}</span>}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-zinc-500">
            No lineup set for next GW.
          </div>
        )}
      </button>

      {expanded && canExpand && (
        <div className="border-t border-zinc-700/40 bg-zinc-900/40 px-3 py-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entry.liveDivisions.flatMap((ld) =>
              ld.activeTeams.map((team, teamIdx) => {
                const clearance = computeTeamClearance(team, currentScore);
                const teamIndex = ld.competition.teams.indexOf(team);
                return (
                  <div
                    key={`${ld.division}-${team.lineupSlug ?? teamIdx}`}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                        D{ld.division}
                      </span>
                      <span className="tabular-nums text-zinc-400">
                        {clearance.actualTotal}
                        <span className="text-zinc-600"> / </span>
                        <span className="text-zinc-200 font-semibold">
                          {clearance.projectedTotal}
                        </span>
                        <span className="text-zinc-600"> / {currentScore}</span>
                      </span>
                      {clearance.pendingCount > 0 && (
                        <span className="text-zinc-500">
                          · {clearance.pendingCount} to play
                        </span>
                      )}
                      <ClearancePill probability={clearance.successProbability} />
                    </div>
                    <LineupCard
                      competition={ld.competition}
                      teamIndex={teamIndex >= 0 ? teamIndex : 0}
                      variant="compact"
                    />
                  </div>
                );
              }),
            )}
          </div>
          {!aiOpen ? (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-500/40 text-sm font-bold text-amber-300 hover:from-amber-500/30 hover:to-pink-500/30 hover:border-amber-500/60 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Get the AI take
            </button>
          ) : (
            <StreakAITake
              entry={entry}
              aggregateTeams={aggregateTeams}
              targetScore={currentScore}
              rewardLabel={currentThreshold?.reward ?? ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ClearancePill({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  const cls =
    probability >= 0.7
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : probability >= 0.4
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-red-500/15 text-red-400 border-red-500/20";
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border tabular-nums",
        cls,
      )}
    >
      {pct}%
    </span>
  );
}

// --- AI take ---

interface StreakTakeResponse {
  text?: string;
  cached?: boolean;
  error?: string;
}

function StreakAITake({
  entry,
  aggregateTeams,
  targetScore,
  rewardLabel,
}: {
  entry: HotStreakEntry;
  aggregateTeams: AggregateTeam[];
  targetScore: number;
  rewardLabel: string;
}) {
  const teamsPayload = useMemo(
    () =>
      aggregateTeams.map(({ team, clearance, division }) => ({
        name: `${team.name} (D${division})`,
        lineupSlug: team.lineupSlug,
        actualTotal: clearance.actualTotal,
        projectedTotal: clearance.projectedTotal,
        successProbability: clearance.successProbability,
        pendingPlayers: clearance.pendingSlots.map((s) => s.playerName ?? "—"),
        finishedPlayers: clearance.finishedSlots.map((s) => ({
          name: s.playerName ?? "—",
          score: s.score ?? 0,
        })),
      })),
    [aggregateTeams],
  );

  const payloadKey = useMemo(
    () =>
      teamsPayload
        .map(
          (t) =>
            `${t.lineupSlug ?? t.name}:${Math.round(t.actualTotal / 10) * 10}:${t.pendingPlayers.length}`,
        )
        .join("|"),
    [teamsPayload],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["streak-ai-take", entry.key, targetScore, payloadKey],
    queryFn: async () => {
      const res = await fetch("/api/ai/streak-take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competition: {
            leagueName: entry.leagueName,
            division: 0, // league-level; AI doesn't need a single division anymore
            rarity: RARITY_LABEL[entry.mainRarityType] ?? entry.mainRarityType,
          },
          targetScore,
          rewardLabel,
          teams: teamsPayload,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");
      return (await res.json()) as StreakTakeResponse;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: teamsPayload.length > 0,
  });

  return (
    <div className="rounded-lg bg-gradient-to-br from-amber-500/5 to-pink-500/5 border border-amber-500/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          AI Take
        </span>
        {data?.cached && (
          <span className="text-[9px] text-zinc-600">cached</span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-4/5" />
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-3/5" />
        </div>
      ) : isError ? (
        <p className="text-[11px] text-zinc-500">
          The commentator stepped out — try again in a sec.
        </p>
      ) : data?.text ? (
        <p className="text-[12px] leading-relaxed text-zinc-200 whitespace-pre-line">
          {data.text}
        </p>
      ) : null}
    </div>
  );
}
