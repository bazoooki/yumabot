"use client";

import { RotateCcw } from "lucide-react";
import { useLineupStore } from "@/lib/lineup-store";
import { Pitch } from "./pitch";
import { CardPicker } from "./card-picker";
import type { SorareCard } from "@/lib/types";

interface LineupBuilderProps {
  cards: SorareCard[];
}

export function LineupBuilder({ cards }: LineupBuilderProps) {
  const { clearLineup, slots } = useLineupStore();
  const hasCards = slots.some((s) => s.card !== null);

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-full">
      {/* Left: Pitch — compact on mobile, side panel on desktop */}
      <div className="h-[45vh] md:h-auto md:w-[45%] md:min-w-[400px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-zinc-800">
        <div className="flex-1 overflow-hidden">
          <Pitch cards={cards} />
        </div>
        {hasCards && (
          <div className="px-3 py-1.5 md:px-4 border-t border-zinc-800">
            <button
              onClick={clearLineup}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear lineup
            </button>
          </div>
        )}
      </div>

      {/* Right: Card Picker (includes AI Command Bar) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <CardPicker cards={cards} />
      </div>
    </div>
  );
}
