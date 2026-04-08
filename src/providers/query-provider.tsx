"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            networkMode: "offlineFirst", // serve cached data when offline
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors (except 429)
              if (error instanceof Error) {
                const msg = error.message;
                if (msg.includes("429")) return failureCount < 3;
                if (msg.includes("4") && msg.match(/\b4\d{2}\b/)) return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
