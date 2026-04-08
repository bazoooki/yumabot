"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface CardsLoadingProps {
  userSlug: string;
}

const PHASES = [
  { message: "Connecting to Sorare...", delay: 3000 },
  { message: "Fetching your cards...", delay: 5000 },
  { message: "Processing your collection...", delay: 7000 },
  { message: "Almost there \u2014 large collections take a moment", delay: Infinity },
];

export function CardsLoading({ userSlug }: CardsLoadingProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const phase = PHASES[phaseIndex];
    if (phaseIndex < PHASES.length - 1) {
      timerRef.current = setTimeout(() => {
        setPhaseIndex((i) => i + 1);
      }, phase.delay);
    }
    return () => clearTimeout(timerRef.current);
  }, [phaseIndex]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 md:gap-6 px-6">
      <div className="w-12 h-12 rounded-full bg-purple-600/15 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-base md:text-lg font-bold text-foreground">
          Loading your portfolio
        </h3>
        <p className="text-sm text-muted-foreground transition-opacity duration-300">
          {PHASES[phaseIndex].message}
        </p>
      </div>

      <div className="w-full max-w-xs">
        <div className="h-1.5 bg-secondary/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-purple-500 rounded-full animate-indeterminate" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground/60">
        @{userSlug}
      </p>
    </div>
  );
}
