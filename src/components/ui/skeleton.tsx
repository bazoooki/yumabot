import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zinc-800", className)} />;
}

/** Card skeleton — matches CardComponent aspect ratio and layout */
export function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="p-2.5 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Offer card skeleton — horizontal row with avatar + text + price */
export function OfferCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

/** Game card skeleton — two teams + score area */
export function GameCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-zinc-700/50 bg-zinc-800/50">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-10" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-full shrink-0" />
          <Skeleton className="h-3.5 w-12" />
        </div>
        <Skeleton className="h-3.5 w-8 shrink-0" />
        <div className="flex-1 flex items-center gap-2 justify-end">
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="w-6 h-6 rounded-full shrink-0" />
        </div>
      </div>
    </div>
  );
}

/** Lineup slot skeleton — matches pitch slot dimensions */
export function LineupSlotSkeleton() {
  return <Skeleton className="h-20 w-full rounded-xl" />;
}

/** Generic stat row skeleton — label + value */
export function StatRowSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-800/40">
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  );
}

/** Lineup card skeleton for live lineups section */
export function LineupCardSkeleton() {
  return (
    <div className="min-w-[280px] shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
