"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Wand2,
  X,
  Star,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type {
  InSeasonCompetition,
  InSeasonLineupSlot,
  LineupPosition,
  SorareCard,
} from "@/lib/types";
import {
  POS_ORDER,
  useWorkspaceStore,
  type SlotMap,
  type WorkspaceTeam,
} from "@/lib/in-season/workspace-store";
import { estimateTotalScore, recommendInSeasonLineup } from "@/lib/ai-lineup";
import { positionMatchesSlot } from "@/lib/normalization";
import {
  validateInSeasonLineup,
  type ValidationResult,
} from "@/lib/in-season-validation";
import {
  isCrossLeagueCompetition,
  isEligibleForCompetition,
} from "@/lib/in-season/eligibility";
import { usePlayerIntel } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { TONE, TEAM_TONES } from "./tones";
import { TeamSlot } from "./team-slot";
import { WinProbCard } from "@/components/ai/win-prob-card";

interface TeamColumnProps {
  team: WorkspaceTeam;
  idx: number;
  totalTeams: number;
  cardsBySlug: Map<string, SorareCard>;
  target: number;
  competition: InSeasonCompetition;
}

export function TeamColumn({
  team,
  idx,
  totalTeams,
  cardsBySlug,
  target,
  competition,
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

  // Validation: convert team into the validator's InSeasonLineupSlot[] shape.
  const validation: ValidationResult = useMemo(() => {
    const lineupSlots: InSeasonLineupSlot[] = POS_ORDER.map((pos) => {
      const slug = team.slots[pos];
      const card = slug ? (cardsBySlug.get(slug) ?? null) : null;
      return {
        position: pos,
        card,
        isCaptain: !!card && team.captain === card.slug,
      };
    });
    return validateInSeasonLineup(lineupSlots, competition);
  }, [team, cardsBySlug, competition]);

  const inSeasonCount = players.filter(
    (p) => p && isEligibleForCompetition(p, competition),
  ).length;

  const hasError = validation.messages.some((m) => m.type === "error");
  const hasWarning =
    !hasError && validation.messages.some((m) => m.type === "warning");

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
  const setTeam = useWorkspaceStore((s) => s.setTeam);

  // AI Fill — score+place 5 cards into this team's slots, captain on the
  // top-projection card. Excludes cards already used in OTHER teams of the
  // same workspace so siblings don't fight over the same player.
  const galleryCards = useMemo(
    () => Array.from(cardsBySlug.values()),
    [cardsBySlug],
  );
  const playerIntel = usePlayerIntel(galleryCards);
  const [isFilling, setIsFilling] = useState(false);

  const handleAIFill = useCallback(async () => {
    if (isFilling) return;
    setIsFilling(true);
    try {
      const allTeams = useWorkspaceStore.getState().teams;
      const usedInOthers = new Set<string>();
      for (const t of allTeams) {
        if (t.id === team.id) continue;
        for (const slug of Object.values(t.slots)) {
          if (slug) usedInOthers.add(slug);
        }
      }
      const isCrossLeague = isCrossLeagueCompetition(competition.leagueName);
      const { lineup } = await recommendInSeasonLineup(
        galleryCards,
        {
          allowedRarities: [competition.mainRarityType],
          leagueRestriction: isCrossLeague ? null : competition.leagueName,
          minInSeasonCards: 4,
        },
        target,
        playerIntel ?? null,
        usedInOthers,
      );

      // Place each suggested card into a position-matching empty slot, with
      // EX as the wildcard fallback. Avoid duplicate players.
      const nextSlots: SlotMap = {
        GK: null,
        DEF: null,
        MID: null,
        FWD: null,
        EX: null,
      };
      const placedPlayerSlugs = new Set<string>();
      for (const sc of lineup) {
        const card = sc.card;
        const playerSlug = card.anyPlayer?.slug ?? card.slug;
        if (placedPlayerSlugs.has(playerSlug)) continue;
        const primaryPos = card.anyPlayer?.cardPositions?.[0];
        let bestSlot: LineupPosition | null = null;
        for (const pos of POS_ORDER) {
          if (nextSlots[pos]) continue;
          if (positionMatchesSlot(primaryPos, pos)) {
            bestSlot = pos;
            break;
          }
        }
        if (!bestSlot && !nextSlots.EX) {
          bestSlot = "EX";
        }
        if (bestSlot) {
          nextSlots[bestSlot] = card.slug;
          placedPlayerSlugs.add(playerSlug);
        }
      }

      // Captain = highest expectedScore among placed cards.
      let bestCaptain: string | null = null;
      let bestScore = -1;
      for (const pos of POS_ORDER) {
        const slug = nextSlots[pos];
        if (!slug) continue;
        const sc = lineup.find((l) => l.card.slug === slug);
        if (sc && sc.strategy.expectedScore > bestScore) {
          bestScore = sc.strategy.expectedScore;
          bestCaptain = slug;
        }
      }

      setTeam(team.id, nextSlots, bestCaptain);
    } catch (err) {
      console.error("[AI Fill] failed:", err);
    } finally {
      setIsFilling(false);
    }
  }, [
    isFilling,
    team.id,
    galleryCards,
    competition.leagueName,
    competition.mainRarityType,
    target,
    playerIntel,
    setTeam,
  ]);

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
        <ValidationStatus
          hasError={hasError}
          hasWarning={hasWarning}
          isComplete={filled === 5 && !hasError}
          messages={validation.messages}
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

      {/* Win prob card — only when at least one card is placed. Variant
          maps the simple "did we beat the target" classification to the
          recommender's safe/balanced/ceiling palette. */}
      {filled > 0 && (
        <div className="px-2 pt-2">
          <WinProbCard
            expected={score}
            successProbability={Math.min(1, Math.max(0, score / Math.max(target, 1)))}
            variant={
              targetState === "hit"
                ? "safe"
                : targetState === "near"
                  ? "balanced"
                  : "ceiling"
            }
          />
        </div>
      )}

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
          onClick={handleAIFill}
          disabled={isFilling || galleryCards.length === 0}
          className="mono text-[9px] uppercase tracking-wide text-zinc-500 hover:text-purple-300 px-1.5 py-1 rounded hover:bg-purple-500/10 flex items-center gap-1 disabled:opacity-50 disabled:cursor-wait"
        >
          {isFilling ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Wand2 className="w-3 h-3" />
          )}
          AI Fill
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

function ValidationStatus({
  hasError,
  hasWarning,
  isComplete,
  messages,
}: {
  hasError: boolean;
  hasWarning: boolean;
  isComplete: boolean;
  messages: ValidationResult["messages"];
}) {
  const [open, setOpen] = useState(false);
  const visible = messages.filter(
    (m) => m.type === "error" || m.type === "warning",
  );
  if (visible.length === 0 && !isComplete) return null;

  const tone = hasError
    ? "text-red-400"
    : hasWarning
      ? "text-amber-400"
      : "text-emerald-400";
  const Icon = hasError || hasWarning ? AlertTriangle : CheckCircle2;
  const label = hasError ? "issues" : hasWarning ? "warnings" : "valid";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-5 h-5 grid place-items-center rounded-full border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900",
          tone,
        )}
        title={label}
      >
        <Icon className="w-3 h-3" />
      </button>
      {open && visible.length > 0 && (
        <div className="absolute z-30 right-0 top-7 w-72 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl p-2 space-y-1.5">
          {visible.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 px-2 py-1.5 rounded text-[11px] leading-snug",
                m.type === "error"
                  ? "bg-red-500/10 text-red-300 border border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20",
              )}
            >
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{m.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
