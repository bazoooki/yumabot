"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Sparkles, Loader2 } from "lucide-react";
import type { SorareCard } from "@/lib/types";

const PHASES: ReadonlyArray<{ message: string; delay: number }> = [
  { message: "Reading your roster", delay: 1200 },
  { message: "Pulling starter odds from Sorare", delay: 2400 },
  { message: "Projecting next-GW scores", delay: 2400 },
  { message: "Ranking captain candidates", delay: Infinity },
];

interface AISuggestionLoaderProps {
  /** Cards eligible for this row's competition. Used for the avatar cycle and the count chip. */
  eligibleCards: SorareCard[];
}

export function AISuggestionLoader({ eligibleCards }: AISuggestionLoaderProps) {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const phase = PHASES[phaseIdx];
    if (phaseIdx >= PHASES.length - 1) return;
    const id = setTimeout(() => setPhaseIdx((i) => i + 1), phase.delay);
    return () => clearTimeout(id);
  }, [phaseIdx]);

  // Pick up to 8 distinct player avatars to cycle. Sort so the cycle is
  // stable across re-renders and cap so the strip stays compact.
  const avatars = useMemo(() => {
    const seen = new Set<string>();
    const out: { slug: string; name: string; url: string }[] = [];
    for (const c of eligibleCards) {
      const p = c.anyPlayer;
      if (!p) continue;
      if (seen.has(p.slug)) continue;
      const url = p.avatarPictureUrl || c.pictureUrl;
      if (!url) continue;
      seen.add(p.slug);
      out.push({ slug: p.slug, name: p.displayName, url });
      if (out.length >= 8) break;
    }
    return out;
  }, [eligibleCards]);

  // Cycle the highlighted avatar to suggest "scanning through players".
  const [scanIdx, setScanIdx] = useState(0);
  useEffect(() => {
    if (avatars.length === 0) return;
    const id = setInterval(
      () => setScanIdx((i) => (i + 1) % avatars.length),
      450,
    );
    return () => clearInterval(id);
  }, [avatars.length]);

  return (
    <div className="border-t border-zinc-700/40 bg-zinc-900/40 px-3 py-4 space-y-3">
      {/* Header: spinning sparkle + phase message */}
      <div className="flex items-center gap-2">
        <div className="relative w-5 h-5 grid place-items-center">
          <Sparkles className="w-4 h-4 text-cyan-400 absolute" />
          <Loader2 className="w-5 h-5 text-cyan-400/40 animate-spin" />
        </div>
        <span className="text-[11px] font-semibold text-zinc-200">
          {PHASES[phaseIdx].message}
        </span>
        <span className="ml-auto mono text-[9px] uppercase tracking-wider text-zinc-500">
          {eligibleCards.length} eligible
        </span>
      </div>

      {/* Avatar scan strip — gives "I'm looking at your players" feel. */}
      {avatars.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden h-8">
          {avatars.map((a, i) => (
            <div
              key={a.slug}
              className={
                "relative w-7 h-7 rounded-full overflow-hidden border transition-all duration-300 " +
                (i === scanIdx
                  ? "border-cyan-400 scale-110 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                  : "border-zinc-700/60 opacity-60")
              }
              title={a.name}
            >
              <Image
                src={a.url}
                alt={a.name}
                width={28}
                height={28}
                className="object-cover w-full h-full"
                sizes="28px"
              />
            </div>
          ))}
        </div>
      )}

      {/* Indeterminate progress bar */}
      <div className="h-1 bg-zinc-800/60 rounded-full overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-cyan-500/80 via-cyan-400 to-cyan-500/80 rounded-full animate-indeterminate" />
      </div>

      {/* Phase pip strip */}
      <div className="flex items-center gap-1.5">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className={
              "h-0.5 flex-1 rounded-full transition-colors " +
              (i < phaseIdx
                ? "bg-cyan-400/70"
                : i === phaseIdx
                  ? "bg-cyan-400 animate-pulse"
                  : "bg-zinc-800")
            }
          />
        ))}
      </div>
    </div>
  );
}
