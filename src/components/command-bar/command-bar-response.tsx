"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { CommandBarLineupResult } from "./command-bar-lineup-result";
import type { ToolCallStatus } from "@/lib/command-bar/use-command-bar";

const TOOL_LABELS: Record<string, string> = {
  set_market_filters: "Filters updated",
  clear_market_filters: "Filters reset",
  get_market_summary: "Market data loaded",
  get_player_activity: "Player data loaded",
  get_recent_alerts: "Alerts loaded",
  set_player_in_slot: "Player placed",
  remove_player_from_slot: "Player removed",
  auto_fill_lineup: "Lineup filled",
  get_lineup_status: "Lineup status loaded",
  analyze_player: "Analysis loaded",
  set_strategy_mode: "Strategy changed",
  set_captain: "Captain set",
  recommend_best_lineup: "Lineup built",
  simulate_captain: "Captain simulated",
  get_slot_alternatives: "Alternatives loaded",
  clear_lineup: "Lineup cleared",
  get_collection_overview: "Collection loaded",
};

/** Simple markdown-like formatter: **bold** and - list items */
function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="text-sm text-zinc-300 leading-relaxed space-y-2">
      {paragraphs.map((para, i) => {
        const lines = para.split("\n");
        const isList = lines.every(
          (l) => l.startsWith("- ") || l.trim() === "",
        );

        if (isList) {
          return (
            <ul key={i} className="space-y-1 ml-1">
              {lines
                .filter((l) => l.startsWith("- "))
                .map((l, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-zinc-500 shrink-0">·</span>
                    <span>{formatInline(l.slice(2))}</span>
                  </li>
                ))}
            </ul>
          );
        }

        return (
          <p key={i}>{formatInline(para.replace(/\n/g, " "))}</p>
        );
      })}
    </div>
  );
}

/** Replace **bold** with <strong> */
function formatInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Props {
  text: string;
  toolCalls: ToolCallStatus[];
  error: string | null;
}

export function CommandBarResponse({ text, toolCalls, error }: Props) {
  if (!text && toolCalls.length === 0 && !error) return null;

  // Find rich result metadata
  const lineupResult = toolCalls.find(
    (tc) =>
      tc.status === "executed" &&
      tc.metadata?.type === "lineup_recommendation",
  );

  // Tool calls without rich metadata (show as badges)
  const badgeToolCalls = toolCalls.filter((tc) => !tc.metadata);

  return (
    <div className="border-t border-zinc-800/50 px-4 py-3 max-h-[400px] overflow-y-auto space-y-3">
      {/* Tool call badges (non-rich only) */}
      {badgeToolCalls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badgeToolCalls.map((tc) => (
            <span
              key={tc.id}
              className={`inline-flex items-center gap-1 text-xs ${
                tc.status === "executed"
                  ? "text-primary"
                  : tc.status === "error"
                    ? "text-red-400"
                    : "text-zinc-500"
              }`}
            >
              {tc.status === "error" ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {TOOL_LABELS[tc.name] ?? tc.name}
            </span>
          ))}
        </div>
      )}

      {/* Rich lineup result */}
      {lineupResult?.metadata && (
        <CommandBarLineupResult data={lineupResult.metadata} />
      )}

      {/* AI text with markdown formatting */}
      {text && <FormattedText text={text} />}

      {/* Error */}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
