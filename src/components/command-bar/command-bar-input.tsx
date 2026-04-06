"use client";

import { forwardRef, type KeyboardEvent } from "react";
import { Sparkles, Loader2, X } from "lucide-react";

const PLACEHOLDERS: Record<string, string> = {
  market: "Ask about the market...",
  lineup: "Ask about your lineup...",
};

interface Props {
  activeTab: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onFocus?: () => void;
  isStreaming: boolean;
  isExpanded: boolean;
}

export const CommandBarInput = forwardRef<HTMLInputElement, Props>(
  function CommandBarInput(
    { activeTab, value, onChange, onSubmit, onClose, onFocus, isStreaming, isExpanded },
    ref,
  ) {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey && value.trim()) {
        e.preventDefault();
        onSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={PLACEHOLDERS[activeTab] ?? "Ask anything..."}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-zinc-500 focus:outline-none"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        ) : isExpanded ? (
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        ) : (
          <kbd className="text-[10px] text-zinc-600 bg-zinc-800 rounded px-1.5 py-0.5 font-mono border border-zinc-700/50 shrink-0">
            {typeof navigator !== "undefined" &&
            navigator.platform?.includes("Mac")
              ? "⌘K"
              : "Ctrl+K"}
          </kbd>
        )}
      </div>
    );
  },
);
