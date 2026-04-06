import type { StrategyTag } from "./types";

// --- Strategy Tag Styles ---

export const STRATEGY_TAG_STYLES: Record<
  StrategyTag,
  { text: string; bg: string; bgSolid: string; border: string }
> = {
  SAFE: { text: "text-green-400", bg: "bg-green-500/15", bgSolid: "bg-green-500/80", border: "border-green-500/20" },
  BALANCED: { text: "text-blue-400", bg: "bg-blue-500/15", bgSolid: "bg-blue-500/80", border: "border-blue-500/20" },
  CEILING: { text: "text-amber-400", bg: "bg-amber-500/15", bgSolid: "bg-amber-500/80", border: "border-amber-500/20" },
  RISKY: { text: "text-red-400", bg: "bg-red-500/15", bgSolid: "bg-red-500/80", border: "border-red-500/20" },
};

// --- Position Styles ---

export const POSITION_COLORS: Record<string, string> = {
  Goalkeeper: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Defender: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Midfielder: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Forward: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const POSITION_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Forward: "FWD",
};
