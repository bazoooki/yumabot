"use client";

import { Suspense } from "react";
import { Header } from "@/components/header";
import { TabNav } from "@/components/tab-nav";
import { UserPicker } from "@/components/user-picker";
import { CardsProvider, useCards } from "@/providers/cards-provider";
import { useMarketStream } from "@/lib/market/use-market-stream";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { OfflineBanner } from "@/components/ui/offline-banner";

function MarketStreamKeepAlive() {
  useMarketStream();
  return null;
}

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { userSlug, cards, isLoading, error, handleUserSelect } = useCards();

  if (!userSlug) {
    return <UserPicker onSelect={handleUserSelect} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <MarketStreamKeepAlive />
      <Header
        userSlug={userSlug}
        onUserChange={async (newSlug: string) => handleUserSelect(newSlug)}
      />
      <TabNav />
      <OfflineBanner />

      {/* Main content */}
      {error ? (
        <QueryError error={error instanceof Error ? error : new Error("Failed to load cards")} retry={() => window.location.reload()} />
      ) : isLoading ? (
        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Quick links skeleton */}
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <main className="flex flex-1 overflow-hidden md:pb-0 pb-16">
          {children}
        </main>
      )}
    </div>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <CardsProvider>
        <MainLayoutInner>{children}</MainLayoutInner>
      </CardsProvider>
    </Suspense>
  );
}
