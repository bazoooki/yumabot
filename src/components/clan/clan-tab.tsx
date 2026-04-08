"use client";

import { Users, Loader2 } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import { useClanPortfolios } from "@/lib/clan/use-clan-portfolios";
import { CommandBar } from "@/components/command-bar/command-bar";
import { ClanChat } from "./clan-chat";
import type { SorareCard } from "@/lib/types";

export function ClanTab({ cards, userSlug }: { cards: SorareCard[]; userSlug: string }) {
  const { data: portfolios, isLoading, error } = useClanPortfolios(userSlug);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold text-foreground">My Clan</h2>
        </div>

        {/* Member avatars */}
        <div className="flex -space-x-2">
          {CLAN_MEMBERS.map((m) => (
            <div
              key={m.slug}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-background ${
                m.slug === userSlug
                  ? "bg-violet-500/30 text-violet-300"
                  : "bg-secondary/50 text-muted-foreground"
              }`}
              title={m.name}
            >
              {m.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">
          {CLAN_MEMBERS.length} members
        </span>

        {isLoading && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading portfolios...
          </span>
        )}
        {error && (
          <span className="ml-auto text-xs text-red-400">
            Failed to load clan data
          </span>
        )}
        {portfolios && !isLoading && (
          <span className="ml-auto text-xs text-green-400/70">
            All portfolios loaded
          </span>
        )}
      </div>

      {/* Main content: AI + Chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* AI Assistant (main area) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CommandBar activeTab="clan" cards={cards} />

          {/* Suggestions when no conversation */}
          {portfolios && (
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
                  "I need a DEF in-season for rare Challenger",
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

          {!portfolios && isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading all clan portfolios...</p>
              <p className="text-xs text-muted-foreground/60">
                First load fetches all members&apos; cards from Sorare
              </p>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div className="w-[280px] overflow-hidden shrink-0">
          <ClanChat userSlug={userSlug} />
        </div>
      </div>
    </div>
  );
}
