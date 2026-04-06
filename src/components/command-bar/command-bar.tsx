"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SorareCard } from "@/lib/types";
import { useCommandBar } from "@/lib/command-bar/use-command-bar";
import { useMarketStore } from "@/lib/market/market-store";
import { useLineupStore } from "@/lib/lineup-store";
import { CommandBarInput } from "./command-bar-input";
import { CommandBarResponse } from "./command-bar-response";
import { CommandBarAdvanced } from "./command-bar-advanced";
import { cn } from "@/lib/utils";

interface Props {
  activeTab: string;
  cards: SorareCard[];
}

function buildContextSnapshot(tab: string): string | undefined {
  if (tab === "market") {
    const { filters, totalOffers, players } = useMarketStore.getState();
    const playerCount = Object.keys(players).length;
    const parts = [`${playerCount} active players, ${totalOffers} total offers tracked`];
    if (filters.rarity) parts.push(`rarity filter: ${filters.rarity}`);
    if (filters.position) parts.push(`position filter: ${filters.position}`);
    if (filters.playerSearch) parts.push(`search: "${filters.playerSearch}"`);
    if (filters.myPlayersOnly) parts.push("showing owned players only");
    if (filters.minPriceEth) parts.push(`min price: ${filters.minPriceEth} ETH`);
    if (filters.maxPriceEth) parts.push(`max price: ${filters.maxPriceEth} ETH`);
    parts.push(`sort: ${filters.sort}`);
    return parts.join(". ");
  }

  if (tab === "lineup") {
    const { slots, currentLevel, playMode } = useLineupStore.getState();
    const filled = slots.filter((s) => s.card).map((s) => {
      const name = s.card?.anyPlayer?.displayName ?? "Unknown";
      return `${s.position}: ${name}${s.isCaptain ? " (C)" : ""}`;
    });
    const empty = slots.filter((s) => !s.card).map((s) => s.position);
    const parts = [`Level ${currentLevel}, mode: ${playMode}`];
    if (filled.length > 0) parts.push(`Lineup: ${filled.join(", ")}`);
    if (empty.length > 0) parts.push(`Empty slots: ${empty.join(", ")}`);
    return parts.join(". ");
  }

  return undefined;
}

export function CommandBar({ activeTab, cards }: Props) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    sendMessage,
    messages,
    streamedText,
    toolCalls,
    isStreaming,
    error,
    reset,
  } = useCommandBar(activeTab, cards);

  const isExpanded = !!(
    streamedText ||
    toolCalls.length > 0 ||
    error ||
    messages.some((m) => m.role === "assistant")
  );

  const isLineup = activeTab === "lineup";

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    const snapshot = buildContextSnapshot(activeTab);
    sendMessage(input.trim(), snapshot);
    setInput("");
  }, [input, isStreaming, activeTab, sendMessage]);

  const handleClose = useCallback(() => {
    reset();
    setInput("");
    inputRef.current?.blur();
    setIsFocused(false);
  }, [reset]);

  const handleSuggestion = useCallback(
    (suggestion: string) => {
      setInput("");
      const snapshot = buildContextSnapshot(activeTab);
      sendMessage(suggestion, snapshot);
    },
    [activeTab, sendMessage],
  );

  // Cmd+K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close when clicking outside (market/floating only)
  useEffect(() => {
    if (isLineup) return; // inline — don't close on outside click
    if (!isFocused && !isExpanded) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (isExpanded) return;
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isFocused, isExpanded, isLineup]);

  // Reset conversation when switching tabs
  useEffect(() => {
    reset();
    setInput("");
  }, [activeTab, reset]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "transition-all duration-200 shrink-0 overflow-hidden",
        isLineup
          ? "mx-3 my-2 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent"
          : "mx-4 mt-2 rounded-xl border bg-zinc-900/80 backdrop-blur-sm",
        !isLineup &&
          (isFocused || isExpanded
            ? "border-border/50 ring-1 ring-primary/20 shadow-lg shadow-primary/5"
            : "border-zinc-800/50"),
      )}
    >
      {/* Advanced (lineup only, hidden when conversation active) */}
      {isLineup && !isExpanded && (
        <CommandBarAdvanced onSubmit={handleSuggestion} />
      )}

      {/* Input */}
      <CommandBarInput
        ref={inputRef}
        activeTab={activeTab}
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onClose={handleClose}
        onSuggestion={handleSuggestion}
        isStreaming={isStreaming}
        isExpanded={isExpanded}
        showSeparator={isLineup && !isExpanded}
        onFocus={() => setIsFocused(true)}
      />

      {/* Conversation thread */}
      <CommandBarResponse
        messages={messages}
        streamedText={streamedText}
        toolCalls={toolCalls}
        error={error}
        isStreaming={isStreaming}
      />
    </div>
  );
}
