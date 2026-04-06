"use client";

import { useState, useEffect } from "react";
import { Users, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FixtureGame } from "@/lib/types";

interface GameWindow {
  windowLabel: string;
  windowStart: string;
  windowEnd: string;
  games: FixtureGame[];
  room: { id: string; invite_code: string; status: string } | null;
  participantCount: number;
}

interface RoomsListProps {
  userSlug: string;
  onEnterRoom: (roomId: string) => void;
}

function isLive(game: FixtureGame): boolean {
  return game.statusTyped === "playing";
}

function isFinished(game: FixtureGame): boolean {
  return game.statusTyped === "played";
}

function windowStatus(games: FixtureGame[]): "upcoming" | "live" | "finished" {
  if (games.some(isLive)) return "live";
  if (games.every(isFinished)) return "finished";
  return "upcoming";
}

export function RoomsList({ userSlug, onEnterRoom }: RoomsListProps) {
  const [windows, setWindows] = useState<GameWindow[]>([]);
  const [fixtureName, setFixtureName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/rooms?userSlug=${userSlug}`);
        const data = await res.json();
        setWindows(data.windows || []);
        if (data.fixture) {
          setFixtureName(`${data.fixture.displayName} — GW${data.fixture.gameWeek}`);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [userSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">Game Rooms</h2>
          {fixtureName && (
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {fixtureName}
            </p>
          )}
        </div>

        {windows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Calendar className="w-8 h-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">No upcoming games found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {windows.filter((w) => {
              // Hide windows where latest kickoff + 3h is in the past
              const latest = Math.max(...w.games.map((g) => new Date(g.date).getTime()));
              return latest + 3 * 60 * 60 * 1000 > Date.now();
            }).map((w) => {
              const status = windowStatus(w.games);
              return (
                <button
                  key={w.windowStart}
                  onClick={() => w.room && onEnterRoom(w.room.id)}
                  disabled={!w.room}
                  className="w-full text-left rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 transition-all p-4 group"
                >
                  {/* Window header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      status === "live" ? "bg-green-400 animate-pulse" :
                      status === "finished" ? "bg-zinc-600" :
                      "bg-yellow-400"
                    )} />
                    <span className="text-sm font-semibold text-white flex-1">
                      {w.windowLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      {w.participantCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                          <Users className="w-3 h-3" />
                          {w.participantCount}
                        </span>
                      )}
                      {status === "live" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">
                          LIVE
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </div>

                  {/* Game list with logos */}
                  <div className="flex flex-wrap gap-2">
                    {w.games.map((game) => (
                      <div
                        key={game.id}
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg",
                          isLive(game) ? "bg-green-950/40 text-green-300 border border-green-800/40" :
                          isFinished(game) ? "bg-zinc-800/50 text-zinc-500" :
                          "bg-zinc-800/80 text-zinc-400"
                        )}
                      >
                        {game.homeTeam.pictureUrl && (
                          <img src={game.homeTeam.pictureUrl} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <span>{game.homeTeam.code}</span>
                        <span className="text-zinc-600">-</span>
                        <span>{game.awayTeam.code}</span>
                        {game.awayTeam.pictureUrl && (
                          <img src={game.awayTeam.pictureUrl} alt="" className="w-4 h-4 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
