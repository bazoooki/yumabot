"use client";

import { useMemo, useState } from "react";
import { Search, ArrowDownUp } from "lucide-react";
import type {
  InSeasonCompetition,
  LineupPosition,
  SorareCard,
} from "@/lib/types";
import {
  POS_ORDER,
  useWorkspaceStore,
} from "@/lib/in-season/workspace-store";
import { isEligibleForCompetition } from "@/lib/in-season/eligibility";
import { usePlayerIntel } from "@/lib/hooks";
import { estimateTotalScore } from "@/lib/ai-lineup";
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

type SortKey = "score" | "power" | "form" | "time";
type EligibilityFilter = "in-season" | "all";

const SORT_LABELS: Record<SortKey, string> = {
  score: "Proj",
  power: "Power",
  form: "Form (L5)",
  time: "Kickoff",
};

const SORT_ORDER: ReadonlyArray<SortKey> = ["score", "power", "form", "time"];

function avgRecentSo5(card: SorareCard): number {
  const list = card.rawRecentSo5;
  if (!list || list.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const s of list) {
    if (typeof s !== "number" || Number.isNaN(s)) continue;
    sum += s;
    n++;
  }
  return n > 0 ? sum / n : 0;
}

function powerNumeric(card: SorareCard): number {
  const raw = card.power;
  if (!raw) return 0;
  const parsed = parseFloat(String(raw));
  return Number.isFinite(parsed) ? parsed : 0;
}

function kickoffMs(card: SorareCard): number {
  const date = card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
  if (!date) return Number.POSITIVE_INFINITY;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function CardPool({ comp, cards }: CardPoolProps) {
  const drag = useWorkspaceStore((s) => s.drag);
  const setDrag = useWorkspaceStore((s) => s.setDrag);
  const dropToPool = useWorkspaceStore((s) => s.dropToPool);
  const allTeams = useWorkspaceStore((s) => s.teams);
  const teamCount = useWorkspaceStore((s) => s.teamCount);
  const visibleTeams = useMemo(
    () => allTeams.slice(0, teamCount),
    [allTeams, teamCount],
  );
  const [hover, setHover] = useState(false);
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [eligibilityFilter, setEligibilityFilter] =
    useState<EligibilityFilter>("in-season");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [query, setQuery] = useState("");

  const playerIntel = usePlayerIntel(cards);

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
    const base = cards
      .filter((c) => c.anyPlayer?.activeClub?.upcomingGames?.[0])
      .filter((c) => c.rarityTyped === comp.mainRarityType)
      .map((c) => ({
        card: c,
        pos: cardPrimaryPosition(c),
        isEligible: isEligibleForCompetition(c, comp),
      }));

    const filtered = base.filter(({ card, pos, isEligible }) => {
      if (eligibilityFilter === "in-season" && !isEligible) return false;
      if (posFilter !== "ALL" && pos !== posFilter) return false;
      if (q.length === 0) return true;
      const name = card.anyPlayer?.displayName?.toLowerCase() ?? "";
      const club = card.anyPlayer?.activeClub?.name?.toLowerCase() ?? "";
      const code = card.anyPlayer?.activeClub?.code?.toLowerCase() ?? "";
      return name.includes(q) || club.includes(q) || code.includes(q);
    });

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "score":
          return estimateTotalScore([b.card]) - estimateTotalScore([a.card]);
        case "power":
          return powerNumeric(b.card) - powerNumeric(a.card);
        case "form":
          return avgRecentSo5(b.card) - avgRecentSo5(a.card);
        case "time":
          return kickoffMs(a.card) - kickoffMs(b.card);
      }
    });

    // Group by kickoff day (Sat / Sun / etc.). The "time" sort is already
    // chronological inside groups; for other sorts we still group by day so
    // the user sees the matchday structure but ordered by their chosen metric.
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
  }, [cards, comp, posFilter, eligibilityFilter, sortKey, query]);

  const totalCount = filteredGroups.reduce((n, [, list]) => n + list.length, 0);

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

        {/* Eligibility toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-zinc-950/60 border border-zinc-800">
          {(["in-season", "all"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEligibilityFilter(mode)}
              className={cn(
                "flex-1 mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-1 rounded transition-all",
                eligibilityFilter === mode
                  ? mode === "in-season"
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {mode === "in-season" ? "In-Season" : "All"}
            </button>
          ))}
        </div>

        {/* Position filter */}
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

        {/* Sort + count */}
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="mono text-[9px] uppercase tracking-wider text-zinc-500 shrink-0">
            Sort
          </span>
          <div className="flex-1 flex items-center gap-1 flex-wrap">
            {SORT_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                className={cn(
                  "mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-all",
                  sortKey === k
                    ? "border-pink-500/40 bg-pink-500/15 text-pink-300"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300",
                )}
              >
                {SORT_LABELS[k]}
              </button>
            ))}
          </div>
          <span className="mono text-[9px] tabular-nums text-zinc-600">
            {totalCount}
          </span>
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
            {eligibilityFilter === "in-season"
              ? "No in-season cards match"
              : "No cards match"}
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
                    starterProb={
                      entry.card.anyPlayer?.slug
                        ? (playerIntel?.[entry.card.anyPlayer.slug]
                            ?.starterProbability ?? null)
                        : null
                    }
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
