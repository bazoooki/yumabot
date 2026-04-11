"use client";

import { useState, useMemo } from "react";
import { Zap } from "lucide-react";
import { getStatLabel } from "@/lib/game-events";
import { cn } from "@/lib/utils";
import type { GameDetail, GameEvent, FeedItem, BatchedGameEvent } from "@/lib/types";
import { isBatchedEvent } from "@/lib/types";

const REACTION_EMOJIS = ["🔥", "👏", "😤", "💪", "😩", "🫡"];

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
  const { icon: triggerIcon } = getStatLabel(trigger.stat);

  const isGoal =
    trigger.stat === "goal" ||
    trigger.stat === "goals" ||
    trigger.stat === "own_goal";
  const isRed = trigger.stat === "red_card";

  const accentColor = isGoal
    ? "from-green-500/20 via-green-500/5"
    : isRed
      ? "from-red-500/20 via-red-500/5"
      : "from-amber-500/20 via-amber-500/5";
  const borderColor = isGoal
    ? "border-green-500/30"
    : isRed
      ? "border-red-500/30"
      : "border-amber-500/30";
  const textAccent = isGoal
    ? "text-green-400"
    : isRed
      ? "text-red-400"
      : "text-amber-400";

  // Total affected players count
  const allAffected = [...relatedTriggers, ...affected];
  const totalDelta = allAffected.reduce((sum, e) => sum + e.pointsDelta, 0);

  return (
    <div className={cn("border-b-2", borderColor)}>
      {/* Headline — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full text-left px-4 py-3 bg-gradient-to-r to-transparent transition-colors hover:brightness-110",
          accentColor,
        )}
      >
        <div className="flex items-center gap-3">
          {/* Big icon */}
          <div className="text-2xl shrink-0">{triggerIcon}</div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {isGoal ? "GOAL" : isRed ? "RED CARD" : getStatLabel(trigger.stat).label.toUpperCase()}
              </span>
              <span className="text-xs text-zinc-400">{trigger.minute}&apos;</span>
              {multiGame && trigger.gameLabel && (
                <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                  {trigger.gameLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("text-sm font-semibold", textAccent)}>
                {trigger.playerName}
              </span>
              <span className="text-[10px] text-zinc-500">
                {trigger.teamCode}
              </span>
              {trigger.isOwned && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
              <span className={cn(
                "text-xs font-bold tabular-nums",
                trigger.pointsDelta > 0 ? "text-green-400" : "text-red-400",
              )}>
                {trigger.pointsDelta > 0 ? "+" : ""}{trigger.pointsDelta}
              </span>
            </div>
          </div>

          {/* Summary badge */}
          <div className="shrink-0 text-right">
            {allAffected.length > 0 && (
              <span className="text-[10px] text-zinc-500">
                {allAffected.length} player{allAffected.length !== 1 ? "s" : ""} affected
              </span>
            )}
            <span className={cn(
              "text-[10px] text-zinc-600 block transition-transform",
              expanded && "rotate-180",
            )}>
              ▾
            </span>
          </div>
        </div>

        {/* Related triggers inline (e.g. assist) */}
        {relatedTriggers.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5 ml-9">
            {relatedTriggers.map((rt) => {
              const { icon: rtIcon } = getStatLabel(rt.stat);
              return (
                <span
                  key={`${rt.playerSlug}-${rt.stat}`}
                  className="flex items-center gap-1 text-[11px] text-zinc-300"
                >
                  <span>{rtIcon}</span>
                  <span className="font-semibold">{rt.playerName.split(" ").pop()}</span>
                  <span className={cn(
                    "font-bold tabular-nums",
                    rt.pointsDelta > 0 ? "text-green-400" : "text-red-400",
                  )}>
                    {rt.pointsDelta > 0 ? "+" : ""}{rt.pointsDelta}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </button>

      {/* Expanded: affected players */}
      {expanded && affected.length > 0 && (
        <div className="px-4 py-2 bg-zinc-900/50 space-y-0.5">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            Affected Players
          </p>
          {affected.map((ev) => {
            const { icon, label } = getStatLabel(ev.stat);
            return (
              <div
                key={`${ev.playerSlug}-${ev.stat}`}
                className="flex items-center gap-2 py-0.5"
              >
                <span className="text-xs">{icon}</span>
                <span className={cn(
                  "text-[11px] font-medium",
                  ev.isOwned ? "text-primary" : "text-zinc-300",
                )}>
                  {ev.playerName.split(" ").pop()}
                </span>
                <span className="text-[10px] text-zinc-500">{label}</span>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums ml-auto",
                  ev.pointsDelta > 0 ? "text-green-400" : "text-red-400",
                )}>
                  {ev.pointsDelta > 0 ? "+" : ""}{ev.pointsDelta}
                </span>
                <span className="text-[9px] text-zinc-600 tabular-nums">
                  {ev.playerTotalScore} pts
                </span>
              </div>
            );
          })}
          {totalDelta !== 0 && (
            <div className="flex items-center justify-end gap-1 pt-1 border-t border-zinc-800/50 mt-1">
              <span className="text-[10px] text-zinc-500">Net impact</span>
              <span className={cn(
                "text-[11px] font-bold tabular-nums",
                totalDelta > 0 ? "text-green-400" : "text-red-400",
              )}>
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
        "flex items-center gap-2 px-3 py-2 border-b border-zinc-800/30",
        ev.isInjury ? "bg-amber-500/5" : "bg-zinc-800/10",
        ev.isOwned && "border-l-2 border-l-primary/50",
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
      </div>
    );
  }

  return (
    <div className={cn(
      "border-b border-zinc-800/30",
      isNear && "bg-amber-500/5",
      ev.isOwned && !isNear && "border-l-2 border-l-primary/50",
    )}>
      {/* Main row — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/20 transition-colors text-left",
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
        {!isNear && (
          <span className={cn("text-sm font-bold tabular-nums shrink-0", isPositive ? "text-green-400" : "text-red-400")}>
            {isPositive ? "+" : ""}{ev.pointsDelta}
          </span>
        )}
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
