"use client";

import { useState, useMemo } from "react";
import { Zap } from "lucide-react";
import { getStatLabel } from "@/lib/game-events";
import { cn } from "@/lib/utils";
import type { GameDetail, GameEvent, FeedItem, BatchedGameEvent } from "@/lib/types";
import { isBatchedEvent } from "@/lib/types";

const REACTION_EMOJIS = ["🔥", "👏", "😤", "💪", "😩", "🫡"];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Left-border color for an event, keyed on stat + sign */
function getEventBorder(ev: GameEvent, isNear: boolean): string {
  if (isNear) return "border-l-amber-500";
  switch (ev.stat) {
    case "goal":
    case "goals":
    case "assist":
      return "border-l-green-500";
    case "own_goal":
    case "red_card":
    case "error_led_to_goal":
    case "penalty_conceded":
      return "border-l-red-500";
    case "yellow_card":
      return "border-l-yellow-500";
    case "substitution":
    case "injury_sub":
      return "border-l-cyan-500";
  }
  if (ev.pointsDelta > 0) return "border-l-green-500/60";
  if (ev.pointsDelta < 0) return "border-l-red-500/60";
  return "border-l-zinc-700";
}

// ─── Batched Event Card ───

function BatchedEventCard({
  batch,
  game,
  games,
  multiGame,
}: {
  batch: BatchedGameEvent;
  game?: GameDetail | null;
  games?: Map<string, GameDetail>;
  multiGame?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { trigger, relatedTriggers, affected } = batch;

  const isGoal =
    trigger.stat === "goal" ||
    trigger.stat === "goals";
  const isOwnGoal = trigger.stat === "own_goal";
  const isRed = trigger.stat === "red_card";

  const allAffected = [...relatedTriggers, ...affected];
  const totalDelta = [trigger, ...allAffected].reduce((sum, e) => sum + e.pointsDelta, 0);
  const assistEvent = relatedTriggers.find((rt) => rt.stat === "assist");

  // ── Compact 2-row card for goals ──
  if (isGoal || isOwnGoal) {
    return (
      <div className={cn(
        "border-b border-zinc-800/40 border-l-4 overflow-hidden animate-[goal-flash_0.6s_ease-out]",
        isGoal ? "border-l-green-500" : "border-l-red-500",
      )}>
        <style>{`
          @keyframes goal-flash {
            0% { background-color: rgba(${isGoal ? "34,197,94" : "239,68,68"}, 0.25); }
            100% { background-color: transparent; }
          }
        `}</style>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full text-left px-3 py-1.5",
            isGoal
              ? "bg-gradient-to-r from-green-500/10 to-transparent"
              : "bg-gradient-to-r from-red-500/10 to-transparent",
          )}
        >
          {/* Row 1: icon + label + player + delta */}
          <div className="flex items-center gap-2">
            <span className="text-base shrink-0">⚽</span>
            <span className={cn(
              "text-[11px] font-black tracking-wider shrink-0",
              isGoal ? "text-green-400" : "text-red-400",
            )}>
              {isGoal ? "GOAL!" : "OWN GOAL"}
            </span>
            <span className={cn("text-[11px] font-bold truncate", isGoal ? "text-green-200" : "text-red-200")}>
              {trigger.playerName.split(" ").pop()}
            </span>
            <span className="text-[9px] text-zinc-500 shrink-0">{trigger.teamCode}</span>
            {trigger.isOwned && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            <span className={cn("text-[11px] font-bold tabular-nums ml-auto shrink-0", isGoal ? "text-green-400" : "text-red-400")}>
              {trigger.pointsDelta > 0 ? "+" : ""}{trigger.pointsDelta}
            </span>
            <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{trigger.minute}&apos;</span>
            {affected.length > 0 && (
              <span className={cn("text-[10px] text-zinc-600 transition-transform shrink-0", expanded && "rotate-180")}>▾</span>
            )}
          </div>
          {/* Row 2: meta */}
          <div className="flex items-center gap-1.5 mt-0.5 pl-6">
            {multiGame && trigger.gameLabel && (
              <span className="text-[9px] text-zinc-500">{trigger.gameLabel}</span>
            )}
            {assistEvent && (
              <span className="text-[9px] text-zinc-400">
                👟 <span className="font-semibold text-zinc-300">{assistEvent.playerName.split(" ").pop()}</span>
                <span className={cn("tabular-nums ml-1", assistEvent.pointsDelta > 0 ? "text-green-400" : "text-red-400")}>
                  {assistEvent.pointsDelta > 0 ? "+" : ""}{assistEvent.pointsDelta}
                </span>
              </span>
            )}
            <span className="text-[9px] text-primary tabular-nums">{trigger.playerTotalScore} pts</span>
            {affected.length > 0 && (
              <span className="text-[9px] text-zinc-600 ml-auto">
                {affected.length} affected
              </span>
            )}
            <span className="text-[9px] text-zinc-700 tabular-nums">{formatTime(batch.timestamp)}</span>
          </div>
        </button>

        {/* Expanded: ripple effects */}
        {expanded && affected.length > 0 && (
          <div className="px-4 py-2 bg-zinc-900/50 space-y-0.5">
            {affected.map((ev) => {
              const { icon, label } = getStatLabel(ev.stat);
              return (
                <div key={`${ev.playerSlug}-${ev.stat}`} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs">{icon}</span>
                  <span className={cn("text-[11px] font-medium", ev.isOwned ? "text-primary" : "text-zinc-300")}>
                    {ev.playerName.split(" ").pop()}
                  </span>
                  <span className="text-[10px] text-zinc-500">{label}</span>
                  <span className={cn("text-[10px] font-bold tabular-nums ml-auto", ev.pointsDelta > 0 ? "text-green-400" : "text-red-400")}>
                    {ev.pointsDelta > 0 ? "+" : ""}{ev.pointsDelta}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Standard batched card for red cards / other triggers ──
  const { icon: triggerIcon } = getStatLabel(trigger.stat);
  const leftBorder = isRed ? "border-l-red-500" : "border-l-amber-500";
  const accentColor = isRed ? "from-red-500/10 to-transparent" : "from-amber-500/10 to-transparent";
  const textAccent = isRed ? "text-red-400" : "text-amber-400";

  return (
    <div className={cn("border-b border-zinc-800/40 border-l-4", leftBorder)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn("w-full text-left px-3 py-1.5 bg-gradient-to-r transition-colors hover:brightness-110", accentColor)}
      >
        {/* Row 1: icon + label + player + delta */}
        <div className="flex items-center gap-2">
          <span className="text-base shrink-0">{triggerIcon}</span>
          <span className={cn("text-[11px] font-black tracking-wider shrink-0", textAccent)}>
            {(isRed ? "RED CARD" : getStatLabel(trigger.stat).label.toUpperCase())}
          </span>
          <span className="text-[11px] font-bold text-white truncate">{trigger.playerName.split(" ").pop()}</span>
          <span className="text-[9px] text-zinc-500 shrink-0">{trigger.teamCode}</span>
          {trigger.isOwned && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
          <span className={cn("text-[11px] font-bold tabular-nums ml-auto shrink-0", trigger.pointsDelta > 0 ? "text-green-400" : "text-red-400")}>
            {trigger.pointsDelta > 0 ? "+" : ""}{trigger.pointsDelta}
          </span>
          <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{trigger.minute}&apos;</span>
          {allAffected.length > 0 && (
            <span className={cn("text-[10px] text-zinc-600 transition-transform shrink-0", expanded && "rotate-180")}>▾</span>
          )}
        </div>
        {/* Row 2: meta */}
        <div className="flex items-center gap-1.5 mt-0.5 pl-6">
          {multiGame && trigger.gameLabel && (
            <span className="text-[9px] text-zinc-500">{trigger.gameLabel}</span>
          )}
          <span className="text-[9px] text-primary tabular-nums">{trigger.playerTotalScore} pts</span>
          {allAffected.length > 0 && (
            <span className="text-[9px] text-zinc-600 ml-auto">{allAffected.length} affected</span>
          )}
          <span className="text-[9px] text-zinc-700 tabular-nums">{formatTime(batch.timestamp)}</span>
        </div>
      </button>

      {expanded && affected.length > 0 && (
        <div className="px-4 py-2 bg-zinc-900/50 space-y-0.5">
          {affected.map((ev) => {
            const { icon, label } = getStatLabel(ev.stat);
            return (
              <div key={`${ev.playerSlug}-${ev.stat}`} className="flex items-center gap-2 py-0.5">
                <span className="text-xs">{icon}</span>
                <span className={cn("text-[11px] font-medium", ev.isOwned ? "text-primary" : "text-zinc-300")}>{ev.playerName.split(" ").pop()}</span>
                <span className="text-[10px] text-zinc-500">{label}</span>
                <span className={cn("text-[10px] font-bold tabular-nums ml-auto", ev.pointsDelta > 0 ? "text-green-400" : "text-red-400")}>
                  {ev.pointsDelta > 0 ? "+" : ""}{ev.pointsDelta}
                </span>
              </div>
            );
          })}
          {totalDelta !== 0 && (
            <div className="flex items-center justify-end gap-1 pt-1 border-t border-zinc-800/50 mt-1">
              <span className="text-[10px] text-zinc-500">Net impact</span>
              <span className={cn("text-[11px] font-bold tabular-nums", totalDelta > 0 ? "text-green-400" : "text-red-400")}>
                {totalDelta > 0 ? "+" : ""}{Math.round(totalDelta * 10) / 10}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expandable Event Row ───

function ExpandableEventRow({
  ev, icon, label, isPositive, isNear, eventKey, reactions: eventReactions, onReact, game, games, multiGame,
}: {
  ev: GameEvent; icon: string; label: string; isPositive: boolean; isNear: boolean; eventKey: string;
  reactions: Record<string, number>; onReact: (k: string, e: string) => void;
  game?: GameDetail | null;
  games?: Map<string, GameDetail>;
  multiGame?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // Get player's full stats from game data
  const playerStats = useMemo(() => {
    const g = (games && ev.gameId ? games.get(ev.gameId) : game) ?? game;
    if (!g || !expanded) return [];
    const ps = g.playerGameScores.find((p) => p.anyPlayer.slug === ev.playerSlug);
    if (!ps) return [];
    return (ps.detailedScore ?? [])
      .filter((s) => s.totalScore !== 0 || s.statValue > 0)
      .sort((a, b) => Math.abs(b.totalScore) - Math.abs(a.totalScore));
  }, [game, games, expanded, ev.playerSlug, ev.gameId]);

  const isSub = ev.stat === "substitution" || ev.stat === "injury_sub";

  // Substitution events — special non-expandable row
  if (isSub) {
    const isSubIn = !!ev.subPlayerIn && !ev.subPlayerOut;
    const isSubOut = !!ev.subPlayerOut && !ev.subPlayerIn;
    const hasBoth = !!ev.subPlayerIn && !!ev.subPlayerOut;

    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/30 border-l-4",
        ev.isInjury ? "bg-amber-500/5 border-l-amber-500" : "bg-zinc-800/10 border-l-cyan-500",
      )}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0", ev.isInjury ? "bg-amber-500/15" : "bg-zinc-800")}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          {hasBoth ? (
            <p className="text-[11px] text-zinc-300">
              <span className="text-green-400 font-semibold">↑ {ev.subPlayerIn?.split(" ").pop()}</span>
              <span className="text-zinc-600 mx-1">for</span>
              <span className="text-red-400 font-semibold">↓ {ev.subPlayerOut?.split(" ").pop()}</span>
            </p>
          ) : isSubIn ? (
            <p className="text-[11px] text-zinc-300">
              <span className="text-green-400 font-semibold">↑ {ev.subPlayerIn?.split(" ").pop()}</span>
              <span className="text-zinc-600 ml-1">comes on</span>
            </p>
          ) : isSubOut ? (
            <p className="text-[11px] text-zinc-300">
              <span className="text-red-400 font-semibold">↓ {ev.subPlayerOut?.split(" ").pop()}</span>
              <span className="text-zinc-600 ml-1">subbed off</span>
            </p>
          ) : null}
          {ev.isInjury && <span className="text-amber-400 text-[10px]">(injury)</span>}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-primary font-semibold tabular-nums">{ev.playerTotalScore} pts</span>
            <span className="text-[9px] text-zinc-600">{ev.minute}&apos;</span>
            {multiGame && ev.gameLabel && (
              <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1 py-px rounded">{ev.gameLabel}</span>
            )}
          </div>
        </div>
        <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{formatTime(ev.timestamp)}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "border-b border-zinc-800/30 border-l-4",
      getEventBorder(ev, isNear),
      isNear && "bg-amber-500/5",
    )}>
      {/* Main row — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/20 transition-colors text-left",
          ev.isOwned && "bg-primary/[0.03]",
        )}
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0", isNear ? "bg-amber-500/15" : isPositive ? "bg-green-500/10" : "bg-red-500/10")}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[11px] font-bold", ev.isOwned ? "text-primary" : "text-white")}>{ev.playerName.split(" ").pop()}</span>
            {ev.isOwned && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            <span className="text-[10px] text-zinc-400 truncate">{label}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-px">
            <span className="text-[10px] text-primary font-semibold tabular-nums">{ev.playerTotalScore} pts</span>
            <span className="text-[9px] text-zinc-600">{ev.minute}&apos;</span>
            {multiGame && ev.gameLabel && (
              <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1 py-px rounded">{ev.gameLabel}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {!isNear && (
            <span className={cn("text-sm font-bold tabular-nums", isPositive ? "text-green-400" : "text-red-400")}>
              {isPositive ? "+" : ""}{ev.pointsDelta}
            </span>
          )}
          <span className="text-[9px] text-zinc-600 tabular-nums">{formatTime(ev.timestamp)}</span>
        </div>
        <span className={cn("text-[10px] text-zinc-600 transition-transform", expanded && "rotate-180")}>▾</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2.5 pl-[52px] space-y-2">
          {/* All emojis — quick react bar */}
          <div className="flex items-center gap-1 flex-wrap">
            {REACTION_EMOJIS.map((emoji) => {
              const count = eventReactions[emoji] ?? 0;
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(eventKey, emoji)}
                  className={cn(
                    "flex items-center gap-0.5 px-2 py-1 rounded-lg text-sm transition-all",
                    count > 0
                      ? "bg-zinc-700 border border-zinc-600"
                      : "bg-zinc-800/60 border border-zinc-800 hover:bg-zinc-700 hover:border-zinc-600",
                  )}
                >
                  {emoji}
                  {count > 0 && <span className="text-[10px] text-zinc-300 tabular-nums ml-0.5">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Player stats breakdown */}
          {playerStats.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Player Stats</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-px">
                {playerStats.map((s) => {
                  const { label: sLabel, icon: sIcon } = getStatLabel(s.stat);
                  return (
                    <div key={s.stat} className="flex items-center gap-1 text-[10px]">
                      <span className="text-[9px]">{sIcon}</span>
                      <span className="text-zinc-400 truncate flex-1">{sLabel}</span>
                      <span className="text-zinc-500 tabular-nums">{s.statValue}</span>
                      <span className={cn("tabular-nums font-semibold w-7 text-right", s.totalScore > 0 ? "text-green-400" : s.totalScore < 0 ? "text-red-400" : "text-zinc-600")}>
                        {s.totalScore > 0 ? "+" : ""}{Math.round(s.totalScore * 10) / 10}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Events Feed with Variant System ───

export function EventsFeed({
  events,
  variant = 1,
  game,
  games,
  multiGame,
}: {
  events: FeedItem[];
  variant?: number;
  game?: GameDetail | null;
  games?: Map<string, GameDetail>;
  multiGame?: boolean;
}) {
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const react = (key: string, emoji: string) => {
    setReactions((p) => {
      const r = { ...(p[key] ?? {}) };
      r[emoji] = (r[emoji] ?? 0) + 1;
      return { ...p, [key]: r };
    });
    setOpenPicker(null);
  };

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
        <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground text-center">Live actions will appear here</p>
      </div>
    );
  }

  const Picker = ({ eventKey }: { eventKey: string }) => (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpenPicker(openPicker === eventKey ? null : eventKey)}
        className="text-muted-foreground/40 hover:text-muted-foreground text-[11px] transition-colors"
      >
        😀
      </button>
      {openPicker === eventKey && (
        <div className="absolute bottom-full right-0 mb-1 flex gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg px-1 py-0.5 z-20 shadow-xl">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} onClick={() => react(eventKey, e)} className="w-7 h-7 rounded hover:bg-zinc-700 flex items-center justify-center text-sm">{e}</button>
          ))}
        </div>
      )}
    </div>
  );

  const Reactions = ({ eventKey }: { eventKey: string }) => {
    const r = reactions[eventKey] ?? {};
    if (Object.keys(r).length === 0) return null;
    return (
      <div className="flex gap-0.5">
        {Object.entries(r).map(([emoji, count]) => (
          <button key={emoji} onClick={() => react(eventKey, emoji)} className="flex items-center gap-px px-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[9px] transition-colors">
            {emoji}<span className="text-zinc-500">{count}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {events.map((item, i) => {
        // ── Batched impact card ──
        if (isBatchedEvent(item)) {
          return <BatchedEventCard key={item.id} batch={item} game={game} games={games} multiGame={multiGame} />;
        }

        const ev = item;
        const { label, icon } = getStatLabel(ev.stat);
        const isPositive = ev.pointsDelta > 0;
        const isNear = ev.stat.startsWith("near_");
        const k = `${ev.playerSlug}-${ev.stat}-${ev.timestamp}-${i}`;

        /* ── Variant A: Two-line card ── */
        if (variant === 1) return (
          <div key={k} className={cn("group px-3 py-1.5 border-b border-zinc-800/40", isNear && "bg-amber-500/5")}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{icon}</span>
              <span className="text-[11px] font-bold text-white">{ev.playerName.split(" ").pop()}</span>
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="text-[10px] text-zinc-500 tabular-nums ml-auto">{ev.minute}&apos;</span>
              {!isNear && <span className={cn("text-[11px] font-bold tabular-nums", isPositive ? "text-green-400" : "text-red-400")}>{isPositive ? "+" : ""}{ev.pointsDelta}</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 pl-7">
              <span className="text-[10px] text-primary font-semibold tabular-nums">{ev.playerTotalScore} pts</span>
              {multiGame && ev.gameLabel && <span className="text-[9px] text-zinc-500">{ev.gameLabel}</span>}
              <Reactions eventKey={k} />
              <Picker eventKey={k} />
            </div>
          </div>
        );

        /* ── Variant B: Compact pill style ── */
        if (variant === 2) return (
          <div key={k} className={cn("flex items-center gap-1.5 px-2 py-1 mx-1 my-0.5 rounded-lg", isNear ? "bg-amber-500/10 border border-amber-500/20" : "hover:bg-zinc-800/50")}>
            <span className="text-xs">{icon}</span>
            <span className="text-[10px] text-zinc-500 tabular-nums w-6">{ev.minute}&apos;</span>
            <span className="text-[11px] font-semibold text-white truncate">{ev.playerName.split(" ").pop()}</span>
            <span className="text-[10px] font-bold text-primary tabular-nums">{ev.playerTotalScore}</span>
            <span className="text-[10px] text-zinc-500 truncate flex-1">{label}</span>
            <Reactions eventKey={k} />
            <Picker eventKey={k} />
            {!isNear && <span className={cn("text-[10px] font-bold tabular-nums min-w-[32px] text-right", isPositive ? "text-green-400" : "text-red-400")}>{isPositive ? "+" : ""}{ev.pointsDelta}</span>}
          </div>
        );

        /* ── Variant C: Discord-like with left accent ── */
        if (variant === 3) return (
          <div key={k} className={cn("flex items-start gap-2 px-3 py-1.5 border-l-2", isNear ? "border-amber-500 bg-amber-500/5" : isPositive ? "border-green-500/50" : "border-red-500/50", "hover:bg-zinc-800/30")}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{icon}</span>
                <span className="text-[11px] font-bold text-white">{ev.playerName.split(" ").pop()}</span>
                {!isNear && <span className={cn("text-[11px] font-bold tabular-nums", isPositive ? "text-green-400" : "text-red-400")}>{isPositive ? "+" : ""}{ev.pointsDelta}</span>}
                <span className="text-[10px] text-zinc-600 ml-auto tabular-nums">{ev.minute}&apos;</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-zinc-400">{label}</span>
                <span className="text-[9px] text-primary tabular-nums">({ev.playerTotalScore} pts)</span>
                {multiGame && ev.gameLabel && <span className="text-[9px] text-zinc-500">{ev.gameLabel}</span>}
                <Reactions eventKey={k} />
                <Picker eventKey={k} />
              </div>
            </div>
          </div>
        );

        /* ── Variant D: Notification style with icon box ── */
        if (variant === 4) return (
          <div key={k} className={cn("flex items-center gap-2.5 px-3 py-2 border-b border-zinc-800/30", isNear && "bg-amber-500/5")}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0", isNear ? "bg-amber-500/15" : isPositive ? "bg-green-500/10" : "bg-red-500/10")}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white"><span className="font-bold">{ev.playerName.split(" ").pop()}</span> — <span className="text-zinc-400">{label}</span></p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-primary font-semibold tabular-nums">{ev.playerTotalScore} pts</span>
                <span className="text-[9px] text-zinc-600">{ev.minute}&apos;</span>
                {multiGame && ev.gameLabel && <span className="text-[9px] text-zinc-500">{ev.gameLabel}</span>}
                <Reactions eventKey={k} />
                <Picker eventKey={k} />
              </div>
            </div>
            {!isNear && <span className={cn("text-sm font-bold tabular-nums shrink-0", isPositive ? "text-green-400" : "text-red-400")}>{isPositive ? "+" : ""}{ev.pointsDelta}</span>}
          </div>
        );

        /* ── Variant E: Minimal ticker ── */
        if (variant === 5) return (
          <div key={k} className={cn("flex items-center px-3 py-[6px] border-b border-zinc-800/20 hover:bg-zinc-800/20", isNear && "bg-amber-500/5")}>
            <span className="text-[10px] text-zinc-600 tabular-nums w-7 shrink-0">{ev.minute}&apos;</span>
            <span className="text-xs mr-1.5">{icon}</span>
            <span className="text-[11px] font-semibold text-white mr-1">{ev.playerName.split(" ").pop()}</span>
            <span className="text-[10px] text-zinc-500 truncate">{label}</span>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <span className="text-[9px] text-primary tabular-nums font-semibold">{ev.playerTotalScore}</span>
              <Reactions eventKey={k} />
              <Picker eventKey={k} />
              {!isNear && <span className={cn("text-[11px] font-bold tabular-nums w-8 text-right", isPositive ? "text-green-400" : "text-red-400")}>{isPositive ? "+" : ""}{ev.pointsDelta}</span>}
            </div>
          </div>
        );

        /* ── Variant F: Icon box + delta pill integrated ── */
        if (variant === 6) return (
          <div key={k} className={cn("flex items-center gap-2 px-3 py-1.5 border-l-2 hover:bg-zinc-800/20", isNear ? "border-amber-500 bg-amber-500/5" : isPositive ? "border-green-500/40" : "border-red-500/40")}>
            {/* Icon with delta badge overlaid */}
            <div className="relative shrink-0">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base", isNear ? "bg-amber-500/15" : isPositive ? "bg-green-500/10" : "bg-red-500/10")}>
                {icon}
              </div>
              {!isNear && (
                <span className={cn("absolute -top-1 -right-2 text-[9px] font-bold tabular-nums px-1 rounded-full", isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                  {isPositive ? "+" : ""}{ev.pointsDelta}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-white">{ev.playerName.split(" ").pop()}</span>
                <span className="text-[10px] text-zinc-400">{label}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-primary font-semibold tabular-nums">{ev.playerTotalScore} pts</span>
                <span className="text-[9px] text-zinc-600 tabular-nums">{ev.minute}&apos;</span>
                {multiGame && ev.gameLabel && <span className="text-[9px] text-zinc-500">{ev.gameLabel}</span>}
                <Reactions eventKey={k} />
                <Picker eventKey={k} />
              </div>
            </div>
          </div>
        );

        /* ── Variant G: Pill delta next to name, compact ── */
        if (variant === 7) return (
          <div key={k} className={cn("px-3 py-1.5 border-b border-zinc-800/30 hover:bg-zinc-800/20", isNear && "bg-amber-500/5")}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{icon}</span>
              <span className="text-[11px] font-bold text-white">{ev.playerName.split(" ").pop()}</span>
              {!isNear && (
                <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-px rounded-full", isPositive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                  {isPositive ? "+" : ""}{ev.pointsDelta}
                </span>
              )}
              <span className="text-[10px] text-zinc-500">{label}</span>
              <span className="text-[10px] text-primary font-semibold tabular-nums ml-auto">{ev.playerTotalScore}</span>
              <span className="text-[9px] text-zinc-600 tabular-nums">{ev.minute}&apos;</span>
            </div>
            <div className="flex items-center gap-1 mt-1 pl-6">
              {multiGame && ev.gameLabel && <span className="text-[9px] text-zinc-500">{ev.gameLabel}</span>}
              <Reactions eventKey={k} />
              <Picker eventKey={k} />
            </div>
          </div>
        );

        /* ── Variant H: Expandable — click to reveal details ── */
        return <ExpandableEventRow key={k} ev={ev} icon={icon} label={label} isPositive={isPositive} isNear={isNear} eventKey={k} reactions={reactions[k] ?? {}} onReact={react} game={game} games={games} multiGame={multiGame} />;
      })}
    </div>
  );
}
