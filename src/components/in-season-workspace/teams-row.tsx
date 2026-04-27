"use client";

import { Plus } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import {
  selectVisibleTeams,
  useWorkspaceStore,
} from "@/lib/in-season/workspace-store";
import { TeamColumn } from "./team-column";

interface TeamsRowProps {
  cardsBySlug: Map<string, SorareCard>;
  target: number;
}

export function TeamsRow({ cardsBySlug, target }: TeamsRowProps) {
  const teams = useWorkspaceStore(selectVisibleTeams);
  const teamCount = useWorkspaceStore((s) => s.teamCount);
  const setTeamCount = useWorkspaceStore((s) => s.setTeamCount);

  return (
    <div className="flex-1 p-3 overflow-x-auto">
      <div className="flex gap-3 h-full min-w-min">
        {teams.map((team, i) => (
          <TeamColumn
            key={team.id}
            team={team}
            idx={i}
            totalTeams={teamCount}
            cardsBySlug={cardsBySlug}
            target={target}
          />
        ))}
        {teamCount < 4 && (
          <button
            type="button"
            onClick={() => setTeamCount(teamCount + 1)}
            className="min-w-[180px] rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/30 transition-all grid place-items-center text-zinc-600 hover:text-zinc-300"
          >
            <div className="text-center">
              <Plus className="w-6 h-6 mx-auto mb-1" />
              <div className="mono text-[10px] uppercase tracking-wider">
                Add team
              </div>
              <div className="mono text-[9px] text-zinc-700 mt-0.5">
                {teamCount}/4
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
