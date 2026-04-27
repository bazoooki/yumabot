"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface AIVerdictResponse {
  text?: string;
  cached?: boolean;
  error?: string;
}

const VARIANT_CLASSES = {
  amber: {
    container: "from-amber-500/5 to-pink-500/5 border-amber-500/20",
    icon: "text-amber-400",
    label: "text-amber-400",
  },
  cyan: {
    container: "from-cyan-500/5 to-blue-500/5 border-cyan-500/20",
    icon: "text-cyan-400",
    label: "text-cyan-400",
  },
} as const;

export type AIVerdictVariant = keyof typeof VARIANT_CLASSES;

export interface AIVerdictProps {
  endpoint: string;
  payload: unknown;
  cacheKey: ReadonlyArray<unknown>;
  enabled?: boolean;
  variant?: AIVerdictVariant;
  errorText?: string;
  staleTime?: number;
  label?: string;
}

export function AIVerdict({
  endpoint,
  payload,
  cacheKey,
  enabled = true,
  variant = "amber",
  errorText = "The commentator stepped out — try again in a sec.",
  staleTime = 5 * 60 * 1000,
  label = "AI Take",
}: AIVerdictProps) {
  const accent = VARIANT_CLASSES[variant];
  const { data, isLoading, isError } = useQuery({
    queryKey: [...cacheKey],
    queryFn: async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("AI request failed");
      return (await res.json()) as AIVerdictResponse;
    },
    staleTime,
    retry: 1,
    enabled,
  });

  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-br border p-3",
        accent.container,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className={cn("w-3.5 h-3.5", accent.icon)} />
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            accent.label,
          )}
        >
          {label}
        </span>
        {data?.cached && (
          <span className="text-[9px] text-zinc-600">cached</span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-1.5">
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse" />
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-4/5" />
          <div className="h-3 rounded bg-zinc-800/60 animate-pulse w-3/5" />
        </div>
      ) : isError ? (
        <p className="text-[11px] text-zinc-500">{errorText}</p>
      ) : data?.text ? (
        <p className="text-[12px] leading-relaxed text-zinc-200 whitespace-pre-line">
          {data.text}
        </p>
      ) : null}
    </div>
  );
}
