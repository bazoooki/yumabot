"use client";

import { AlertTriangle } from "lucide-react";

export interface LineupWarningsProps {
  warnings: ReadonlyArray<string>;
  title?: string;
}

export function LineupWarnings({
  warnings,
  title = "Warnings",
}: LineupWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="space-y-1.5">
        {warnings.map((warning, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-900/10 border border-yellow-500/20"
          >
            <span className="text-[11px] text-yellow-300">{warning}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
