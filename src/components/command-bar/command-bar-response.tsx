"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { CommandBarLineupResult } from "./command-bar-lineup-result";
import { CommandBarClanResult } from "./command-bar-clan-result";
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
  clan_overview: "Clan data loaded",
  clan_find_cards: "Cards searched",
  clan_trade_analysis: "Trade analysis done",
  clan_member_cards: "Member cards loaded",
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

function ToolBadges({ toolCalls }: { toolCalls: ToolCallStatus[] }) {
  const badges = toolCalls.filter((tc) => !tc.metadata);
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((tc) => (
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
  );
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  messages: DisplayMessage[];
  streamedText: string;
  toolCalls: ToolCallStatus[];
  error: string | null;
  isStreaming: boolean;
}

export function CommandBarResponse({
  messages,
  streamedText,
  toolCalls,
  error,
  isStreaming,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasContent =
    messages.length > 0 || streamedText || toolCalls.length > 0 || error;

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamedText, toolCalls.length, error]);

  if (!hasContent) return null;

  // Rich results from current tool calls
  const lineupResult = toolCalls.find(
    (tc) =>
      tc.status === "executed" &&
      tc.metadata?.type === "lineup_recommendation",
  );
  const clanResult = toolCalls.find(
    (tc) =>
      tc.status === "executed" &&
      (tc.metadata?.type === "clan_card_search" || tc.metadata?.type === "clan_trade_analysis"),
  );

  // Determine if the streaming text is already in messages (don't show twice)
  const lastMsg = messages[messages.length - 1];
  const streamingAlreadyInMessages =
    lastMsg?.role === "assistant" && lastMsg.content === streamedText;

  return (
    <div
      ref={scrollRef}
      className="border-t border-zinc-800/30 max-h-[400px] overflow-y-auto"
    >
      {/* Conversation messages */}
      {messages.map((msg, i) => (
        <div key={i} className="px-4 py-2">
          {msg.role === "user" ? (
            <div className="flex justify-end">
              <div className="bg-primary/10 text-primary text-[13px] rounded-lg px-3 py-1.5 max-w-[85%]">
                {msg.content}
              </div>
            </div>
          ) : (
            <FormattedText text={msg.content} />
          )}
        </div>
      ))}

      {/* Current response: tool badges + rich result + streaming text */}
      {(toolCalls.length > 0 ||
        (streamedText && !streamingAlreadyInMessages) ||
        error) && (
        <div className="px-4 py-2 space-y-3">
          <ToolBadges toolCalls={toolCalls} />

          {lineupResult?.metadata && (
            <CommandBarLineupResult data={lineupResult.metadata} />
          )}

          {clanResult?.metadata && (
            <CommandBarClanResult data={clanResult.metadata} />
          )}

          {streamedText && !streamingAlreadyInMessages && (
            <FormattedText text={streamedText} />
          )}

          {isStreaming && !streamedText && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-zinc-500">Thinking...</span>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
