"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { useInSeasonStore, useSelectedCompetition } from "@/lib/in-season-store";
import { validateInSeasonLineup } from "@/lib/in-season-validation";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const COLOR_MAP = {
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-zinc-400",
  success: "text-green-400",
};

export function LineupValidationBar() {
  const slots = useInSeasonStore((s) => s.slots);
  const comp = useSelectedCompetition();
  const cachedPlayerIntel = useInSeasonStore((s) => s.cachedPlayerIntel);

  const result = useMemo(() => {
    if (!comp) return null;
    return validateInSeasonLineup(slots, comp, cachedPlayerIntel);
  }, [slots, comp, cachedPlayerIntel]);

  if (!result || result.messages.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2">
      {result.messages.map((msg, i) => {
        const Icon = ICON_MAP[msg.type];
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-1 text-[11px]",
              COLOR_MAP[msg.type],
            )}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span>{msg.text}</span>
          </div>
        );
      })}
    </div>
  );
}
