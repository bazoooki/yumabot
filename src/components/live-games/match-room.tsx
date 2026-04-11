"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Wifi, WifiOff, BarChart3, Clock, MessageCircle } from "lucide-react";
import { useGameStream } from "@/lib/hooks/use-game-stream";
import { Skeleton, StatRowSkeleton } from "@/components/ui/skeleton";
import { extractGoalScorers, getStatLabel } from "@/lib/game-events";
import { EventsFeed } from "./events-feed";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { SorareCard, GameDetail, GamePlayerScore } from "@/lib/types";
import type { RoomMessage } from "@/lib/rooms/types";

const NON_COMMON_RARITIES = new Set(["limited", "rare", "super_rare", "unique", "custom_series"]);
const RARITY_RANK: Record<string, number> = { unique: 5, super_rare: 4, rare: 3, limited: 2, custom_series: 1 };

interface Props {
  gameId: string;
  cards: SorareCard[];
  userSlug: string;
}

export function MatchRoom({ gameId, cards, userSlug }: Props) {
  const { game, isLoading, isLive, connected, updateCount, events: liveEvents } =
    useGameStream(gameId);
  const [activeTab, setActiveTab] = useState<"lineups" | "stats" | "players" | "events" | "chat">(
    "lineups",
  );
  const [lineupPlayerSlugs, setLineupPlayerSlugs] = useState<Set<string> | null>(null);
  const feedVariant = 8;
  const events = liveEvents;
  const [watchers, setWatchers] = useState<{ slug: string }[]>([]);

  // Presence tracking — who's watching this game
  useEffect(() => {
    const channel = supabase.channel(`game-presence-${gameId}`);

    function syncWatchers() {
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
      setWatchers(users);
    }

    channel
      .on("presence", { event: "sync" }, syncWatchers)
      .on("presence", { event: "join" }, syncWatchers)
      .on("presence", { event: "leave" }, syncWatchers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const resp = await channel.track({ slug: userSlug });
          if (resp !== "ok") {
            console.error("Presence track failed:", resp);
          }
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [gameId, userSlug]);

  // Fetch user's active lineup to know which cards are actually in play
  useEffect(() => {
    if (!userSlug) return;
    fetch(`/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=LIVE&seasonality=all`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.competitions) return;
        const slugs = new Set<string>();
        for (const comp of data.competitions) {
          for (const team of comp.teams ?? []) {
            for (const slot of team.slots ?? []) {
              if (slot.playerSlug) slugs.add(slot.playerSlug);
            }
          }
        }
        setLineupPlayerSlugs(slugs);
      })
      .catch(() => {});
  }, [userSlug]);

  const myPlayerSlugs = useMemo(() => {
    if (!game) return new Set<string>();
    // If lineup data loaded, only highlight players in active lineups
    if (lineupPlayerSlugs) {
      return new Set(
        game.playerGameScores
          .filter((ps) => lineupPlayerSlugs.has(ps.anyPlayer.slug))
          .map((ps) => ps.anyPlayer.slug),
      );
    }
    // Fallback: highlight by owned cards' clubs
    const myCodes = new Set(
      cards
        .map((c) => c.anyPlayer?.activeClub?.code)
        .filter(Boolean) as string[],
    );
    return new Set(
      game.playerGameScores
        .filter((ps) => myCodes.has(ps.anyPlayer.activeClub?.code ?? ""))
        .map((ps) => ps.anyPlayer.slug),
    );
  }, [game, cards, lineupPlayerSlugs]);

  const myCards = useMemo(() => {
    if (!game) return [];
    const gameSlugs = new Set(game.playerGameScores.map((ps) => ps.anyPlayer.slug));
    const matching = cards.filter((c) => {
      const playerSlug = c.anyPlayer?.slug;
      if (!playerSlug || !gameSlugs.has(playerSlug)) return false;
      if (!NON_COMMON_RARITIES.has(c.rarityTyped)) return false;
      // If lineup data loaded, only show cards for players in active lineups
      if (lineupPlayerSlugs && !lineupPlayerSlugs.has(playerSlug)) return false;
      return true;
    });
    // Deduplicate: keep only the best rarity card per player
    const bestByPlayer = new Map<string, SorareCard>();
    for (const card of matching) {
      const playerSlug = card.anyPlayer!.slug;
      const existing = bestByPlayer.get(playerSlug);
      if (!existing || (RARITY_RANK[card.rarityTyped] ?? 0) > (RARITY_RANK[existing.rarityTyped] ?? 0)) {
        bestByPlayer.set(playerSlug, card);
      }
    }
    return Array.from(bestByPlayer.values());
  }, [game, cards, lineupPlayerSlugs]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 md:gap-4">
          <Skeleton className="w-8 h-8 md:w-10 md:h-10 rounded-full" />
          <Skeleton className="h-5 w-20 md:w-24" />
          <Skeleton className="h-6 w-14 md:w-16" />
          <Skeleton className="h-5 w-20 md:w-24" />
          <Skeleton className="w-8 h-8 md:w-10 md:h-10 rounded-full" />
        </div>
        {/* Lineup skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <StatRowSkeleton key={i} />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <StatRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Game not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="flex-1 md:w-[60%] md:border-r border-zinc-800 flex flex-col overflow-hidden">
        <MatchHeader
          game={game}
          isLive={isLive}
          connected={connected}
          updateCount={updateCount}
        />

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0 overflow-x-auto">
          {(["lineups", "stats", "players"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-2 md:px-5 md:py-2.5 text-xs font-semibold capitalize transition-colors shrink-0",
                activeTab === tab
                  ? "text-white border-b-2 border-white"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tab}
            </button>
          ))}
          {/* Mobile-only: Events + Chat tabs (right panel content on desktop) */}
          {(["events", "chat"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "md:hidden px-3 py-2 text-xs font-semibold capitalize transition-colors shrink-0",
                activeTab === tab
                  ? "text-white border-b-2 border-white"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "lineups" ? (
            <>
              <PitchFormation
                game={game}
                myPlayerSlugs={myPlayerSlugs}
              />
              {/* My players — below the pitch */}
              {myCards.length > 0 && (
                <div className="px-4 py-3 border-t border-zinc-800">
                  <h3 className="text-[10px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">
                    Your Players
                  </h3>
                  <MyPlayersStrip cards={myCards} scores={game.playerGameScores} />
                </div>
              )}
            </>
          ) : activeTab === "players" ? (
            <PlayersList game={game} myPlayerSlugs={myPlayerSlugs} />
          ) : activeTab === "events" ? (
            <EventsFeed events={events} variant={feedVariant} game={game} />
          ) : activeTab === "chat" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <MatchChat gameId={gameId} userSlug={userSlug} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center space-y-2">
                <BarChart3 className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-sm text-zinc-500">Match Stats</p>
                <p className="text-xs text-zinc-600">Coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — watching + feed (60%) + chat (40%) */}
      <div className="hidden md:flex md:w-[40%] flex-col overflow-hidden">
        {/* Watching indicator */}
        <div className="px-3 py-2.5 border-b border-zinc-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Watching</span>
            <div className="flex -space-x-1.5">
              {(watchers.length > 0 ? watchers : [{ slug: userSlug }]).map((w) => (
                <div
                  key={w.slug}
                  title={w.slug.replace(/-/g, " ")}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-zinc-900",
                    w.slug === userSlug
                      ? "bg-gradient-to-br from-purple-500 to-purple-700"
                      : "bg-gradient-to-br from-cyan-500 to-cyan-700",
                  )}
                >
                  {w.slug.slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {watchers.length > 1
                ? `${watchers.length} viewers`
                : userSlug.replace(/-/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-500/70 font-medium">Live</span>
          </div>
        </div>

        {/* Events feed — 60% */}
        <div className="flex-[6] flex flex-col overflow-hidden min-h-0">
          <div className="px-3 py-1.5 border-b border-zinc-800 shrink-0">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Live Feed
            </h3>
          </div>
          <EventsFeed events={events} variant={feedVariant} game={game} />
        </div>

        {/* Chat — 40% */}
        <div className="flex-[4] flex flex-col overflow-hidden min-h-0 border-t border-zinc-800">
          <div className="px-3 py-1.5 border-b border-zinc-800 shrink-0 flex items-center gap-2">
            <MessageCircle className="w-3 h-3 text-zinc-500" />
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Chat</h3>
          </div>
          <MatchChat gameId={gameId} userSlug={userSlug} />
        </div>
      </div>
    </div>
  );
}

// ─── Match Header ───

function MatchHeader({
  game,
  isLive,
  connected,
  updateCount,
}: {
  game: GameDetail;
  isLive: boolean;
  connected: boolean;
  updateCount: number;
}) {
  const isPlayed = game.statusTyped === "played";
  const isScheduled = game.statusTyped === "scheduled";

  return (
    <div className="bg-zinc-950 px-4 py-3 md:px-6 md:py-5 shrink-0 relative border-b border-zinc-800">
      <div className="flex items-center justify-center gap-4 md:gap-8">
        {/* Home */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo url={game.homeTeam.pictureUrl} code={game.homeTeam.code} size="lg" />
          <span className="text-sm font-bold text-zinc-200 text-center">
            {game.homeTeam.name}
          </span>
        </div>

        {/* Score center */}
        <div className="text-center shrink-0 min-w-[100px]">
          {isScheduled ? (
            <p className="text-3xl font-black text-zinc-500">vs</p>
          ) : (
            <p
              key={`${game.homeScore}-${game.awayScore}`}
              className={cn(
                "text-3xl md:text-4xl font-black text-white tabular-nums tracking-wider",
                isLive && "score-flash"
              )}
            >
              {game.homeScore} - {game.awayScore}
            </p>
          )}
          {isLive && <MatchMinuteBadge gameDate={game.date} />}
          {isPlayed && (
            <span className="text-[11px] font-bold text-zinc-500 block mt-1">
              FT
            </span>
          )}
          {isScheduled && (
            <span className="text-[11px] text-zinc-500 block mt-1">
              {new Date(game.date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo url={game.awayTeam.pictureUrl} code={game.awayTeam.code} size="lg" />
          <span className="text-sm font-bold text-zinc-200 text-center">
            {game.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Goal scorers */}
      <GoalScorersLine game={game} />

      <p className="text-[10px] text-zinc-600 text-center mt-2">
        {game.competition.name}
      </p>

      {/* Connection indicator */}
      <div className="absolute top-2 right-3 flex items-center gap-1.5">
        {connected ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : (
          <WifiOff className="w-3 h-3 text-zinc-600" />
        )}
        {updateCount > 0 && (
          <span className="text-[9px] text-zinc-600 tabular-nums">
            {updateCount}
          </span>
        )}
      </div>
    </div>
  );
}

function MatchMinuteBadge({ gameDate }: { gameDate: string }) {
  const [minute, setMinute] = useState(() =>
    Math.max(0, Math.round((Date.now() - new Date(gameDate).getTime()) / 60000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMinute(
        Math.max(
          0,
          Math.round((Date.now() - new Date(gameDate).getTime()) / 60000),
        ),
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [gameDate]);

  return (
    <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      <span className="text-[11px] font-bold text-red-400 tabular-nums">
        {minute}&apos;
      </span>
    </span>
  );
}

function TeamLogo({
  url,
  code,
  size = "md",
}: {
  url: string;
  code: string;
  size?: "md" | "lg";
}) {
  const s = size === "lg" ? "w-12 h-12" : "w-8 h-8";
  return url ? (
    <img src={url} alt={code} className={cn(s, "rounded-full bg-zinc-800")} />
  ) : (
    <div className={cn(s, "rounded-full bg-zinc-800")} />
  );
}

// ─── Pitch Formation ───

function PitchFormation({
  game,
  myPlayerSlugs,
}: {
  game: GameDetail;
  myPlayerSlugs: Set<string>;
}) {
  const homePlayers = game.playerGameScores.filter(
    (ps) => ps.anyPlayer.activeClub?.code === game.homeTeam.code,
  );
  const awayPlayers = game.playerGameScores.filter(
    (ps) => ps.anyPlayer.activeClub?.code === game.awayTeam.code,
  );

  if (homePlayers.length === 0 && awayPlayers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Lineups not available yet</p>
      </div>
    );
  }

  return (
    <div className="relative bg-zinc-950">
      {/* Pitch background markings */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-800/60" />
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-zinc-800/60" />
        {/* Outer border */}
        <div className="absolute inset-2 border border-zinc-800/40 rounded-lg" />
        {/* Home penalty area */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-16 h-32 border-r border-t border-b border-zinc-800/40 rounded-r-sm" />
        {/* Away penalty area */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-16 h-32 border-l border-t border-b border-zinc-800/40 rounded-l-sm" />
      </div>

      {/* Formation grid */}
      <div className="relative grid grid-cols-2 min-h-[500px]">
        {/* Home half */}
        <TeamHalf
          players={homePlayers}
          teamLogo={game.homeTeam.pictureUrl}
          teamCode={game.homeTeam.code}
          side="home"
          myPlayerSlugs={myPlayerSlugs}
        />
        {/* Away half */}
        <TeamHalf
          players={awayPlayers}
          teamLogo={game.awayTeam.pictureUrl}
          teamCode={game.awayTeam.code}
          side="away"
          myPlayerSlugs={myPlayerSlugs}
        />
      </div>
    </div>
  );
}

function TeamHalf({
  players,
  teamLogo,
  teamCode,
  side,
  myPlayerSlugs,
}: {
  players: GamePlayerScore[];
  teamLogo: string;
  teamCode: string;
  side: "home" | "away";
  myPlayerSlugs: Set<string>;
}) {
  // Group by position, starters (minsPlayed > 0) first
  const grouped = useMemo(() => {
    const groups: Record<string, GamePlayerScore[]> = {
      Forward: [],
      Midfielder: [],
      Defender: [],
      Goalkeeper: [],
    };
    for (const ps of players) {
      const pos = ps.positionTyped || "Midfielder";
      if (groups[pos]) groups[pos].push(ps);
      else groups.Midfielder.push(ps);
    }
    // Sort: starters first (score > 0 or minsPlayed > 0), then by score desc
    for (const pos of Object.keys(groups)) {
      groups[pos].sort((a, b) => {
        const aStarted = (a.anyPlayerGameStats?.minsPlayed ?? 0) > 0 ? 1 : 0;
        const bStarted = (b.anyPlayerGameStats?.minsPlayed ?? 0) > 0 ? 1 : 0;
        if (aStarted !== bStarted) return bStarted - aStarted;
        return b.score - a.score;
      });
    }
    return groups;
  }, [players]);

  // Position rows: FWD at top (closest to center), GK at bottom (edge)
  const rows = ["Forward", "Midfielder", "Defender", "Goalkeeper"];

  return (
    <div className="relative flex flex-col justify-between py-6 px-3">
      {/* Team logo watermark */}
      <div
        className={cn(
          "absolute opacity-[0.06] w-16 h-16",
          side === "home" ? "top-3 left-3" : "top-3 right-3",
        )}
      >
        {teamLogo && (
          <img src={teamLogo} alt={teamCode} className="w-full h-full" />
        )}
      </div>

      {rows.map((pos) => {
        const posPlayers = grouped[pos] ?? [];
        if (posPlayers.length === 0) return null;
        // Only show starters on pitch (max ~5-6 per row)
        const starters = posPlayers.filter(
          (p) => (p.anyPlayerGameStats?.minsPlayed ?? 0) > 0 || p.score > 0,
        );
        const display = starters.length > 0 ? starters : posPlayers.slice(0, 4);

        return (
          <div key={pos} className="flex justify-around items-start py-2">
            {display.map((ps) => (
              <PlayerNode
                key={ps.anyPlayer.slug}
                player={ps}
                isMine={myPlayerSlugs.has(ps.anyPlayer.slug)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Node (pitch view) ───

function PlayerNode({
  player,
  isMine,
}: {
  player: GamePlayerScore;
  isMine: boolean;
}) {
  const isPlaying = player.scoreStatus === "PLAYING";
  const isFinal = player.scoreStatus === "FINAL";
  const mins = player.anyPlayerGameStats?.minsPlayed ?? 0;
  const isDNP = mins === 0 && player.score === 0;
  const isSub = mins > 0 && mins < 85;

  const scoreBg = isPlaying
    ? "bg-green-500 text-white"
    : isFinal && player.score >= 60
      ? "bg-green-600 text-white"
      : isFinal && player.score >= 40
        ? "bg-yellow-500 text-zinc-900"
        : isFinal && player.score > 0
          ? "bg-orange-500 text-white"
          : "bg-zinc-700 text-zinc-300";

  return (
    <div className="flex flex-col items-center w-16">
      {/* Photo + score */}
      <div className="relative">
        {/* Sub indicator */}
        {isSub && (
          <div className="absolute -top-1 -right-1 z-10">
            <Clock className="w-3 h-3 text-amber-400" />
          </div>
        )}

        {/* Photo */}
        <div
          className={cn(
            "w-11 h-11 rounded-full overflow-hidden border-2",
            isMine
              ? "border-primary shadow-[0_0_8px_rgba(45,212,191,0.3)]"
              : isDNP
                ? "border-zinc-800 opacity-40"
                : "border-zinc-700",
          )}
        >
          {player.anyPlayer.squaredPictureUrl ? (
            <img
              src={player.anyPlayer.squaredPictureUrl}
              alt={player.anyPlayer.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800" />
          )}
        </div>

        {/* Score badge */}
        <div
          className={cn(
            "absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1.5 py-px rounded-full min-w-[24px] text-center",
            isDNP ? "bg-zinc-800 text-zinc-600" : scoreBg,
          )}
        >
          {isDNP ? "–" : Math.round(player.score)}
        </div>
      </div>

      {/* Name */}
      <p
        className={cn(
          "text-[9px] mt-2 text-center truncate w-full leading-tight",
          isMine ? "text-primary font-semibold" : "text-zinc-400",
        )}
      >
        {player.anyPlayer.displayName.split(" ").pop()}
      </p>
    </div>
  );
}

// ─── Players Tab (flat list fallback) ───

function PlayersList({
  game,
  myPlayerSlugs,
}: {
  game: GameDetail;
  myPlayerSlugs: Set<string>;
}) {
  const sorted = [...game.playerGameScores].sort((a, b) => b.score - a.score);

  return (
    <div className="p-4 space-y-1">
      {sorted.map((ps) => {
        const isMine = myPlayerSlugs.has(ps.anyPlayer.slug);
        const isPlaying = ps.scoreStatus === "PLAYING";
        const isFinal = ps.scoreStatus === "FINAL";
        const mins = ps.anyPlayerGameStats?.minsPlayed ?? 0;

        return (
          <div
            key={ps.anyPlayer.slug}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg",
              isMine ? "bg-primary/5 border border-primary/20" : "hover:bg-zinc-800/50",
            )}
          >
            {ps.anyPlayer.squaredPictureUrl ? (
              <img
                src={ps.anyPlayer.squaredPictureUrl}
                alt=""
                className="w-7 h-7 rounded-full bg-zinc-700 shrink-0 object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium truncate", isMine ? "text-primary" : "text-zinc-300")}>
                {ps.anyPlayer.displayName}
              </p>
              <p className="text-[10px] text-zinc-600">
                {ps.anyPlayer.activeClub?.code} · {ps.positionTyped}
                {mins > 0 && ` · ${mins}'`}
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-md tabular-nums",
                isPlaying
                  ? "bg-green-500/15 text-green-400"
                  : isFinal
                    ? "bg-zinc-800 text-white"
                    : "bg-zinc-800/50 text-zinc-500",
              )}
            >
              {Math.round(ps.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── Goal Scorers Line ───

function GoalScorersLine({ game }: { game: GameDetail }) {
  const scorers = extractGoalScorers(game);
  if (scorers.length === 0) return null;

  const homeScorers = scorers.filter((s) => s.teamCode === game.homeTeam.code);
  const awayScorers = scorers.filter((s) => s.teamCode === game.awayTeam.code);

  return (
    <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-zinc-400">
      {homeScorers.length > 0 && (
        <span className="text-right">
          {homeScorers.map((s) => s.playerName.split(" ").pop()).join(", ")} ⚽
        </span>
      )}
      {awayScorers.length > 0 && (
        <span>
          ⚽ {awayScorers.map((s) => s.playerName.split(" ").pop()).join(", ")}
        </span>
      )}
    </div>
  );
}

// ─── Match Chat ───

function MatchChat({ gameId, userSlug }: { gameId: string; userSlug: string }) {
  // Sanitize gameId for use as room_id (remove "Game:" prefix if present)
  const roomId = `game-${gameId.replace(/^Game:/, "")}`;
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as RoomMessage[]);
    }
    load();
  }, [roomId]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RoomMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function sendChat() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);

    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      author: userSlug,
      message: text,
      message_type: "chat",
      metadata: {},
    });

    if (error) console.error("Failed to send chat message:", error);
    setIsSending(false);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5">
        {messages.length === 0 ? (
          <p className="text-[10px] text-zinc-600 text-center mt-8">
            No messages yet
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <p className="text-[10px]">
                <span
                  className={cn(
                    "font-semibold",
                    msg.author === userSlug ? "text-purple-400" : "text-primary",
                  )}
                >
                  {msg.author.replace(/-/g, " ")}
                </span>
                {msg.author === userSlug && (
                  <span className="text-zinc-600 ml-1">(You)</span>
                )}
                <span className="text-zinc-600 ml-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <p className="text-[11px] text-zinc-300">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-2 py-1.5 border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Say something..."
            className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-1 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <button
            onClick={sendChat}
            disabled={!input.trim() || isSending}
            className="text-primary hover:text-primary/80 disabled:text-zinc-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── My Players Strip (right panel) ───

function MyPlayersStrip({
  cards,
  scores,
}: {
  cards: SorareCard[];
  scores: GamePlayerScore[];
}) {
  const scoreMap = new Map(scores.map((s) => [s.anyPlayer.slug, s]));

  // Sort: playing first, then by score descending, DNP last
  const sorted = [...cards].sort((a, b) => {
    const psA = scoreMap.get(a.anyPlayer?.slug ?? "");
    const psB = scoreMap.get(b.anyPlayer?.slug ?? "");
    const dnpA = !psA || psA.anyPlayerGameStats?.minsPlayed === 0;
    const dnpB = !psB || psB.anyPlayerGameStats?.minsPlayed === 0;
    if (dnpA !== dnpB) return dnpA ? 1 : -1;
    return (psB?.score ?? 0) - (psA?.score ?? 0);
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {sorted.map((card) => {
        const ps = scoreMap.get(card.anyPlayer?.slug ?? "");
        const isDNP = !ps || ps.anyPlayerGameStats?.minsPlayed === 0;
        const isPlaying = ps?.scoreStatus === "PLAYING";
        const score = Math.round(ps?.score ?? 0);
        const name = card.anyPlayer?.displayName?.split(" ").pop() ?? "";

        return (
          <div
            key={card.slug}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-lg border shrink-0 transition-all",
              isPlaying
                ? "bg-green-500/5 border-green-500/30"
                : isDNP
                  ? "bg-zinc-900/50 border-zinc-800 opacity-50"
                  : "bg-zinc-900/50 border-zinc-800",
            )}
          >
            <div className="relative">
              <img
                src={card.pictureUrl}
                alt={name}
                className="w-9 h-9 rounded-lg object-cover object-[center_18%]"
              />
              {isPlaying && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white truncate max-w-[80px]">{name}</p>
              <p className={cn(
                "text-[11px] font-bold",
                isDNP ? "text-zinc-600" : score >= 50 ? "text-green-400" : score >= 30 ? "text-white" : "text-zinc-400",
              )}>
                {isDNP ? "DNP" : `${score} pts`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
