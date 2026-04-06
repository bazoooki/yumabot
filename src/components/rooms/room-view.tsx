"use client";

import { useState } from "react";
import { ArrowLeft, Copy, Check, Users, Trophy, Clock, Timer, Zap, Target, TrendingUp, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentaryFeed } from "./commentary-feed";
import { RoomLineupBuilder } from "./room-lineup-builder";
import { Reactions } from "./reactions";
import type { PlayerScoreData } from "@/lib/rooms/types";
import { STREAK_REWARDS } from "@/lib/rooms/types";
import type { SorareCard, FixtureGame } from "@/lib/types";
import { useRoomData } from "@/lib/hooks/use-room-data";
import { useCountdown } from "@/lib/hooks/use-countdown";

interface RoomViewProps {
  roomId: string;
  userSlug: string;
  cards: SorareCard[];
  onBack: () => void;
}

export function RoomView({ roomId, userSlug, cards, onBack }: RoomViewProps) {
  const { data, loading, polling, refetch: fetchRoom } = useRoomData(roomId);
  const [copied, setCopied] = useState(false);

  const games = ((data?.room as { games?: FixtureGame[] })?.games || []) as FixtureGame[];
  const earliestKickoff = games.length > 0
    ? games.reduce((earliest, g) => g.date < earliest ? g.date : earliest, games[0].date)
    : null;
  const countdown = useCountdown(earliestKickoff);

  async function copyInviteCode() {
    if (!data?.room) return;
    await navigator.clipboard.writeText(data.room.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading room...</p>
        </div>
      </div>
    );
  }

  if (!data?.room) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">Room not found</p>
          <p className="text-sm text-muted-foreground mt-1">This room may have been deleted or moved</p>
        </div>
      </div>
    );
  }

  const { room, participants, lineups, scores } = data;

  const myParticipant = participants.find((p) => p.user_slug === userSlug);
  const myLineup = myParticipant ? lineups.find((l) => l.participant_id === myParticipant.id) : null;

  const leaderboard = participants
    .map((p) => {
      const score = scores.find((s) => s.participant_id === p.id);
      const lineup = lineups.find((l) => l.participant_id === p.id);
      return {
        participant: p,
        lineup,
        totalScore: score?.total_score || 0,
        projectedScore: score?.projected_score || 0,
        scoresJson: (score?.scores_json || {}) as Record<string, PlayerScoreData>,
        targetScore: lineup?.target_score || 280,
        currentLevel: lineup?.current_level || 1,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-screen bg-background">
      {/* Premium Room Header */}
      <header className="relative border-b border-border/50 bg-card/50 backdrop-blur-xl">
        {/* Subtle gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-foreground tracking-tight">{room.name}</h1>
              {polling && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-medium text-primary">Syncing</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {games.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/50">
                  {g.homeTeam.pictureUrl && <img src={g.homeTeam.pictureUrl} alt="" className="w-3.5 h-3.5 rounded-full" />}
                  <span className="text-[10px] font-medium text-muted-foreground">{g.homeTeam.code}</span>
                  <span className="text-[10px] text-muted-foreground/50">vs</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{g.awayTeam.code}</span>
                  {g.awayTeam.pictureUrl && <img src={g.awayTeam.pictureUrl} alt="" className="w-3.5 h-3.5 rounded-full" />}
                </div>
              ))}
              {games.length > 6 && (
                <span className="text-[10px] text-muted-foreground">+{games.length - 6} more</span>
              )}
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-3">
            {/* Countdown */}
            {countdown && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300",
                countdown === "LIVE"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              )}>
                {countdown === "LIVE" ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                    </span>
                    <span>LIVE</span>
                  </>
                ) : (
                  <>
                    <Timer className="w-4 h-4" />
                    <span>{countdown}</span>
                  </>
                )}
              </div>
            )}

            {/* Invite Code */}
            <button
              onClick={copyInviteCode}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 hover:bg-secondary border border-border/50 text-sm font-mono transition-all duration-200 group"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              )}
              <span className="text-foreground">{room.invite_code}</span>
            </button>

            {/* Participants */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 border border-border/50">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{participants.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {!myLineup ? (
        /* PRE-MATCH: Lineup builder + sidebar */
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <RoomLineupBuilder
              cards={cards}
              games={games}
              roomId={roomId}
              userSlug={userSlug}
              onSubmitted={fetchRoom}
            />
          </div>

          {/* Right sidebar */}
          <aside className="w-[320px] border-l border-border/50 overflow-y-auto bg-card/30 shrink-0">
            <div className="p-4 space-y-4">
              {/* Managers Card */}
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Managers</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{participants.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {participants.map((p) => {
                    const hasLineup = lineups.some((l) => l.participant_id === p.id);
                    const isMe = p.user_slug === userSlug;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                          isMe ? "bg-primary/10 border border-primary/20" : "bg-secondary/30 hover:bg-secondary/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                        )}>
                          {p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span className={cn(
                          "text-sm font-medium flex-1",
                          isMe ? "text-primary" : "text-foreground"
                        )}>
                          {p.display_name}
                          {isMe && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                        </span>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                          hasLineup
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            hasLineup ? "bg-green-400" : "bg-amber-400 animate-pulse"
                          )} />
                          {hasLineup ? "Ready" : "Building"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Games Card */}
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Fixtures</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{games.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {games.map((g) => {
                    const time = new Date(g.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                    return (
                      <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-1.5 flex-1">
                          {g.homeTeam.pictureUrl && <img src={g.homeTeam.pictureUrl} alt="" className="w-5 h-5 rounded-full" />}
                          <span className="text-xs font-medium text-foreground">{g.homeTeam.code}</span>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground px-2 py-0.5 rounded bg-background/50">VS</span>
                        <div className="flex items-center gap-1.5 flex-1 justify-end">
                          <span className="text-xs font-medium text-foreground">{g.awayTeam.code}</span>
                          {g.awayTeam.pictureUrl && <img src={g.awayTeam.pictureUrl} alt="" className="w-5 h-5 rounded-full" />}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground ml-2">{time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Invite Card */}
              <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Invite Friends</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono font-bold text-primary bg-background/50 px-4 py-2 rounded-xl text-center border border-primary/20">
                    {room.invite_code}
                  </code>
                  <button
                    onClick={copyInviteCode}
                    className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chat Preview */}
              <div className="rounded-2xl bg-card border border-border/50 overflow-hidden flex-1" style={{ minHeight: 240 }}>
                <CommentaryFeed roomId={roomId} userSlug={userSlug} />
              </div>
            </div>
          </aside>
        </div>
      ) : (
        /* POST LOCK-IN: Live view */
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[65%] overflow-y-auto p-6 space-y-6">
            {/* Leaderboard */}
            <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Room Standings</h2>
                  <p className="text-xs text-muted-foreground">Live score tracking</p>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {leaderboard.map((entry, i) => {
                  const distance = entry.targetScore - entry.totalScore;
                  const projDistance = entry.targetScore - entry.projectedScore;
                  const status = distance <= 0 ? "on_track" : projDistance <= 0 ? "at_risk" : "unlikely";
                  const isMe = entry.participant.user_slug === userSlug;
                  const progress = Math.min(100, (entry.totalScore / entry.targetScore) * 100);

                  return (
                    <div
                      key={entry.participant.id}
                      className={cn(
                        "relative rounded-xl p-4 transition-all duration-300",
                        isMe
                          ? "bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.1)]"
                          : "bg-secondary/30 border border-border/50 hover:border-border"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black",
                          i === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" :
                          i === 1 ? "bg-gradient-to-br from-zinc-300 to-zinc-500 text-black" :
                          i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-black" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {i + 1}
                        </div>

                        {/* Player Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              "text-sm font-bold",
                              isMe ? "text-primary" : "text-foreground"
                            )}>
                              {entry.participant.display_name}
                            </span>
                            {isMe && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-[10px] font-bold text-primary uppercase">You</span>
                            )}
                            <span className="text-xs text-muted-foreground font-medium">
                              L{entry.currentLevel} • {STREAK_REWARDS[entry.currentLevel] || "?"}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-1000 ease-out",
                                status === "on_track" ? "bg-gradient-to-r from-green-500 to-emerald-400" :
                                status === "at_risk" ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                                "bg-gradient-to-r from-red-500 to-rose-400"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer" />
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-foreground tabular-nums">{entry.totalScore.toFixed(0)}</span>
                            <span className="text-sm text-muted-foreground font-medium">/ {entry.targetScore}</span>
                          </div>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1",
                            status === "on_track" ? "bg-green-500/10 text-green-400" :
                            status === "at_risk" ? "bg-amber-500/10 text-amber-400" :
                            "bg-red-500/10 text-red-400"
                          )}>
                            {distance <= 0 ? (
                              <>
                                <Target className="w-3 h-3" />
                                Hit!
                              </>
                            ) : (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                {distance.toFixed(0)} away
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lineups */}
            {leaderboard.map((entry) => {
              const slots = (entry.lineup?.slots || []) as { playerSlug: string | null; playerName: string | null; position: string; pictureUrl?: string }[];
              const captainIdx = entry.lineup?.captain_index ?? -1;
              const isMe = entry.participant.user_slug === userSlug;

              return (
                <div
                  key={entry.participant.id}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-all duration-300",
                    isMe
                      ? "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-[0_0_40px_rgba(var(--primary),0.08)]"
                      : "border-border/50 bg-card"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-3 px-5 py-3 border-b",
                    isMe ? "border-primary/20 bg-primary/5" : "border-border/50 bg-secondary/20"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}>
                      {entry.participant.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className={cn("text-sm font-bold", isMe ? "text-primary" : "text-foreground")}>
                      {entry.participant.display_name}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground ml-auto tabular-nums">
                      {entry.totalScore.toFixed(0)} pts
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-5 gap-3">
                      {slots.map((slot, i) => {
                        const ps = slot.playerSlug ? entry.scoresJson[slot.playerSlug] : null;
                        const isCaptain = i === captainIdx;
                        const mult = isCaptain ? 1.5 : 1;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "relative flex flex-col items-center p-3 rounded-xl transition-all duration-200",
                              isCaptain
                                ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20"
                                : "bg-secondary/30 border border-border/50 hover:border-border"
                            )}
                          >
                            {isCaptain && (
                              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                <Crown className="w-3.5 h-3.5 text-black" />
                              </div>
                            )}
                            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              {slot.position}
                            </span>
                            {slot.pictureUrl && (
                              <img src={slot.pictureUrl} alt="" className="w-14 h-20 object-contain my-1 drop-shadow-lg" />
                            )}
                            <span className="text-[11px] font-semibold text-foreground truncate w-full text-center">
                              {slot.playerName || "—"}
                            </span>
                            {ps && (
                              <span className={cn(
                                "text-sm font-black tabular-nums mt-1",
                                (ps.score * mult) >= 50 ? "text-green-400" :
                                (ps.score * mult) >= 30 ? "text-foreground" :
                                "text-muted-foreground"
                              )}>
                                {(ps.score * mult).toFixed(0)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Commentary + reactions */}
          <div className="w-[35%] overflow-hidden flex flex-col border-l border-border/50 bg-card/30">
            <div className="flex-1 overflow-hidden">
              <CommentaryFeed roomId={roomId} userSlug={userSlug} />
            </div>
            <Reactions roomId={roomId} userSlug={userSlug} />
          </div>
        </div>
      )}
    </div>
  );
}
