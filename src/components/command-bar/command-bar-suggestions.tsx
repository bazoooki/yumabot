"use client";

const SUGGESTIONS: Record<string, string[]> = {
  market: [
    "What's trending?",
    "Show rare forwards",
    "Under 0.1 ETH",
    "My players only",
    "Alerts summary",
    "Sort by most sales",
  ],
  lineup: [
    "Best lineup for level 2",
    "Best lineup for level 4",
    "Who should I captain?",
    "Lineup status",
  ],
  default: ["Collection overview"],
};

interface Props {
  activeTab: string;
  onSelect: (suggestion: string) => void;
}

export function CommandBarSuggestions({ activeTab, onSelect }: Props) {
  const suggestions = SUGGESTIONS[activeTab] ?? SUGGESTIONS.default;

  return (
    <div className="flex items-center gap-1.5 px-4 pb-2.5 overflow-x-auto">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-2.5 py-1 rounded-full text-[11px] text-zinc-500 bg-zinc-800/50 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
