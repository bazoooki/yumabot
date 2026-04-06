"use client";

import { useMemo } from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SorareCard, UpcomingGame } from "@/lib/types";

interface GameEntry {
  id: string;
  game: UpcomingGame;
  date: Date;
  playerCount: number;
}

interface Props {
  cards: SorareCard[];
  onSelectGame: (gameId: string) => void;
}

function formatGameTime(d: Date): string {
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

function isLive(d: Date): boolean {
  const now = Date.now();
  const start = d.getTime();
  return now >= start && now <= start + 120 * 60 * 1000; // within 2 hours of kickoff
}

export function GamesList({ cards, onSelectGame }: Props) {
  // Extract unique games from player cards
  const games = useMemo(() => {
    const gameMap = new Map<string, GameEntry>();

    for (const card of cards) {
      const upcoming = card.anyPlayer?.activeClub?.upcomingGames;
      if (!upcoming?.length) continue;

      for (const game of upcoming) {
        const id = `${game.homeTeam.code}-${game.awayTeam.code}-${game.date}`;
        const existing = gameMap.get(id);
        if (existing) {
          existing.playerCount++;
        } else {
          gameMap.set(id, {
            id,
            game,
            date: new Date(game.date),
            playerCount: 1,
          });
        }
      }
    }

    return Array.from(gameMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [cards]);

  const liveGames = games.filter((g) => isLive(g.date));
  const upcomingGames = games.filter((g) => !isLive(g.date));

  if (games.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-500">No upcoming games found</p>
          <p className="text-xs text-zinc-600">
            Games from your players' clubs will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Live games section */}
      {liveGames.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider">
              Live Now
            </h3>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {liveGames.map((g) => (
              <GameCard
                key={g.id}
                entry={g}
                isLive
                onClick={() => onSelectGame(g.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming games section */}
      {upcomingGames.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Upcoming
            </h3>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {upcomingGames.map((g) => (
              <GameCard
                key={g.id}
                entry={g}
                isLive={false}
                onClick={() => onSelectGame(g.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GameCard({
  entry,
  isLive,
  onClick,
}: {
  entry: GameEntry;
  isLive: boolean;
  onClick: () => void;
}) {
  const { game, date, playerCount } = entry;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01]",
        isLive
          ? "bg-green-900/10 border-green-500/20 hover:border-green-500/40"
          : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600",
      )}
    >
      {/* Competition + time */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-zinc-500 truncate">
          {game.competition.name}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500">
            {formatGameTime(date)}
          </span>
        )}
      </div>

      {/* Teams */}
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

        <span className="text-xs text-zinc-600 font-bold shrink-0">vs</span>

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
      <p className="text-[10px] text-zinc-600 mt-2">
        {playerCount} of your player{playerCount !== 1 ? "s" : ""}
      </p>
    </button>
  );
}
