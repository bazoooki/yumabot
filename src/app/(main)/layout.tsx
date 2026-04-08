"use client";

import { Suspense } from "react";
import { Header } from "@/components/header";
import { TabNav } from "@/components/tab-nav";
import { UserPicker } from "@/components/user-picker";
import { CardsProvider, useCards } from "@/providers/cards-provider";
import { useMarketStream } from "@/lib/market/use-market-stream";
import { CardsLoading } from "@/components/ui/cards-loading";
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
        <CardsLoading userSlug={userSlug} />
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
