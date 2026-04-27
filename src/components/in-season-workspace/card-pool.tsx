"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { InSeasonCompetition, LineupPosition, SorareCard } from "@/lib/types";
import {
  POS_ORDER,
  selectVisibleTeams,
  useWorkspaceStore,
} from "@/lib/in-season/workspace-store";
import { isEligibleForCompetition } from "@/lib/in-season/eligibility";
import { cn } from "@/lib/utils";
import { CardPoolRow } from "./card-pool-row";
import {
  DRAG_MIME,
  cardPrimaryPosition,
  tryParsePayload,
} from "./dnd";

interface CardPoolProps {
  comp: InSeasonCompetition;
  cards: SorareCard[];
}

type PosFilter = "ALL" | LineupPosition;

const POS_FILTERS: ReadonlyArray<PosFilter> = ["ALL", ...POS_ORDER];

export function CardPool({ comp, cards }: CardPoolProps) {
  const drag = useWorkspaceStore((s) => s.drag);
  const setDrag = useWorkspaceStore((s) => s.setDrag);
  const dropToPool = useWorkspaceStore((s) => s.dropToPool);
  const visibleTeams = useWorkspaceStore(selectVisibleTeams);
  const [hover, setHover] = useState(false);
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [query, setQuery] = useState("");

  // Per-card "used in teams" map across the visible drafts.
  const usageBySlug = useMemo(() => {
    const m = new Map<string, number[]>();
    visibleTeams.forEach((team, idx) => {
      Object.values(team.slots).forEach((slug) => {
        if (!slug) return;
        const arr = m.get(slug) ?? [];
        arr.push(idx);
        m.set(slug, arr);
      });
    });
    return m;
  }, [visibleTeams]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const eligible = cards
      .filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.[0])
      .map((c) => ({
        card: c,
        pos: cardPrimaryPosition(c),
        isEligible: isEligibleForCompetition(c, comp),
      }))
      .filter((entry) => entry.card.rarityTyped === comp.mainRarityType);

    const filtered = eligible.filter(({ card, pos }) => {
      if (posFilter !== "ALL" && pos !== posFilter) return false;
      if (q.length === 0) return true;
      const name = card.anyPlayer?.displayName?.toLowerCase() ?? "";
      const club = card.anyPlayer?.activeClub?.name?.toLowerCase() ?? "";
      const code = card.anyPlayer?.activeClub?.code?.toLowerCase() ?? "";
      return name.includes(q) || club.includes(q) || code.includes(q);
    });

    // Sort by primary projection (avg score for now) then start prob — we'll
    // graduate to a composite smart score in a follow-up once playerIntel
    // is plumbed end-to-end.
    filtered.sort((a, b) => {
      const ax = a.card.anyPlayer?.averageScore ?? 0;
      const bx = b.card.anyPlayer?.averageScore ?? 0;
      return bx - ax;
    });

    // Group by kickoff day (Sat / Sun / etc.)
    const groups = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const date = entry.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
      const key = date
        ? new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })
        : "Unknown";
      const arr = groups.get(key) ?? [];
      arr.push(entry);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [cards, comp, posFilter, query]);

  const onDragOver = (e: React.DragEvent) => {
    if (drag?.from !== "slot") return;
    e.preventDefault();
    setHover(true);
  };
  const onDragLeave = () => setHover(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setHover(false);
    const payload =
      drag ??
      tryParsePayload(e.dataTransfer.getData(DRAG_MIME)) ??
      tryParsePayload(e.dataTransfer.getData("text/plain"));
    if (!payload || payload.from !== "slot") return;
    dropToPool(payload);
    setDrag(null);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col h-full bg-zinc-950/40 border-l border-zinc-800/80 transition-colors",
        hover && "bg-red-500/5",
      )}
    >
      <div className="px-3 py-2 border-b border-zinc-800/80 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player, club…"
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md pl-7 pr-2 py-1.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {POS_FILTERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosFilter(p)}
              className={cn(
                "mono text-[9px] font-bold uppercase px-1.5 py-1 rounded border transition-all",
                posFilter === p
                  ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {hover && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 mono text-[10px] uppercase text-red-300 text-center">
          ↩ Drop here to remove from team
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 mono text-[10px] uppercase text-zinc-600">
            No eligible cards
          </div>
        ) : (
          filteredGroups.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span className="mono text-[9px] uppercase tracking-wider text-zinc-500 font-bold">
                  {day}
                </span>
                <span className="mono text-[9px] text-zinc-600">
                  · {items.length}
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              <div className="space-y-1.5">
                {items.map((entry) => (
                  <CardPoolRow
                    key={entry.card.slug}
                    card={entry.card}
                    usage={usageBySlug.get(entry.card.slug) ?? []}
                    isEligible={entry.isEligible}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
