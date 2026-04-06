"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerData {
  name: string;
  position: string;
  club: string | null;
  pictureUrl: string;
  isCaptain: boolean;
  expectedScore: number;
  floor: number;
  ceiling: number;
  consistency: number;
  startProbability: number;
  strategyTag: string;
  power: string;
  editionLabel: string;
  opponent: string | null;
  isHome: boolean;
  gameTime: string | null;
}

interface RunnerUp {
  name: string;
  position: string;
  expectedScore: number;
  strategyTag: string;
}

interface LineupRecommendation {
  type: string;
  level: number;
  threshold: number;
  projectedTotal: number;
  strategyMode: string;
  gameBatch: string;
  players: PlayerData[];
  runnersUp: RunnerUp[];
}

const POSITION_COLORS: Record<string, string> = {
  Goalkeeper: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Defender: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Midfielder: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Forward: "bg-red-500/20 text-red-400 border-red-500/30",
};

const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Forward: "FWD",
};

const TAG_COLORS: Record<string, string> = {
  SAFE: "bg-green-500/20 text-green-400",
  BALANCED: "bg-blue-500/20 text-blue-400",
  CEILING: "bg-amber-500/20 text-amber-400",
  RISKY: "bg-red-500/20 text-red-400",
};

function formatGameTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

interface Props {
  data: Record<string, unknown>;
}

export function CommandBarLineupResult({ data }: Props) {
  const rec = data as unknown as LineupRecommendation;
  const { level, threshold, projectedTotal, players, runnersUp } = rec;

  const pct = Math.min(100, (projectedTotal / threshold) * 100);
  const status =
    projectedTotal >= threshold
      ? "ON TRACK"
      : projectedTotal >= threshold * 0.95
        ? "CLOSE"
        : "BELOW";
  const statusColor =
    status === "ON TRACK"
      ? "text-green-400"
      : status === "CLOSE"
        ? "text-amber-400"
        : "text-red-400";
  const barColor =
    status === "ON TRACK"
      ? "bg-green-500"
      : status === "CLOSE"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="space-y-3">
      {/* Score progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">
            Level {level} · Target {threshold} pts
          </span>
          <span className={cn("font-bold", statusColor)}>
            {projectedTotal} / {threshold} · {status}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Player cards strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {players.map((p) => (
          <div
            key={p.name}
            className="shrink-0 w-[108px] bg-zinc-800/60 border border-zinc-700/50 rounded-lg overflow-hidden"
          >
            {/* Image */}
            <div className="relative h-[72px] bg-zinc-900">
              <img
                src={p.pictureUrl}
                alt={p.name}
                className="w-full h-full object-cover object-[center_18%]"
              />
              {/* Captain badge */}
              {p.isCaptain && (
                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <Crown className="w-3 h-3 text-zinc-900" />
                </div>
              )}
              {/* Position badge */}
              <span
                className={cn(
                  "absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold border",
                  POSITION_COLORS[p.position] ?? "bg-zinc-700 text-zinc-300",
                )}
              >
                {POSITION_SHORT[p.position] ?? "EX"}
              </span>
            </div>

            {/* Info */}
            <div className="px-2 py-1.5 space-y-1">
              <p className="text-[11px] font-semibold text-white truncate">
                {p.name}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-300 font-bold">
                  ~{p.expectedScore}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded",
                    TAG_COLORS[p.strategyTag] ?? "bg-zinc-700 text-zinc-400",
                  )}
                >
                  {p.strategyTag}
                </span>
              </div>
              {p.opponent && (
                <p className="text-[10px] text-zinc-500 truncate">
                  {p.isHome ? "vs" : "@"} {p.opponent} · {formatGameTime(p.gameTime)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Runners-up */}
      {runnersUp.length > 0 && (
        <p className="text-[11px] text-zinc-500">
          <span className="text-zinc-400">Swap options:</span>{" "}
          {runnersUp
            .map((r) => `${r.name} (~${r.expectedScore})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
