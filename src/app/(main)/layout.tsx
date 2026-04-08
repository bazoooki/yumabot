"use client";

import { Suspense } from "react";
import { Header } from "@/components/header";
import { TabNav } from "@/components/tab-nav";
import { UserPicker } from "@/components/user-picker";
import { CardsProvider, useCards } from "@/providers/cards-provider";
import { useMarketStream } from "@/lib/market/use-market-stream";

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

      {/* Main content */}
      {error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3 max-w-md">
            <p className="text-lg font-medium text-red-400">
              Error loading cards
            </p>
            <p className="text-sm text-zinc-500">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-zinc-500">Loading cards...</p>
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
