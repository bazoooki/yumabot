"use client";

import { useState } from "react";
import { ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITION_SHORT } from "@/lib/ui-config";
import { RARITY_CONFIG } from "@/lib/types";
import type { SorareCard } from "@/lib/types";
import { GridCard } from "@/components/lineup-builder/grid-card";

const CARDS_PREVIEW_COUNT = 6;

interface MemberCards {
  name: string;
  slug: string;
  isYou: boolean;
  cards: SorareCard[];
}

interface TradeAnalysis {
  type: "clan_trade_analysis";
  position: string;
  rarity: string;
  inSeasonOnly: boolean;
  surplus: Array<{
    name: string;
    slug: string;
    isYou: boolean;
    cardCount: number;
    cards: SorareCard[];
  }>;
  needy: Array<{
    name: string;
    slug: string;
    isYou: boolean;
    totalOfRarity: number;
  }>;
  tight: Array<{
    name: string;
    slug: string;
    isYou: boolean;
    card: { playerName: string; averageScore: number } | null;
  }>;
}

interface CardSearch {
  type: "clan_card_search";
  totalFound: number;
  members: MemberCards[];
}

function CardGrid({ cards }: { cards: SorareCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,130px)] gap-2">
      {cards.map((card, i) => (
        <GridCard key={`${card.slug}-${i}`} card={card} />
      ))}
    </div>
  );
}

function MemberSection({ member }: { member: MemberCards }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = member.cards.length > CARDS_PREVIEW_COUNT;
  const visibleCards = expanded ? member.cards : member.cards.slice(0, CARDS_PREVIEW_COUNT);
  const hiddenCount = member.cards.length - CARDS_PREVIEW_COUNT;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
            member.isYou
              ? "bg-violet-500/30 text-violet-300"
              : "bg-zinc-700 text-zinc-400",
          )}
        >
          {member.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[11px] font-semibold text-zinc-300">
          {member.name}
          {member.isYou && <span className="text-violet-400 ml-1">(You)</span>}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {member.cards.length} card{member.cards.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="ml-8">
        <CardGrid cards={visibleCards} />
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1.5 px-2 mt-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                {hiddenCount} more card{hiddenCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SurplusMember({ member }: { member: TradeAnalysis["surplus"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = member.cards.length > CARDS_PREVIEW_COUNT;
  const visibleCards = expanded ? member.cards : member.cards.slice(0, CARDS_PREVIEW_COUNT);
  const hiddenCount = member.cards.length - CARDS_PREVIEW_COUNT;

  return (
    <div className="space-y-2 ml-5">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold",
            member.isYou ? "bg-violet-500/30 text-violet-300" : "bg-zinc-700 text-zinc-400",
          )}
        >
          {member.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[11px] font-medium text-zinc-300">
          {member.name}{member.isYou ? " (You)" : ""}
        </span>
        <span className="text-[10px] text-green-400/70 ml-auto">
          {member.cardCount} cards
        </span>
      </div>
      <div className="ml-7">
        <CardGrid cards={visibleCards} />
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1.5 px-2 mt-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                {hiddenCount} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function CommandBarClanResult({ data }: { data: Record<string, unknown> }) {
  if (data.type === "clan_card_search") {
    const search = data as unknown as CardSearch;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span>
            Found <span className="text-white font-bold">{search.totalFound}</span> cards across{" "}
            <span className="text-white font-bold">{search.members.length}</span> member{search.members.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-4">
          {search.members.map((m) => (
            <MemberSection key={m.slug} member={m} />
          ))}
        </div>
      </div>
    );
  }

  if (data.type === "clan_trade_analysis") {
    const trade = data as unknown as TradeAnalysis;
    const posLabel = POSITION_SHORT[trade.position] ?? trade.position;
    const rarityConf = RARITY_CONFIG[trade.rarity];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-violet-400" />
          <span className="text-[12px] font-bold text-white">
            Trade Analysis: {posLabel}
          </span>
          {rarityConf && (
            <span className={cn("flex items-center gap-1 text-[10px] font-semibold", rarityConf.color)}>
              <span className={cn("w-2 h-2 rounded-full", rarityConf.dotColor)} />
              {rarityConf.label}
            </span>
          )}
          {trade.inSeasonOnly && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">
              In-season
            </span>
          )}
        </div>

        {/* Surplus */}
        {trade.surplus.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-green-400 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              Surplus — can trade
            </div>
            {trade.surplus.map((m) => (
              <SurplusMember key={m.slug} member={m} />
            ))}
          </div>
        )}

        {/* Needy */}
        {trade.needy.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold">
              <TrendingDown className="w-3.5 h-3.5" />
              Need — 0 cards here
            </div>
            {trade.needy.map((m) => (
              <div key={m.slug} className="flex items-center gap-2 ml-5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold",
                    m.isYou ? "bg-violet-500/30 text-violet-300" : "bg-zinc-700 text-zinc-400",
                  )}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {m.name}{m.isYou ? " (You)" : ""}
                </span>
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {m.totalOfRarity} {trade.rarity} total
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tight */}
        {trade.tight.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Tight — only 1 card
            </div>
            {trade.tight.map((m) => (
              <div key={m.slug} className="flex items-center gap-2 ml-5">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold",
                    m.isYou ? "bg-violet-500/30 text-violet-300" : "bg-zinc-700 text-zinc-400",
                  )}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[11px] text-zinc-400">
                  {m.name}{m.isYou ? " (You)" : ""}
                </span>
                {m.card && (
                  <span className="text-[10px] text-zinc-500 ml-auto">
                    {m.card.playerName} ({m.card.averageScore.toFixed(1)})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
