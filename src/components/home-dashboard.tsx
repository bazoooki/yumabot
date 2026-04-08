"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLineupStore, STREAK_LEVELS } from "@/lib/lineup-store";
import { getStrategyMode } from "@/lib/ai-lineup";
import { useLiveScores } from "@/lib/hooks";
import { useMarketStore } from "@/lib/market/market-store";
import { fetchFixture, countMyPlayers, formatGameTime } from "@/lib/fixtures";
import { getKickoffUrgency } from "@/lib/utils";
import type { SorareCard, FixtureGame, InSeasonCompetition } from "@/lib/types";
import { LineupCard } from "@/components/lineup-card/lineup-card";
import {
  Target, Clock, ChevronRight, TrendingUp, Tv, Trophy,
  BarChart3, AlertTriangle, Zap,
} from "lucide-react";
import { LineupCardSkeleton } from "@/components/ui/skeleton";

type Tab = "home" | "lineup" | "market" | "live-games" | "in-season";

interface HomeDashboardProps {
  cards: SorareCard[];
  onNavigate: (tab: string) => void;
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

export function HomeDashboard({ cards, onNavigate, userSlug }: HomeDashboardProps) {
  const { currentLevel, slots, targetScore } = useLineupStore();
  const streakLevel = STREAK_LEVELS.find((l) => l.level === currentLevel);
  const mode = getStrategyMode(currentLevel);
  const { isAnyGameLive, allGamesFinished, actualTotal, projectedTotal, filledCount } = useLiveScores();
  const hasLineup = slots.some((s) => s.card);

  // Market store (selectors to avoid over-rendering)
  const connectionStatus = useMarketStore((s) => s.connectionStatus);
  const totalOffers = useMarketStore((s) => s.totalOffers);
  const marketPlayers = useMarketStore((s) => s.players);
  const unacknowledgedCount = useMarketStore((s) => s.unacknowledgedCount);

  // Live lineups — shared cache with Live Lineups tab
  const { data: lineupsData, isLoading: lineupsLoading } = useQuery({
    queryKey: ["in-season-competitions", userSlug, "LIVE"],
    queryFn: () => fetchLiveLineups(userSlug),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const liveLineups = useMemo(() => {
    if (!lineupsData?.competitions) return [];
    const result: { competition: InSeasonCompetition; teamIndex: number }[] = [];
    for (const comp of lineupsData.competitions) {
      for (let i = 0; i < comp.teams.length; i++) {
        if (comp.teams[i].slots.some((s) => s.cardSlug)) {
          result.push({ competition: comp, teamIndex: i });
        }
      }
    }
    return result;
  }, [lineupsData]);

  // Fixture queries — shared cache with Live Games tab
  const { data: liveFixture } = useQuery({
    queryKey: ["fixture", "live"],
    queryFn: () => fetchFixture("live"),
    refetchInterval: 30_000,
  });
  const { data: upcomingFixture } = useQuery({
    queryKey: ["fixture", "upcoming"],
    queryFn: () => fetchFixture("upcoming"),
    staleTime: 5 * 60 * 1000,
  });

  // All games combined
  const { liveGames, scheduledGames, myLiveGames, myUpcomingGames } = useMemo(() => {
    const allGames = new Map<string, FixtureGame>();
    for (const g of liveFixture?.games ?? []) {
      if (g.sport === "FOOTBALL") allGames.set(g.id, g);
    }
    for (const g of upcomingFixture?.games ?? []) {
      if (g.sport === "FOOTBALL" && !allGames.has(g.id)) allGames.set(g.id, g);
    }
    const games = Array.from(allGames.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const live = games.filter((g) => g.statusTyped === "playing");
    const scheduled = games.filter((g) => g.statusTyped === "scheduled");
    return {
      liveGames: live,
      scheduledGames: scheduled,
      myLiveGames: live.filter((g) => countMyPlayers(g, cards) > 0),
      myUpcomingGames: scheduled.filter((g) => countMyPlayers(g, cards) > 0).slice(0, 5),
    };
  }, [liveFixture, upcomingFixture, cards]);

  // My live players — cards whose club is in a live game
  const myLivePlayers = useMemo(() => {
    const liveTeamCodes = new Set<string>();
    for (const g of liveGames) {
      liveTeamCodes.add(g.homeTeam.code);
      liveTeamCodes.add(g.awayTeam.code);
    }
    if (liveTeamCodes.size === 0) return [];

    const seen = new Set<string>();
    return cards.filter((c) => {
      const code = c.anyPlayer?.activeClub?.code;
      const slug = c.anyPlayer?.slug;
      if (!code || !slug || seen.has(slug)) return false;
      if (!liveTeamCodes.has(code)) return false;
      seen.add(slug);
      return true;
    });
  }, [cards, liveGames]);

  // Find the game for a live player
  const gameForPlayer = (card: SorareCard): FixtureGame | undefined => {
    const code = card.anyPlayer?.activeClub?.code;
    if (!code) return undefined;
    return liveGames.find((g) => g.homeTeam.code === code || g.awayTeam.code === code);
  };

  // Top traded players from market
  const topTraded = useMemo(() => {
    const entries = Object.values(marketPlayers);
    return entries
      .sort((a, b) => b.saleCount - a.saleCount)
      .slice(0, 3);
  }, [marketPlayers]);

  // Cumulative earnings
  const cumulativeEarned = STREAK_LEVELS
    .filter((l) => l.level < currentLevel)
    .reduce((s, l) => s + parseFloat(l.reward.replace(/[$,]/g, "")), 0);

  const liveTotal = isAnyGameLive ? projectedTotal : actualTotal;
  const progressPct = targetScore > 0 ? Math.min(100, (liveTotal / targetScore) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-5 space-y-5">

        {/* ── Section 0: My Live Lineups ── */}
        {(liveLineups.length > 0 || lineupsLoading) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                My Live Lineups
              </h3>
              {lineupsData?.gameWeek && (
                <span className="text-[10px] text-zinc-600">GW{lineupsData.gameWeek}</span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {lineupsLoading && liveLineups.length === 0 && (
                <>
                  <LineupCardSkeleton />
                  <LineupCardSkeleton />
                </>
              )}
              {liveLineups.map(({ competition, teamIndex }) => (
                <LineupCard
                  key={`${competition.slug}-${teamIndex}`}
                  competition={competition}
                  teamIndex={teamIndex}
                  variant="compact"
                  className="min-w-[280px] shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Section 1: Compact Status Bar ── */}
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-xs font-bold text-purple-400">
              Lv.{currentLevel}
            </span>
            <span className="text-sm text-zinc-300">
              {streakLevel?.threshold} pts &rarr; {streakLevel?.reward}
            </span>
          </div>
          <div className={cn(
            "px-2 py-1 rounded-md text-[10px] font-bold",
            mode === "floor" ? "bg-green-500/15 text-green-400" :
            mode === "balanced" ? "bg-blue-500/15 text-blue-400" :
            "bg-amber-500/15 text-amber-400"
          )}>
            {mode === "floor" ? "FAST" : mode === "balanced" ? "BALANCED" : "SAFE"}
          </div>
          {cumulativeEarned > 0 && (
            <span className="text-xs text-green-400">Earned: ${cumulativeEarned}</span>
          )}
          {hasLineup && (isAnyGameLive || allGamesFinished) && (
            <div className="flex-1 flex items-center gap-3 ml-auto">
              {isAnyGameLive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progressPct >= 100 ? "bg-green-500" : "bg-purple-500"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-zinc-400 tabular-nums shrink-0">
                {Math.round(liveTotal)}/{targetScore}
              </span>
            </div>
          )}
        </div>

        {/* ── Section 2: Quick Links ── */}
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate("lineup")}
            className="group p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-purple-500/30 transition-all text-left"
          >
            <Target className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-sm font-semibold text-white">Lineup</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {hasLineup ? `${filledCount}/5 set` : "Build lineup"}
            </p>
          </button>
          <button
            onClick={() => onNavigate("live-games")}
            className="group p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/30 transition-all text-left"
          >
            <Tv className="w-5 h-5 text-cyan-400 mb-2" />
            <p className="text-sm font-semibold text-white">Live Games</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              {liveGames.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
              {liveGames.length > 0 ? `${liveGames.length} live` : "View games"}
            </p>
          </button>
          <button
            onClick={() => onNavigate("market")}
            className="group p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-green-500/30 transition-all text-left"
          >
            <TrendingUp className="w-5 h-5 text-green-400 mb-2" />
            <p className="text-sm font-semibold text-white">Market</p>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              {connectionStatus === "connected" && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
              {totalOffers > 0 ? `${totalOffers} sales` : "Live feed"}
            </p>
          </button>
          <button
            onClick={() => onNavigate("in-season")}
            className="group p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/30 transition-all text-left"
          >
            <Trophy className="w-5 h-5 text-amber-400 mb-2" />
            <p className="text-sm font-semibold text-white">In Season</p>
            <span className="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 leading-none">
              beta
            </span>
          </button>
        </div>

        {/* ── Section 3: Current Lineup + My Live Players ── */}
        <div className="grid grid-cols-2 gap-5">
          {/* Current Lineup */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">Current Lineup</h2>
              {hasLineup && (
                <button
                  onClick={() => onNavigate("lineup")}
                  className="ml-auto text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
                >
                  Edit <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {!hasLineup ? (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-500 mb-3">No lineup set</p>
                <button
                  onClick={() => onNavigate("lineup")}
                  className="px-4 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-xs font-semibold text-white transition-colors"
                >
                  Build Lineup
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {slots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/40">
                      <span className="text-[10px] font-bold text-zinc-500 w-6">{slot.position}</span>
                      {slot.card ? (
                        <>
                          <span className="text-xs text-zinc-300 truncate flex-1">
                            {slot.card.anyPlayer?.displayName ?? "—"}
                          </span>
                          {slot.isCaptain && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1 rounded">C</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-zinc-600 italic flex-1">Empty</span>
                      )}
                    </div>
                  ))}
                </div>
                {(isAnyGameLive || allGamesFinished) && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-zinc-400">
                        {allGamesFinished
                          ? actualTotal >= targetScore ? "Cleared!" : "Missed"
                          : "Live"
                        }
                      </span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        liveTotal >= targetScore ? "text-green-400" : "text-zinc-300"
                      )}>
                        {Math.round(liveTotal)} / {targetScore}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          progressPct >= 100 ? "bg-green-500" : "bg-purple-500"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* My Live Players */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              {myLivePlayers.length > 0 && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
              <Zap className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-bold text-white">My Live Players</h2>
              <span className="text-[10px] text-zinc-500">{myLivePlayers.length}</span>
            </div>
            {myLivePlayers.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No players in live games right now</p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {myLivePlayers.map((card) => {
                  const player = card.anyPlayer!;
                  const game = gameForPlayer(card);
                  return (
                    <div key={card.slug} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/40">
                      <span className="text-[10px] font-bold text-zinc-500 w-6 shrink-0">
                        {player.cardPositions?.[0]?.slice(0, 3).toUpperCase() ?? "—"}
                      </span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{player.displayName}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{player.activeClub?.code}</span>
                      {game && (
                        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                          {game.homeTeam.code} {game.homeScore}-{game.awayScore} {game.awayTeam.code}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 4: My Games ── */}
        {(myLiveGames.length > 0 || myUpcomingGames.length > 0) && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Tv className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">My Games</h2>
              <span className="text-[10px] text-zinc-500">{myLiveGames.length + myUpcomingGames.length}</span>
              <button
                onClick={() => onNavigate("live-games")}
                className="ml-auto text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
              >
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {myLiveGames.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400">Live Now</span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mb-4">
                  {myLiveGames.slice(0, 6).map((game) => (
                    <MiniGameCard key={game.id} game={game} cards={cards} onClick={() => onNavigate("live-games")} />
                  ))}
                </div>
              </>
            )}

            {myUpcomingGames.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Upcoming</span>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                  {myUpcomingGames.slice(0, 6).map((game) => (
                    <MiniGameCard key={game.id} game={game} cards={cards} onClick={() => onNavigate("live-games")} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Section 5: Market Pulse + Upcoming Games ── */}
        <div className="grid grid-cols-2 gap-5">
          {/* Market Pulse */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className={cn(
                "w-2 h-2 rounded-full",
                connectionStatus === "connected" ? "bg-green-400" :
                connectionStatus === "connecting" ? "bg-amber-400 animate-pulse" :
                "bg-zinc-600"
              )} />
              <BarChart3 className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-bold text-white">Market Pulse</h2>
              {unacknowledgedCount > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {unacknowledgedCount}
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              {totalOffers} sales &middot; {Object.keys(marketPlayers).length} players tracked
            </p>

            {topTraded.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {topTraded.map((p) => (
                  <div key={p.playerSlug} className="flex items-center gap-2 text-[11px]">
                    <span className="text-zinc-300 truncate flex-1">{p.playerName}</span>
                    <span className="text-zinc-500 tabular-nums">{p.saleCount} sales</span>
                    <span className="text-zinc-400 tabular-nums">{p.latestPriceEth.toFixed(3)} ETH</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onNavigate("market")}
              className="flex items-center gap-1 text-[11px] font-semibold text-green-400 hover:text-green-300 transition-colors"
            >
              View Market <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Upcoming Games */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Upcoming</h2>
              <button
                onClick={() => onNavigate("live-games")}
                className="ml-auto text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
              >
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {myUpcomingGames.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6">No upcoming games with your players</p>
            ) : (
              <div className="space-y-2">
                {myUpcomingGames.map((game) => {
                  const urgency = getKickoffUrgency(game.date);
                  const playerCount = countMyPlayers(game, cards);
                  return (
                    <button
                      key={game.id}
                      onClick={() => onNavigate("live-games")}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30 hover:border-zinc-600 transition-colors text-left"
                    >
                      {urgency === "imminent" && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
                      {urgency === "soon" && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />}
                      {urgency === "later" && <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-300 truncate">
                          {game.homeTeam.code} vs {game.awayTeam.code}
                        </p>
                        <p className="text-[10px] text-zinc-500">{formatGameTime(game.date)}</p>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {playerCount} player{playerCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function MiniGameCard({
  game,
  cards,
  onClick,
}: {
  game: FixtureGame;
  cards: SorareCard[];
  onClick: () => void;
}) {
  const isLive = game.statusTyped === "playing";
  const isPlayed = game.statusTyped === "played";
  const playerCount = countMyPlayers(game, cards);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01]",
        isLive
          ? "bg-green-900/10 border-green-500/20 hover:border-green-500/40"
          : isPlayed
            ? "bg-zinc-800/30 border-zinc-700/30 hover:border-zinc-600"
            : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-zinc-500 truncate">{game.competition.name}</span>
        {isLive ? (
          <span className="flex items-center gap-1 text-[9px] font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        ) : isPlayed ? (
          <span className="text-[9px] text-zinc-600">FT</span>
        ) : (
          <span className="text-[9px] text-zinc-500">{formatGameTime(game.date)}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {game.homeTeam.pictureUrl ? (
            <img src={game.homeTeam.pictureUrl} alt={game.homeTeam.code} className="w-4 h-4 rounded-full bg-zinc-700 shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-zinc-700 shrink-0" />
          )}
          <span className="text-xs font-semibold text-zinc-200 truncate">{game.homeTeam.code}</span>
        </div>
        {isLive || isPlayed ? (
          <span className="text-xs font-bold text-white shrink-0 tabular-nums">{game.homeScore}-{game.awayScore}</span>
        ) : (
          <span className="text-[10px] text-zinc-600 font-bold shrink-0">vs</span>
        )}
        <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
          <span className="text-xs font-semibold text-zinc-200 truncate">{game.awayTeam.code}</span>
          {game.awayTeam.pictureUrl ? (
            <img src={game.awayTeam.pictureUrl} alt={game.awayTeam.code} className="w-4 h-4 rounded-full bg-zinc-700 shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-zinc-700 shrink-0" />
          )}
        </div>
      </div>

      {playerCount > 0 && (
        <p className="text-[9px] text-zinc-600 mt-1.5">{playerCount} of your players</p>
      )}
    </button>
  );
}
