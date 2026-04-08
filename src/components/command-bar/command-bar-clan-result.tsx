"use client";

import { ArrowRightLeft, TrendingUp, TrendingDown, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITION_COLORS, POSITION_SHORT } from "@/lib/ui-config";
import { RARITY_CONFIG } from "@/lib/types";

interface CardData {
  playerName: string;
  position: string;
  rarity?: string;
  averageScore: number;
  power: string;
  club: string;
  league?: string;
  inSeason: boolean;
  edition?: string;
}

interface MemberCards {
  name: string;
  slug: string;
  isYou: boolean;
  cards: CardData[];
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
    cards: CardData[];
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

function CardChip({ card }: { card: CardData }) {
  const rarityConf = card.rarity ? RARITY_CONFIG[card.rarity] : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 hover:border-zinc-600/60 transition-all">
      {/* Position badge */}
      <span
        className={cn(
          "px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0",
          POSITION_COLORS[card.position] ?? "bg-zinc-700 text-zinc-300 border-zinc-600",
        )}
      >
        {POSITION_SHORT[card.position] ?? card.position?.slice(0, 3).toUpperCase()}
      </span>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-white truncate">
            {card.playerName}
          </span>
          {card.inSeason && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 font-bold shrink-0">
              IS
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-500 truncate block">
          {card.club}
          {card.edition ? ` · ${card.edition}` : ""}
        </span>
      </div>

      {/* Score + power */}
      <div className="text-right shrink-0">
        <div className="text-[11px] font-bold text-white">
          {card.averageScore.toFixed(1)}
        </div>
        <div className="text-[9px] text-zinc-500">
          {card.power}
        </div>
      </div>

      {/* Rarity dot */}
      {rarityConf && (
        <span className={cn("w-2 h-2 rounded-full shrink-0", rarityConf.dotColor)} title={rarityConf.label} />
      )}
    </div>
  );
}

function MemberSection({ member }: { member: MemberCards }) {
  return (
    <div className="space-y-1.5">
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
      <div className="space-y-1 ml-8">
        {member.cards.map((card, i) => (
          <CardChip key={`${card.playerName}-${i}`} card={card} />
        ))}
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
              <div key={m.slug} className="space-y-1.5 ml-5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold",
                      m.isYou ? "bg-violet-500/30 text-violet-300" : "bg-zinc-700 text-zinc-400",
                    )}
                  >
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-300">
                    {m.name}{m.isYou ? " (You)" : ""}
                  </span>
                  <span className="text-[10px] text-green-400/70 ml-auto">
                    {m.cardCount} cards
                  </span>
                </div>
                <div className="space-y-1 ml-7">
                  {m.cards.map((card, i) => (
                    <CardChip key={`${card.playerName}-${i}`} card={card} />
                  ))}
                </div>
              </div>
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
