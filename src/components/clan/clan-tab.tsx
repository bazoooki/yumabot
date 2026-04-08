"use client";

import { Users, Loader2, RefreshCw, Check, X } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { useClanPortfolios } from "@/lib/clan/use-clan-portfolios";
import type { MemberLoadState } from "@/lib/clan/use-clan-portfolios";
import { CommandBar } from "@/components/command-bar/command-bar";
import { ClanMessageBoard } from "./clan-message-board";
import { cn } from "@/lib/utils";
import type { SorareCard } from "@/lib/types";

function MemberAvatar({
  member,
  state,
  isYou,
}: {
  member: (typeof CLAN_MEMBERS)[number];
  state: MemberLoadState;
  isYou: boolean;
}) {
  return (
    <div className="relative" title={`${member.name}${state.cardCount ? ` — ${state.cardCount} cards` : ""}`}>
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm transition-all duration-300",
          isYou
            ? "bg-violet-500/30 text-violet-300 border-violet-500/40"
            : state.status === "loaded"
              ? "bg-secondary/80 text-foreground border-green-500/40"
              : state.status === "error"
                ? "bg-red-500/10 text-red-400 border-red-500/40"
                : "bg-secondary/30 text-muted-foreground/50 border-background",
        )}
      >
        {state.status === "loading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : state.status === "error" ? (
          <X className="w-4 h-4" />
        ) : (
          member.name.slice(0, 2).toUpperCase()
        )}
      </div>
      {state.status === "loaded" && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center border border-background">
          <Check className="w-2 h-2 text-white" />
        </div>
      )}
    </div>
  );
}

function LoadingProgress({ memberStates }: { memberStates: MemberLoadState[] }) {
  const loaded = memberStates.filter((s) => s.status === "loaded").length;
  const total = memberStates.length;
  const pct = (loaded / total) * 100;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-foreground">Loading Clan Portfolios</h3>
        <p className="text-sm text-muted-foreground">
          Fetching cards for all {total} members
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="h-1.5 bg-secondary/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {loaded} / {total} loaded
        </p>
      </div>

      {/* Per-member status */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {memberStates.map((s) => (
          <div
            key={s.slug}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
              s.status === "loaded"
                ? "bg-green-500/5 border border-green-500/20"
                : s.status === "loading"
                  ? "bg-secondary/20 border border-border/30"
                  : s.status === "error"
                    ? "bg-red-500/5 border border-red-500/20"
                    : "bg-secondary/10 border border-transparent",
            )}
          >
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                s.status === "loaded"
                  ? "bg-green-500/15 text-green-400"
                  : s.status === "loading"
                    ? "bg-secondary/40 text-muted-foreground"
                    : s.status === "error"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-secondary/20 text-muted-foreground/50",
              )}
            >
              {s.status === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : s.status === "loaded" ? (
                <Check className="w-3.5 h-3.5" />
              ) : s.status === "error" ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                s.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                s.status === "loaded" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.name}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {s.status === "loaded" && s.cardCount
                ? `${s.cardCount} cards`
                : s.status === "loading"
                  ? "Fetching..."
                  : s.status === "error"
                    ? "Failed"
                    : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClanTab({ cards, userSlug }: { cards: SorareCard[]; userSlug: string }) {
  const { data: portfolios, isLoading, error, memberStates, refresh } = useClanPortfolios(userSlug);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-violet-400" />
          <h2 className="text-base font-bold text-foreground">My Clan</h2>
        </div>

        {/* Member avatars with live status */}
        <div className="flex -space-x-1.5">
          {CLAN_MEMBERS.map((m) => {
            const state = memberStates.find((s) => s.slug === m.slug) ?? {
              slug: m.slug,
              name: m.name,
              status: "pending" as const,
            };
            return (
              <MemberAvatar
                key={m.slug}
                member={m}
                state={state}
                isYou={m.slug === userSlug}
              />
            );
          })}
        </div>

        <span className="text-sm text-muted-foreground">
          {CLAN_MEMBERS.length} members
        </span>

        {isLoading && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {memberStates.filter((s) => s.status === "loaded").length}/{memberStates.length} loaded
          </span>
        )}
        {error && (
          <span className="ml-auto text-xs text-red-400">
            Failed to load clan data
          </span>
        )}
        {portfolios && !isLoading && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-green-400/70">
              All portfolios loaded
            </span>
            <button
              onClick={refresh}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh all portfolios"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main content: AI + Message Board */}
      <div className="flex flex-1 overflow-hidden">
        {/* AI Assistant (main area) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CommandBar activeTab="clan" cards={cards} />

          {/* Suggestions when loaded */}
          {portfolios && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-foreground">Clan AI Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ask me anything about your clan&apos;s cards. I can find trade opportunities,
                  analyze lineups, and help coordinate across all {CLAN_MEMBERS.length} members.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  "I need a FWD limited for Challenger",
                  "Who has surplus rare midfielders?",
                  "Show me Nimrodel's limited cards",
                  "Find best GK trade for me",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="text-left px-4 py-3 rounded-xl bg-secondary/20 border border-border/30 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 hover:border-violet-500/20 transition-all"
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading progress */}
          {isLoading && <LoadingProgress memberStates={memberStates} />}
        </div>

        {/* Message Board sidebar */}
        <div className="w-[380px] overflow-hidden shrink-0">
          <ClanMessageBoard userSlug={userSlug} />
        </div>
      </div>
    </div>
  );
}
