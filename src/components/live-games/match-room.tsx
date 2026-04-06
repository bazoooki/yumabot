"use client";

import { Tv } from "lucide-react";
import type { SorareCard } from "@/lib/types";

interface Props {
  gameId: string;
  cards: SorareCard[];
}

export function MatchRoom({ gameId, cards }: Props) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — Match overview */}
      <div className="w-[60%] border-r border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
              <Tv className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">
                Match Overview
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Live scores, timeline, and key events will appear here
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — Player scores / Fantasy impact */}
      <div className="w-[40%] flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
              <Tv className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">
                Fantasy Impact
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Player scores and Sorare points tracking will appear here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
