"use client";

import { useState, useEffect, useRef } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Set initial state from navigator
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setWasOffline(true);
      // Clear "wasOffline" after 5 seconds
      timerRef.current = setTimeout(() => setWasOffline(false), 5000);
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isOnline, wasOffline };
}
