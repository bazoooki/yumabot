"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Lock, Crown, X, Sparkles, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLineupStore } from "@/lib/lineup-store";
import { RARITY_CONFIG } from "@/lib/types";
import { POSITION_SHORT } from "@/lib/ui-config";
import type { SorareCard, Position } from "@/lib/types";
import { SLOT_TO_POSITION } from "@/lib/normalization";
import type { FixtureGame } from "@/lib/types";

interface RoomLineupBuilderProps {
  cards: SorareCard[];
  games: FixtureGame[];
  roomId: string;
  userSlug: string;
  onSubmitted: () => void;
}

const PLAYABLE_RARITIES = new Set(["limited", "rare", "super_rare", "unique"]);

export function RoomLineupBuilder({ cards, games, roomId, userSlug, onSubmitted }: RoomLineupBuilderProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    slots, currentLevel, targetScore, selectedSlotIndex,
    addCard, removeCard, setCaptain, selectSlot,
  } = useLineupStore();

  const filledCount = slots.filter((s) => s.card).length;
  const lineupSlugs = useMemo(
    () => new Set(slots.filter((s) => s.card).map((s) => s.card!.slug)),
    [slots]
  );

  // Build set of team slugs from room fixtures
  const fixtureTeamSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const g of games) {
      slugs.add(g.homeTeam.slug);
      slugs.add(g.awayTeam.slug);
    }
    return slugs;
  }, [games]);

  const usedSlugs = useMemo(() => new Set(
    slots.filter((s) => s.card).map((s) => s.card!.anyPlayer?.slug)
  ), [slots]);

  // Auto-filter card picker by the selected slot's position
  const slotPosFilter = useMemo((): Position | "all" => {
    if (selectedSlotIndex == null) return "all";
    const slotPos = slots[selectedSlotIndex]?.position;
    if (!slotPos) return "all";
    const mapped = SLOT_TO_POSITION[slotPos];
    return (mapped as Position) || "all";
  }, [selectedSlotIndex, slots]);

  const available = useMemo(() => {
    const isExSlot = selectedSlotIndex != null && slots[selectedSlotIndex]?.position === "EX";

    return cards.filter((card) => {
      if (!PLAYABLE_RARITIES.has(card.rarityTyped)) return false;
      const player = card.anyPlayer;
      if (!player?.activeClub) return false;

      // Match by checking if the player's club is in this room's fixtures
      if (!player.activeClub.slug || !fixtureTeamSlugs.has(player.activeClub.slug)) return false;

      if (usedSlugs.has(player.slug)) return false;

      // Position filtering: EX slot shows all except GK, others filter by slot position
      if (isExSlot) {
        if (player.cardPositions.includes("Goalkeeper")) return false;
      } else if (slotPosFilter !== "all" && !player.cardPositions.includes(slotPosFilter)) {
        return false;
      }

      return true;
    }).sort((a, b) => (b.anyPlayer?.averageScore || 0) - (a.anyPlayer?.averageScore || 0));
  }, [cards, fixtureTeamSlugs, usedSlugs, slotPosFilter, selectedSlotIndex, slots]);

  async function lockIn() {
    if (filledCount < 5) return;
    setSubmitting(true);
    try {
      const slotData = slots.map((s) => ({
        position: s.position,
        playerSlug: s.card?.anyPlayer?.slug || null,
        playerName: s.card?.anyPlayer?.displayName || null,
        pictureUrl: s.card?.pictureUrl || null,
        rarity: s.card?.rarityTyped || null,
        power: s.card?.power || null,
      }));
      const captainIndex = slots.findIndex((s) => s.isCaptain);

      await fetch(`/api/rooms/${roomId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSlug,
          slots: slotData,
          captainIndex: captainIndex >= 0 ? captainIndex : 0,
          targetScore,
          currentLevel,
        }),
      });
      onSubmitted();
    } catch {
      // ignore
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* LEFT: Lineup controls */}
      <div className="w-[45%] overflow-y-auto p-6 space-y-5 border-r border-zinc-800">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Build Your Lineup
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Pick 5 players from today's fixtures and choose your captain</p>
        </div>

        {/* How it works */}
        <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            How Rooms Work
          </h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>Pick 5 cards from players in today's fixtures</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>Choose a captain for a <span className="text-amber-400 font-semibold">1.5x score bonus</span></span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>Lock in before kickoff and compete with friends live</span>
            </div>
          </div>
        </div>

        {/* Lineup Slots */}
        <div className="rounded-2xl bg-card border border-border/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Your Squad ({filledCount}/5)</h3>
            <div className="h-2 w-32 bg-secondary/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${(filledCount / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {slots.map((slot, i) => {
              const card = slot.card;
              const isSelected = selectedSlotIndex === i;

              return (
                <div
                  key={i}
                  onClick={() => card ? removeCard(i) : selectSlot(i)}
                  className={cn(
                    "relative rounded-xl border aspect-[3/4] flex flex-col items-center justify-center transition-all duration-300 overflow-hidden group cursor-pointer",
                    card
                      ? "border-border bg-gradient-to-br from-secondary/50 to-secondary/20 hover:border-red-500/50"
                      : isSelected
                        ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.15)]"
                        : "border-dashed border-border/50 bg-secondary/20 hover:border-border hover:bg-secondary/30"
                  )}
                >
                  <span className="absolute top-1.5 left-1.5 text-[8px] font-mono font-bold text-muted-foreground uppercase tracking-wider bg-background/50 px-1.5 py-0.5 rounded-full">
                    {slot.position}
                  </span>

                  {card ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCaptain(i); }}
                        className={cn(
                          "absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 z-10",
                          slot.isCaptain
                            ? "bg-amber-500 text-black shadow-lg"
                            : "bg-secondary/80 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-400"
                        )}
                      >
                        <Crown className="w-3 h-3" />
                      </button>
                      <img src={card.pictureUrl} alt="" className="w-12 h-[68px] object-contain drop-shadow-lg" />
                      <span className="text-[9px] text-foreground font-semibold truncate w-full text-center mt-1 px-1">
                        {card.anyPlayer?.displayName}
                      </span>
                      <div className="absolute inset-0 bg-red-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="p-1.5 rounded-full bg-red-500/80">
                          <X className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-primary/20" : "bg-secondary/50"
                      )}>
                        <span className={cn(
                          "text-xl",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>+</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}>
                        {isSelected ? "Select" : "Empty"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lock In Button */}
          <button
            onClick={lockIn}
            disabled={filledCount < 5 || submitting}
            className={cn(
              "flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold mt-3 transition-all duration-300",
              filledCount === 5
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] hover:scale-[1.02]"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            <Lock className="w-4 h-4" />
            {submitting ? (
              <span className="animate-pulse">Locking in...</span>
            ) : (
              <span>Lock In Lineup ({filledCount}/5)</span>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT: Card picker */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Card count header */}
        <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
          <span className="text-[11px] text-zinc-500">
            {available.length} cards
          </span>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 border-2 border-zinc-700 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">Loading cards...</p>
              <p className="text-xs text-zinc-600">If this takes too long, try Refresh Cards</p>
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-500">No matching cards found</p>
              <p className="text-xs text-zinc-600 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
              {available.map((card) => {
                const player = card.anyPlayer;
                if (!player) return null;
                const disabled = lineupSlugs.has(card.slug);
                const position = player.cardPositions?.[0] || "Unknown";
                const posShort = POSITION_SHORT[position] || "??";
                const avgScore = player.averageScore || 0;
                const rarityConf = RARITY_CONFIG[card.rarityTyped] || RARITY_CONFIG.common;

                return (
                  <button
                    key={card.slug}
                    onClick={() => {
                      if (!disabled) {
                        addCard(selectedSlotIndex ?? slots.findIndex((s) => !s.card), card);
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      "relative rounded-xl overflow-hidden border transition-all text-left group",
                      disabled
                        ? "opacity-40 cursor-not-allowed border-zinc-800"
                        : "border-zinc-700/40 hover:border-primary/50 cursor-pointer"
                    )}
                  >
                    {/* Card Image */}
                    <div className="relative aspect-[5/6] w-full bg-zinc-800 overflow-hidden">
                      <Image
                        src={card.pictureUrl}
                        alt={player.displayName}
                        fill
                        className="object-cover object-[center_15%] scale-110"
                        sizes="160px"
                      />
                    </div>

                    {/* Info bar */}
                    <div className="px-1.5 py-1.5 bg-zinc-900">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-bold text-zinc-400 bg-zinc-800 px-1 rounded shrink-0">{posShort}</span>
                        <p className="text-[10px] font-bold text-white truncate">{player.displayName}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={cn(
                          "text-[9px] font-bold px-1 py-0.5 rounded",
                          avgScore >= 60 ? "bg-green-500/20 text-green-400" :
                          avgScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-zinc-700 text-zinc-400"
                        )}>
                          {avgScore > 0 ? Math.round(avgScore) : "—"}
                        </span>
                        <span className={cn("w-1.5 h-1.5 rounded-full ml-auto", rarityConf.dotColor)} />
                        <span className="text-[8px] text-zinc-500">{player.activeClub?.code}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-zinc-800 shrink-0">
          <p className="text-[11px] text-zinc-500">
            {available.length} cards available
          </p>
        </div>
      </div>
    </div>
  );
}
