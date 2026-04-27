"use client";

import { Wand2, X, Star, Zap } from "lucide-react";
import type { LineupPosition, SorareCard } from "@/lib/types";
import {
  POS_ORDER,
  useWorkspaceStore,
  type WorkspaceTeam,
} from "@/lib/in-season/workspace-store";
import { estimateTotalScore } from "@/lib/ai-lineup";
import { cn } from "@/lib/utils";
import { TONE, TEAM_TONES } from "./tones";
import { TeamSlot } from "./team-slot";

interface TeamColumnProps {
  team: WorkspaceTeam;
  idx: number;
  totalTeams: number;
  cardsBySlug: Map<string, SorareCard>;
  target: number;
}

export function TeamColumn({
  team,
  idx,
  totalTeams,
  cardsBySlug,
  target,
}: TeamColumnProps) {
  const tone = TONE[TEAM_TONES[idx]];
  const players = POS_ORDER.map((pos) => {
    const slug = team.slots[pos];
    return slug ? (cardsBySlug.get(slug) ?? null) : null;
  });
  const filled = players.filter((p) => !!p).length;
  const captainIndex = team.captain
    ? players.findIndex((p) => p?.slug === team.captain)
    : -1;
  const score = Math.round(
    estimateTotalScore(players, captainIndex >= 0 ? captainIndex : null),
  );
  const targetState =
    score >= target ? "hit" : score >= target - 30 ? "near" : "far";
  const scoreTone =
    targetState === "hit"
      ? TONE.emerald
      : targetState === "near"
        ? TONE.amber
        : TONE.pink;

  // "in-season" count placeholder — real counter wired in C.6 via the
  // validator. For now match the mock and count cards with any track.
  const inSeasonCount = players.filter(
    (p) => (p?.eligibleUpcomingLeagueTracks?.length ?? 0) > 0,
  ).length;

  const widthCls =
    totalTeams === 1
      ? "min-w-[480px] flex-1"
      : totalTeams === 2
        ? "min-w-[360px] flex-1"
        : totalTeams === 3
          ? "min-w-[300px] flex-1"
          : "min-w-[260px] flex-1";

  const rename = useWorkspaceStore((s) => s.rename);
  const closeTeam = useWorkspaceStore((s) => s.closeTeam);
  const clearTeam = useWorkspaceStore((s) => s.clearTeam);

  return (
    <div
      className={cn(
        widthCls,
        "flex flex-col rounded-xl border bg-zinc-900/30 overflow-hidden",
        tone.border,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "px-2.5 py-2 border-b border-zinc-800/80 flex items-center gap-2",
          tone.soft,
        )}
      >
        <div
          className={cn(
            "w-5 h-5 rounded-md grid place-items-center text-zinc-950 mono text-[10px] font-black",
            tone.bar,
          )}
        >
          {String.fromCharCode(65 + idx)}
        </div>
        <input
          value={team.name}
          onChange={(e) => rename(team.id, e.target.value)}
          className="flex-1 bg-transparent text-[12px] font-semibold text-zinc-100 outline-none focus:bg-zinc-950/50 rounded px-1 py-0.5 min-w-0"
        />
        <span
          className={cn(
            "mono text-[10px] font-bold tabular-nums",
            filled === 5
              ? "text-emerald-400"
              : filled > 0
                ? tone.text
                : "text-zinc-600",
          )}
        >
          {filled}/5
        </span>
        {totalTeams > 1 && (
          <button
            type="button"
            onClick={() => closeTeam(team.id)}
            className="w-5 h-5 grid place-items-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
            title="Remove team"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Score strip */}
      <div
        className={cn(
          "px-2.5 py-1.5 border-b border-zinc-800/80 flex items-center gap-2",
          scoreTone.soft,
        )}
      >
        <Zap className={cn("w-3 h-3", scoreTone.text)} />
        <span className="mono text-[9px] uppercase tracking-wider text-zinc-500">
          est.
        </span>
        <span
          className={cn(
            "text-base font-bold tabular-nums leading-none",
            scoreTone.text,
          )}
        >
          {score}
        </span>
        <span className="text-zinc-600 text-[10px]">/</span>
        <span className="mono text-[10px] tabular-nums text-zinc-400">
          {target}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span
            className={cn(
              "mono text-[8px] font-bold uppercase",
              inSeasonCount >= 4 ? "text-emerald-400" : "text-amber-400",
            )}
          >
            IS {inSeasonCount}/4
          </span>
          {team.captain && (
            <span className="mono text-[8px] font-bold uppercase text-amber-400">
              CAP ✓
            </span>
          )}
        </div>
      </div>

      {/* Slots */}
      <div className="flex-1 p-2 space-y-1.5">
        {(POS_ORDER as ReadonlyArray<LineupPosition>).map((pos) => (
          <TeamSlot
            key={pos}
            position={pos}
            card={
              team.slots[pos] ? (cardsBySlug.get(team.slots[pos]!) ?? null) : null
            }
            teamId={team.id}
            teamTone={TEAM_TONES[idx]}
            isCaptain={
              team.captain != null && team.slots[pos] === team.captain
            }
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-2 py-1.5 border-t border-zinc-800/80 flex items-center gap-1">
        <button
          type="button"
          // TODO C.4/D.1: wire AI fill on this team
          className="mono text-[9px] uppercase tracking-wide text-zinc-500 hover:text-zinc-200 px-1.5 py-1 rounded hover:bg-zinc-800/60 flex items-center gap-1"
        >
          <Wand2 className="w-3 h-3" /> AI Fill
        </button>
        <button
          type="button"
          onClick={() => clearTeam(team.id)}
          className="mono text-[9px] uppercase tracking-wide text-zinc-500 hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-500/10 flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Clear
        </button>
        <span className="ml-auto mono text-[9px] uppercase tracking-wide text-amber-400 flex items-center gap-1">
          <Star className="w-3 h-3" />
          {team.captain ? "Captain set" : "Pick captain"}
        </span>
      </div>
    </div>
  );
}
