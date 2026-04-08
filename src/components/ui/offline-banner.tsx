"use client";

import { useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();

  useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success("Back online", { duration: 3000 });
    }
  }, [wasOffline, isOnline]);

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm",
        "animate-in fade-in slide-in-from-top duration-300",
      )}
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You're offline. Some features may not work until you reconnect.</span>
    </div>
  );
}
