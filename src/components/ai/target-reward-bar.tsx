"use client";

import { Shield, TrendingUp, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrategyMode = "floor" | "balanced" | "ceiling";
export type RiskLevel = "Low" | "Medium" | "High";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface TargetRewardBarProps {
  /** Threshold score in points, e.g. 320. */
  thresholdScore: number;
  /** Display reward, e.g. "$15" or "120 essence". */
  rewardLabel: string;
  /** Coloring for the reward — green for cash, amber for top tier. */
  rewardAccent?: "green" | "amber";
  /** Recommended mode for the current level/target. */
  mode: StrategyMode;
  /** Single-line recommendation copy. */
  recommendation: string;
  /** Top-of-section title; defaults to `<thresholdScore> pts`. */
  title?: string;
  /** Stats row underneath the recommendation. */
  stats?: {
    earnedUsd: number;
    atStakeUsd: number;
    risk: RiskLevel;
  };
  /** Current lineup running estimate vs target. */
  estimate?: { value: number; meetsTarget: boolean } | null;
  /** AI-computed success probability, with confidence level driving color. */
  probability?: {
    successProbability: number;
    confidenceLevel: ConfidenceLevel;
  } | null;
  /** "Confirmed starters" row — shown when filledCount > 0. */
  confirmed?: { confirmedCount: number; filledCount: number } | null;
}

const MODE_CLASS: Record<StrategyMode, string> = {
  floor: "bg-green-500/10 border-green-500/20 text-green-400",
  balanced: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  ceiling: "bg-amber-500/10 border-amber-500/20 text-amber-400",
};

const MODE_LABEL: Record<StrategyMode, string> = {
  floor: "FAST MODE",
  balanced: "BALANCED MODE",
  ceiling: "SAFE MODE",
};

const RISK_CLASS: Record<RiskLevel, string> = {
  Low: "text-green-400",
  Medium: "text-yellow-400",
  High: "text-red-400",
};

export function TargetRewardBar({
  thresholdScore,
  rewardLabel,
  rewardAccent = "green",
  mode,
  recommendation,
  title,
  stats,
  estimate,
  probability,
  confirmed,
}: TargetRewardBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          {title ?? `${thresholdScore} pts`}
        </h3>
      </div>

      <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">
            {thresholdScore} pts
          </span>
          <span
            className={cn(
              "text-sm font-bold",
              rewardAccent === "amber" ? "text-amber-400" : "text-green-400",
            )}
          >
            {rewardLabel}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-bold",
            MODE_CLASS[mode],
          )}
        >
          {mode === "floor" ? (
            <Zap className="w-3.5 h-3.5" />
          ) : (
            <Shield className="w-3.5 h-3.5" />
          )}
          {MODE_LABEL[mode]}
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {recommendation}
        </p>

        {stats && (
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-700/50">
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">Earned</p>
              <p className="text-xs font-bold text-green-400">
                ${stats.earnedUsd}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">At Stake</p>
              <p className="text-xs font-bold text-white">
                ${stats.atStakeUsd}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-zinc-600 uppercase">Risk</p>
              <p className={cn("text-xs font-bold", RISK_CLASS[stats.risk])}>
                {stats.risk}
              </p>
            </div>
          </div>
        )}

        {estimate && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
            <span className="text-[11px] text-zinc-500">Lineup estimate</span>
            <span
              className={cn(
                "text-sm font-bold",
                estimate.meetsTarget ? "text-green-400" : "text-red-400",
              )}
            >
              ~{Math.round(estimate.value)} / {thresholdScore}
            </span>
          </div>
        )}

        {probability && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              Success probability
            </span>
            <span
              className={cn(
                "text-sm font-bold",
                probability.confidenceLevel === "high"
                  ? "text-green-400"
                  : probability.confidenceLevel === "medium"
                    ? "text-yellow-400"
                    : "text-red-400",
              )}
            >
              {Math.round(probability.successProbability * 100)}%
            </span>
          </div>
        )}

        {confirmed && confirmed.filledCount > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Confirmed starters
            </span>
            <span
              className={cn(
                "text-sm font-bold",
                confirmed.confirmedCount === confirmed.filledCount
                  ? "text-green-400"
                  : confirmed.confirmedCount > 0
                    ? "text-yellow-400"
                    : "text-zinc-500",
              )}
            >
              {confirmed.confirmedCount}/{confirmed.filledCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
