"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SorareCard, Fixture, FixtureGame } from "@/lib/types";

interface Props {
  cards: SorareCard[];
  onSelectGame: (gameId: string) => void;
}

async function fetchFixture(type: "live" | "upcoming"): Promise<Fixture | null> {
  const res = await fetch(`/api/fixtures?type=${type}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.fixture ?? null;
}

function formatGameTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

function countMyPlayers(game: FixtureGame, cards: SorareCard[]): number {
  let count = 0;
  for (const card of cards) {
    const club = card.anyPlayer?.activeClub;
    if (!club?.code) continue;
    if (club.code === game.homeTeam.code || club.code === game.awayTeam.code) {
      count++;
    }
  }
  return count;
}

export function GamesList({ cards, onSelectGame }: Props) {
  // Fetch both live and upcoming fixtures
  const { data: liveFixture, isLoading: loadingLive } = useQuery({
    queryKey: ["fixture", "live"],
    queryFn: () => fetchFixture("live"),
    refetchInterval: 30_000, // poll every 30s for live updates
  });

  const { data: upcomingFixture, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["fixture", "upcoming"],
    queryFn: () => fetchFixture("upcoming"),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const isLoading = loadingLive && loadingUpcoming;

  // Combine games from both fixtures, dedupe by ID, filter to football only
  const allGames = new Map<string, FixtureGame>();

  for (const game of liveFixture?.games ?? []) {
    if (game.sport === "FOOTBALL") allGames.set(game.id, game);
  }
  for (const game of upcomingFixture?.games ?? []) {
    if (game.sport === "FOOTBALL" && !allGames.has(game.id)) {
      allGames.set(game.id, game);
    }
  }

  const games = Array.from(allGames.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const liveGames = games.filter((g) => g.statusTyped === "playing");
  const scheduledGames = games.filter((g) => g.statusTyped === "scheduled");
  const playedGames = games.filter((g) => g.statusTyped === "played");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-500">No games found</p>
          <p className="text-xs text-zinc-600">
            Check back when the gameweek starts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Live games */}
      {liveGames.length > 0 && (
        <GameSection
          label="Live Now"
          labelColor="text-green-400"
          pulse
          games={liveGames}
          cards={cards}
          onSelectGame={onSelectGame}
        />
      )}

      {/* Scheduled */}
      {scheduledGames.length > 0 && (
        <GameSection
          label="Upcoming"
          labelColor="text-zinc-500"
          icon={<Clock className="w-3.5 h-3.5 text-zinc-500" />}
          games={scheduledGames}
          cards={cards}
          onSelectGame={onSelectGame}
        />
      )}

      {/* Played */}
      {playedGames.length > 0 && (
        <GameSection
          label="Finished"
          labelColor="text-zinc-600"
          games={playedGames}
          cards={cards}
          onSelectGame={onSelectGame}
        />
      )}
    </div>
  );
}

function GameSection({
  label,
  labelColor,
  pulse,
  icon,
  games,
  cards,
  onSelectGame,
}: {
  label: string;
  labelColor: string;
  pulse?: boolean;
  icon?: React.ReactNode;
  games: FixtureGame[];
  cards: SorareCard[];
  onSelectGame: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {pulse && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
        {icon}
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            labelColor,
          )}
        >
          {label}
        </h3>
        <span className="text-[10px] text-zinc-600">{games.length}</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            playerCount={countMyPlayers(game, cards)}
            onClick={() => onSelectGame(game.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GameCard({
  game,
  playerCount,
  onClick,
}: {
  game: FixtureGame;
  playerCount: number;
  onClick: () => void;
}) {
  const isLive = game.statusTyped === "playing";
  const isPlayed = game.statusTyped === "played";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01]",
        isLive
          ? "bg-green-900/10 border-green-500/20 hover:border-green-500/40"
          : isPlayed
            ? "bg-zinc-800/30 border-zinc-700/30 hover:border-zinc-600"
            : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600",
      )}
    >
      {/* Competition + time/status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-zinc-500 truncate">
          {game.competition.name}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        ) : isPlayed ? (
          <span className="text-[10px] text-zinc-600">FT</span>
        ) : (
          <span className="text-[10px] text-zinc-500">
            {formatGameTime(game.date)}
          </span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {game.homeTeam.pictureUrl ? (
            <img
              src={game.homeTeam.pictureUrl}
              alt={game.homeTeam.code}
              className="w-6 h-6 rounded-full bg-zinc-700 shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0" />
          )}
          <span className="text-sm font-semibold text-zinc-200 truncate">
            {game.homeTeam.code}
          </span>
        </div>

        {/* Score or vs */}
        {isLive || isPlayed ? (
          <span className="text-sm font-bold text-white shrink-0 tabular-nums">
            {game.homeScore} - {game.awayScore}
          </span>
        ) : (
          <span className="text-xs text-zinc-600 font-bold shrink-0">vs</span>
        )}

        {/* Away */}
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-sm font-semibold text-zinc-200 truncate">
            {game.awayTeam.code}
          </span>
          {game.awayTeam.pictureUrl ? (
            <img
              src={game.awayTeam.pictureUrl}
              alt={game.awayTeam.code}
              className="w-6 h-6 rounded-full bg-zinc-700 shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0" />
          )}
        </div>
      </div>

      {/* Player count */}
      {playerCount > 0 && (
        <p className="text-[10px] text-zinc-600 mt-2">
          {playerCount} of your player{playerCount !== 1 ? "s" : ""}
        </p>
      )}
    </button>
  );
}
