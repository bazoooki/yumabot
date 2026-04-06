"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

const HELP_CONTENT: Record<string, Array<{ title: string; examples: string[] }>> = {
  lineup: [
    {
      title: "Lineups",
      examples: [
        "Best lineup for level 2",
        "Weekend games only",
        "Exclude [player]",
      ],
    },
    {
      title: "Captain & swaps",
      examples: [
        "What if I captain [player]?",
        "Alternatives for DEF",
        "Only Premier League",
      ],
    },
    {
      title: "Other",
      examples: [
        "Analyze [player]",
        "Lineup status",
        "Clear lineup",
      ],
    },
  ],
  market: [
    {
      title: "Filter",
      examples: [
        "Show rare forwards",
        "Under 0.1 ETH",
        "My players only",
      ],
    },
    {
      title: "Insights",
      examples: [
        "What's trending?",
        "Alerts summary",
      ],
    },
  ],
};

interface Props {
  activeTab: string;
  onSelect: (query: string) => void;
}

export function CommandBarHelp({ activeTab, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const categories = HELP_CONTENT[activeTab] ?? HELP_CONTENT.market;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
        title="What can I ask?"
      >
        <HelpCircle className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 w-56 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl shadow-black/40 z-50 overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-zinc-800/50">
            <p className="text-[10px] font-semibold text-zinc-400">
              Try asking
            </p>
          </div>

          <div className="max-h-[260px] overflow-y-auto py-0.5">
            {categories.map((cat) => (
              <div key={cat.title} className="px-2.5 py-1">
                <p className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider mb-0.5">
                  {cat.title}
                </p>
                {cat.examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      onSelect(ex);
                      setIsOpen(false);
                    }}
                    className="block w-full text-left px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
