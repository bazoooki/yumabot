"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SorareCard } from "@/lib/types";
import { useCommandBar } from "@/lib/command-bar/use-command-bar";
import { useMarketStore } from "@/lib/market/market-store";
import { useLineupStore } from "@/lib/lineup-store";
import { CommandBarInput } from "./command-bar-input";
import { CommandBarResponse } from "./command-bar-response";
import { CommandBarSuggestions } from "./command-bar-suggestions";
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

  const { sendMessage, streamedText, toolCalls, isStreaming, error, reset } =
    useCommandBar(activeTab, cards);

  const isExpanded = !!(streamedText || toolCalls.length > 0 || error);

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

  // Close when clicking outside
  useEffect(() => {
    if (!isFocused && !isExpanded) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (isExpanded) return; // keep expanded until explicitly closed
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isFocused, isExpanded]);

  // Reset conversation when switching tabs
  useEffect(() => {
    reset();
    setInput("");
  }, [activeTab, reset]);

  const isInline = activeTab === "lineup";

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-zinc-900/80 backdrop-blur-sm transition-all duration-200 shrink-0",
        isInline
          ? "border-b border-zinc-800"
          : "mx-4 mt-2 rounded-xl border",
        !isInline && (isFocused || isExpanded
          ? "border-border/50 ring-1 ring-primary/20 shadow-lg shadow-primary/5"
          : "border-zinc-800/50"),
      )}
    >
      <CommandBarInput
        ref={inputRef}
        activeTab={activeTab}
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onClose={handleClose}
        isStreaming={isStreaming}
        isExpanded={isExpanded}
        onFocus={() => setIsFocused(true)}
      />

      {/* Suggestions: show when focused, empty input, and not expanded */}
      {isFocused && !input && !isExpanded && (
        <CommandBarSuggestions
          activeTab={activeTab}
          onSelect={handleSuggestion}
        />
      )}

      {/* Advanced options (lineup tab only) */}
      {activeTab === "lineup" && !isExpanded && (
        <CommandBarAdvanced onSubmit={handleSuggestion} />
      )}

      {/* Response area */}
      <CommandBarResponse
        text={streamedText}
        toolCalls={toolCalls}
        error={error}
      />
    </div>
  );
}
