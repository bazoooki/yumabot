"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "./market-store";
import type {
  MarketOffer,
  MarketAlert,
  MarketConnectionStatus,
  OfferLifecycleEvent,
  CardStateEvent,
} from "./types";

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

export function useMarketStream() {
  const {
    addOffer,
    addAlert,
    setConnectionStatus,
    soundEnabled,
    advancedAnalytics,
    addOfferLifecycleEvent,
    addCardStateEvent,
  } = useMarketStore();
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    setConnectionStatus("connecting");

    const url = advancedAnalytics
      ? "/api/market/stream?advanced=true"
      : "/api/market/stream";
    const es = new EventSource(url);

    es.addEventListener("offer", (e) => {
      try {
        const offer: MarketOffer = JSON.parse(e.data);
        addOffer(offer);
      } catch {
        // ignore
      }
    });

    es.addEventListener("alert", (e) => {
      try {
        const alert: MarketAlert = JSON.parse(e.data);
        addAlert(alert);
        if (soundRef.current && alert.severity === "critical") {
          playAlertSound();
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener("status", (e) => {
      try {
        const { status } = JSON.parse(e.data) as {
          status: MarketConnectionStatus;
        };
        setConnectionStatus(status);
      } catch {
        // ignore
      }
    });

    es.addEventListener("offer_lifecycle", (e) => {
      try {
        const event: OfferLifecycleEvent = JSON.parse(e.data);
        addOfferLifecycleEvent(event);
      } catch {
        // ignore
      }
    });

    es.addEventListener("card_state", (e) => {
      try {
        const event: CardStateEvent = JSON.parse(e.data);
        addCardStateEvent(event);
      } catch {
        // ignore
      }
    });

    es.onopen = () => {
      // Status will come from the server's first status event
    };

    es.onerror = () => {
      setConnectionStatus("error");
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      setConnectionStatus("disconnected");
    };
    // Reconnect when advanced analytics toggle changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedAnalytics]);
}
