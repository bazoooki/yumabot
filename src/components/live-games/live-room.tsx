"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Wifi, Users, Trophy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMultiGameStream } from "@/lib/hooks/use-multi-game-stream";
import { EventsFeed } from "./events-feed";
import { LineupCard } from "@/components/lineup-card/lineup-card";
import { supabase } from "@/lib/supabase";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { fetchFixture } from "@/lib/fixtures";
import { cn } from "@/lib/utils";
import type { SorareCard, InSeasonCompetition, FixtureGame, GameDetail } from "@/lib/types";

/** A game that ended more than 15 min ago is no longer "recent" */
const RECENT_CUTOFF_MS = 15 * 60 * 1000;
/** Typical max game duration (100 min + extra time) */
const MAX_GAME_DURATION_MS = 130 * 60 * 1000;

interface Props {
  cards: SorareCard[];
  userSlug: string;
}

async function fetchLiveLineups(userSlug: string) {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=LIVE&seasonality=all`,
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    fixtureSlug: string;
    gameWeek: number;
    competitions: InSeasonCompetition[];
  }>;
}

/** Is a "played" game recent enough to still show? */
function isRecentlyFinished(game: FixtureGame): boolean {
  const startMs = new Date(game.date).getTime();
  const now = Date.now();
  // Game started less than (max duration + 15 min) ago
  return now - startMs < MAX_GAME_DURATION_MS + RECENT_CUTOFF_MS;
}

export function LiveRoom({ cards, userSlug }: Props) {
  const [mobileTab, setMobileTab] = useState<"lineups" | "feed" | "live">("feed");
  const [managers, setManagers] = useState<{ slug: string }[]>([]);

  // Fetch live fixture
  const { data: fixture } = useQuery({
    queryKey: ["fixture", "live"],
    queryFn: () => fetchFixture("live"),
    refetchInterval: 30_000,
  });

  // Fetch user's live lineups
  const { data: lineupsData } = useQuery({
    queryKey: ["in-season-competitions", userSlug, "LIVE"],
    queryFn: () => fetchLiveLineups(userSlug),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Build set of owned player slugs from ALL user lineups
  const ownedPlayerSlugs = useMemo(() => {
    const slugs = new Set<string>();
    if (!lineupsData?.competitions) return slugs;
    for (const comp of lineupsData.competitions) {
      for (const team of comp.teams ?? []) {
        for (const slot of team.slots ?? []) {
          if (slot.playerSlug) slugs.add(slot.playerSlug);
        }
      }
    }
    return slugs;
  }, [lineupsData]);

  // ALL live + recently finished football games — connect to all of them
  const allLiveGameIds = useMemo(() => {
    if (!fixture?.games) return [];
    return fixture.games
      .filter((g) => {
        if (g.sport !== "FOOTBALL") return false;
        if (g.statusTyped === "playing") return true;
        if (g.statusTyped === "played") return isRecentlyFinished(g);
        return false;
      })
      .map((g) => g.id);
  }, [fixture]);

  // Stream ALL live games — the hook filters events to owned players only
  const { games, events, isLoading, connectedCount } = useMultiGameStream({
    gameIds: allLiveGameIds,
    ownedPlayerSlugs,
  });

  // Once we have game rosters, find which games actually have owned players
  const gamesWithOwnedPlayers = useMemo(() => {
    const ids = new Set<string>();
    for (const [gameId, game] of games) {
      for (const ps of game.playerGameScores) {
        if (ownedPlayerSlugs.has(ps.anyPlayer.slug)) {
          ids.add(gameId);
          break;
        }
      }
    }
    return ids;
  }, [games, ownedPlayerSlugs]);

  // Display games: fixture games that have owned players (verified via roster)
  const displayGames = useMemo(() => {
    if (!fixture?.games) return [];
    return fixture.games.filter((g) => {
      if (g.sport !== "FOOTBALL") return false;
      if (g.statusTyped !== "playing" && g.statusTyped !== "played") return false;
      if (g.statusTyped === "played" && !isRecentlyFinished(g)) return false;
      return gamesWithOwnedPlayers.has(g.id);
    });
  }, [fixture, gamesWithOwnedPlayers]);

  // Lineups: show if any player in the lineup is found in a live game roster
  const relevantLineups = useMemo(() => {
    if (!lineupsData?.competitions) return [];
    // Build set of all player slugs across all live game rosters
    const livePlayerSlugs = new Set<string>();
    for (const [gameId, game] of games) {
      if (!gamesWithOwnedPlayers.has(gameId)) continue;
      for (const ps of game.playerGameScores) {
        livePlayerSlugs.add(ps.anyPlayer.slug);
      }
    }
    const result: { competition: InSeasonCompetition; teamIndex: number }[] = [];
    for (const comp of lineupsData.competitions) {
      for (let i = 0; i < comp.teams.length; i++) {
        const team = comp.teams[i];
        if (!team.slots.some((s) => s.cardSlug)) continue;
        // Show this lineup if any of its players appear in a live game roster
        if (team.slots.some((s) => s.playerSlug && livePlayerSlugs.has(s.playerSlug))) {
          result.push({ competition: comp, teamIndex: i });
        }
      }
    }
    return result;
  }, [lineupsData, games, gamesWithOwnedPlayers]);

  // Monitored players: owned players found in live game rosters
  const monitoredPlayers = useMemo(() => {
    const players: {
      slug: string; name: string; clubCode: string; pictureUrl: string;
      gameLabel: string; score: number; fieldStatus: string;
      minsPlayed: number; gameStatus: string;
    }[] = [];
    const seen = new Set<string>();
    for (const [, game] of games) {
      const gameLabel = `${game.homeTeam.code} vs ${game.awayTeam.code}`;
      for (const ps of game.playerGameScores) {
        const slug = ps.anyPlayer.slug;
        if (!ownedPlayerSlugs.has(slug) || seen.has(slug)) continue;
        seen.add(slug);
        const card = cards.find((c) => c.anyPlayer?.slug === slug);
        players.push({
          slug,
          name: ps.anyPlayer.displayName,
          clubCode: ps.anyPlayer.activeClub?.code ?? "",
          pictureUrl: card?.pictureUrl ?? ps.anyPlayer.squaredPictureUrl ?? "",
          gameLabel,
          score: Math.round(ps.score),
          fieldStatus: ps.anyPlayerGameStats?.fieldStatus ?? "",
          minsPlayed: ps.anyPlayerGameStats?.minsPlayed ?? 0,
          gameStatus: game.statusTyped,
        });
      }
    }
    // Sort: ON_FIELD first, then ON_BENCH with mins (subbed off), then ON_BENCH (not yet on), then rest
    players.sort((a, b) => {
      const order = (p: typeof a) =>
        p.fieldStatus === "ON_FIELD" ? 0 :
        p.fieldStatus === "ON_BENCH" && p.minsPlayed > 0 ? 1 :
        p.fieldStatus === "ON_BENCH" ? 2 : 3;
      return order(a) - order(b) || b.score - a.score;
    });
    return players;
  }, [games, ownedPlayerSlugs, cards]);

  // Presence
  useEffect(() => {
    const channel = supabase.channel("live-room-presence");

    function syncManagers() {
      const state = channel.presenceState<{ slug: string }>();
      const seen = new Set<string>();
      const users: { slug: string }[] = [];
      for (const entries of Object.values(state)) {
        for (const p of entries) {
          if (!seen.has(p.slug)) {
            seen.add(p.slug);
            users.push({ slug: p.slug });
          }
        }
      }
      setManagers(users);
    }

    channel
      .on("presence", { event: "sync" }, syncManagers)
      .on("presence", { event: "join" }, syncManagers)
      .on("presence", { event: "leave" }, syncManagers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ slug: userSlug });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [userSlug]);

  const anyLive = displayGames.some((g) => g.statusTyped === "playing");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 md:px-6 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className={cn("w-4 h-4", anyLive ? "text-red-400" : "text-zinc-500")} />
              <h2 className="text-sm font-bold text-white">Live Room</h2>
            </div>
            {anyLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-red-400">LIVE</span>
              </span>
            )}
            {lineupsData?.gameWeek && (
              <span className="text-[10px] text-zinc-500">GW{lineupsData.gameWeek}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {connectedCount}/{allLiveGameIds.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {managers.length || 1}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-zinc-800 shrink-0">
        {(["lineups", "feed", "live"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-semibold capitalize transition-colors",
              mobileTab === tab
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab === "lineups" ? "My Lineups" : tab === "feed" ? "Feed" : "Scores"}
          </button>
        ))}
      </div>

      {/* Desktop: 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — My Lineups (max 340px) */}
        <div className={cn(
          "md:max-w-[340px] md:w-[35%] md:border-r border-zinc-800 flex flex-col overflow-hidden shrink-0",
          mobileTab !== "lineups" && "hidden md:flex",
        )}>
          <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                My Lineups
              </span>
              {relevantLineups.length > 0 && (
                <span className="text-[10px] text-zinc-600">
                  {relevantLineups.length}
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {relevantLineups.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-xs text-zinc-600">
                  {anyLive ? "No lineups in live games" : "No live games right now"}
                </p>
              </div>
            ) : (
              relevantLineups.map(({ competition, teamIndex }) => (
                <LineupCard
                  key={`${competition.slug}-${teamIndex}`}
                  competition={competition}
                  teamIndex={teamIndex}
                  variant="compact"
                />
              ))
            )}
          </div>
        </div>

        {/* Center panel — Live Feed (my players only) */}
        <div className={cn(
          "flex-1 md:border-r border-zinc-800 flex flex-col overflow-hidden",
          mobileTab !== "feed" && "hidden md:flex",
        )}>
          <div className="px-3 py-2 border-b border-zinc-800 shrink-0 flex items-center gap-2">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Live Feed
            </span>
            <span className="text-[9px] text-zinc-600">
              {displayGames.length} game{displayGames.length !== 1 ? "s" : ""} tracked
            </span>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <EventsFeed events={events} variant={8} games={games} multiGame />
          </div>

          {/* Monitored Players */}
          {monitoredPlayers.length > 0 && (
            <div className="border-t border-zinc-800 shrink-0 px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Tracking
                </span>
                <span className="text-[9px] text-zinc-600">{monitoredPlayers.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {monitoredPlayers.map((p) => {
                  const isOnField = p.fieldStatus === "ON_FIELD";
                  const isSubbedOff = p.fieldStatus === "ON_BENCH" && p.minsPlayed > 0;
                  const isOnBench = p.fieldStatus === "ON_BENCH" && p.minsPlayed === 0;
                  const isFinished = p.gameStatus === "played";

                  return (
                    <div
                      key={p.slug}
                      title={`${p.name} — ${p.gameLabel}${isSubbedOff ? ` (off ${p.minsPlayed}')` : ""}`}
                      className={cn(
                        "flex items-center gap-1.5 px-1.5 py-1 rounded-md border",
                        isOnField ? "bg-green-500/5 border-green-500/20" :
                        isSubbedOff ? "bg-zinc-800/50 border-amber-500/20 opacity-70" :
                        isOnBench ? "bg-zinc-800/50 border-zinc-700/30 opacity-50" :
                        "bg-zinc-800/50 border-zinc-700/30",
                      )}
                    >
                      <div className="relative">
                        <img
                          src={p.pictureUrl}
                          alt={p.name}
                          className="w-5 h-5 rounded-full object-cover object-[center_18%] bg-zinc-700"
                        />
                        {/* Status badge */}
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-900 flex items-center justify-center",
                          isOnField ? "bg-green-500" :
                          isSubbedOff ? "bg-amber-500" :
                          isOnBench ? "bg-zinc-600" :
                          isFinished ? "bg-zinc-500" : "bg-zinc-700",
                        )}>
                          {isOnField && <span className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                          {isSubbedOff && <span className="text-[5px] text-white font-bold">↓</span>}
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium",
                        isOnField ? "text-zinc-200" : "text-zinc-400",
                      )}>
                        {p.name.split(" ").pop()}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold tabular-nums",
                        isOnField ? "text-primary" :
                        p.score > 0 ? "text-zinc-400" : "text-zinc-600",
                      )}>
                        {p.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — Managers + Scoreboard */}
        <div className={cn(
          "md:w-[280px] flex flex-col overflow-hidden shrink-0",
          mobileTab !== "live" && "hidden md:flex",
        )}>
          {/* Online Managers */}
          <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Online
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(managers.length > 0 ? managers : [{ slug: userSlug }]).map((m) => {
                const clanMember = CLAN_MEMBERS.find((cm) => cm.slug === m.slug);
                const name = clanMember?.name ?? m.slug.replace(/-/g, " ");
                const isYou = m.slug === userSlug;
                return (
                  <div
                    key={m.slug}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg border",
                      isYou
                        ? "bg-violet-500/10 border-violet-500/20"
                        : "bg-zinc-800/50 border-zinc-700/30",
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white",
                        isYou
                          ? "bg-gradient-to-br from-violet-500 to-violet-700"
                          : "bg-gradient-to-br from-cyan-500 to-cyan-700",
                      )}
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-zinc-300 font-medium">{name}</span>
                    {isYou && <span className="text-[9px] text-zinc-600">(you)</span>}
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Scoreboard — only relevant games (live + recent, sorted live first) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Scores
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {displayGames.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-xs text-zinc-600">No live games</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {/* Live games first, then recent FT */}
                  {displayGames
                    .slice()
                    .sort((a, b) => {
                      const aLive = a.statusTyped === "playing" ? 0 : 1;
                      const bLive = b.statusTyped === "playing" ? 0 : 1;
                      return aLive - bLive;
                    })
                    .map((game) => (
                      <MiniScoreCard
                        key={game.id}
                        game={game}
                        gameDetail={games.get(game.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Score Card ───

function MiniScoreCard({
  game,
  gameDetail,
}: {
  game: FixtureGame;
  gameDetail?: GameDetail;
}) {
  const isLive = game.statusTyped === "playing";
  const homeScore = gameDetail?.homeScore ?? game.homeScore;
  const awayScore = gameDetail?.awayScore ?? game.awayScore;

  return (
    <Link
      href={`/games/${game.id}`}
      className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/30 transition-colors group"
    >
      <div className="w-4 shrink-0 flex justify-center">
        {isLive ? (
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        ) : (
          <span className="text-[8px] text-zinc-600 font-bold">FT</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {game.homeTeam.pictureUrl && (
              <img src={game.homeTeam.pictureUrl} alt="" className="w-4 h-4 rounded-full bg-zinc-800 shrink-0" />
            )}
            <span className="text-[11px] font-medium text-zinc-300 truncate">
              {game.homeTeam.code}
            </span>
          </div>
          <span className="text-[11px] font-bold text-white tabular-nums mx-2">
            {homeScore} - {awayScore}
          </span>
          <div className="flex items-center gap-1.5 min-w-0 justify-end">
            <span className="text-[11px] font-medium text-zinc-300 truncate">{game.awayTeam.code}</span>
            {game.awayTeam.pictureUrl && (
              <img src={game.awayTeam.pictureUrl} alt="" className="w-4 h-4 rounded-full bg-zinc-800 shrink-0" />
            )}
          </div>
        </div>
        <p className="text-[9px] text-zinc-600 text-center mt-0.5 truncate">
          {game.competition.name}
        </p>
      </div>

      <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
    </Link>
  );
}
