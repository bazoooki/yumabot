"use client";

import { useMemo, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import type { InSeasonCompetition, SorareCard } from "@/lib/types";
import { RARITY_CONFIG } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/in-season/workspace-store";
import { estimateTotalScore } from "@/lib/ai-lineup";
import { usePlayerIntel } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { POS_ORDER } from "@/lib/in-season/workspace-store";
import { AIVerdict } from "@/components/ai/ai-verdict";

interface AITakeDrawerProps {
  competition: InSeasonCompetition;
  cardsBySlug: Map<string, SorareCard>;
  target: number;
  rewardLabel: string;
}

interface DraftPlayerSummary {
  name: string;
  pos: string;
  starterProb?: number;
  expected?: number;
  lastFiveAvg?: number;
}

interface DraftSummary {
  name: string;
  expected: number;
  winProb: number;
  captain: string | null;
  players: DraftPlayerSummary[];
}

function avgRecent(card: SorareCard): number | undefined {
  const list = card.rawRecentSo5;
  if (!list || list.length === 0) return undefined;
  let sum = 0;
  let n = 0;
  for (const s of list) {
    if (typeof s !== "number" || Number.isNaN(s)) continue;
    sum += s;
    n++;
  }
  return n > 0 ? sum / n : undefined;
}

export function AITakeDrawer({
  competition,
  cardsBySlug,
  target,
  rewardLabel,
}: AITakeDrawerProps) {
  const allTeams = useWorkspaceStore((s) => s.teams);
  const teamCount = useWorkspaceStore((s) => s.teamCount);
  const notes = useWorkspaceStore((s) => s.notes);
  const visibleTeams = useMemo(
    () => allTeams.slice(0, teamCount),
    [allTeams, teamCount],
  );

  const galleryCards = useMemo(
    () => Array.from(cardsBySlug.values()),
    [cardsBySlug],
  );
  const playerIntel = usePlayerIntel(galleryCards);

  const drafts: DraftSummary[] = useMemo(() => {
    return visibleTeams
      .map((team) => {
        const players = POS_ORDER.map((pos) => {
          const slug = team.slots[pos];
          return slug ? cardsBySlug.get(slug) ?? null : null;
        });
        if (players.every((p) => !p)) return null;
        const captainIndex = team.captain
          ? players.findIndex((p) => p?.slug === team.captain)
          : -1;
        const expected = estimateTotalScore(
          players,
          captainIndex >= 0 ? captainIndex : null,
        );
        const winProb = Math.min(
          1,
          Math.max(0, expected / Math.max(target, 1)),
        );
        const captainName = team.captain
          ? cardsBySlug.get(team.captain)?.anyPlayer?.displayName ?? null
          : null;

        const summaries: DraftPlayerSummary[] = [];
        POS_ORDER.forEach((pos, i) => {
          const card = players[i];
          if (!card?.anyPlayer) return;
          const starter = card.anyPlayer.slug
            ? playerIntel?.[card.anyPlayer.slug]?.starterProbability
            : null;
          summaries.push({
            name: card.anyPlayer.displayName,
            pos,
            starterProb:
              typeof starter === "number" ? starter / 100 : undefined,
            expected: estimateTotalScore([card]),
            lastFiveAvg: avgRecent(card),
          });
        });

        return {
          name: team.name,
          expected,
          winProb,
          captain: captainName,
          players: summaries,
        };
      })
      .filter((d): d is DraftSummary => d !== null);
  }, [visibleTeams, cardsBySlug, target, playerIntel]);

  const rarityLabel =
    RARITY_CONFIG[competition.mainRarityType]?.label ??
    competition.mainRarityType;

  const payload = useMemo(
    () => ({
      competition: {
        leagueName: competition.leagueName,
        rarity: rarityLabel,
        division: competition.division,
      },
      targetThreshold: { score: target, reward: rewardLabel },
      drafts,
      notes,
    }),
    [
      competition.leagueName,
      competition.division,
      rarityLabel,
      target,
      rewardLabel,
      drafts,
      notes,
    ],
  );

  const cacheKey = useMemo(() => {
    const draftKey = drafts
      .map(
        (d) =>
          `${d.name}:${Math.round(d.expected / 5) * 5}:${
            Math.round(d.winProb * 100)
          }:${d.captain ?? "-"}:${d.players.map((p) => p.name).sort().join(",")}`,
      )
      .join("|");
    return [
      "ai-in-season-take",
      competition.slug,
      target,
      notes.length,
      draftKey,
    ];
  }, [drafts, competition.slug, target, notes.length]);

  const [open, setOpen] = useState(false);
  const ready = drafts.length > 0;

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!ready}
        className={cn(
          "w-full px-4 py-2 flex items-center gap-2 transition-colors",
          ready
            ? "text-amber-300 hover:bg-amber-500/5"
            : "text-zinc-600 cursor-not-allowed",
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="mono text-[10px] uppercase tracking-wider font-bold">
          AI Take
        </span>
        <span className="mono text-[10px] text-zinc-500 normal-case font-normal">
          {ready
            ? `${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"} · click for prep advice`
            : "Add cards to a team to unlock"}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 ml-auto transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && ready && (
        <div className="px-4 pb-3">
          <AIVerdict
            endpoint="/api/ai/in-season-take"
            payload={payload}
            cacheKey={cacheKey}
            variant="amber"
            label="AI Prep Coach"
            staleTime={5 * 60 * 1000}
          />
        </div>
      )}
    </div>
  );
}
