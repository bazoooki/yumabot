import WebSocket from "ws";
import { EventEmitter } from "events";
import type { RawTokenOffer } from "./types";
import { processOffer } from "./anomaly-engine";

const WS_URL = "wss://ws.sorare.com/cable";

const TOKEN_OFFER_QUERY = `tokenOfferWasUpdated {
  dealStatus
  blockchainId
  id
  status
  type
  acceptedAt
  createdAt
  sender {
    ... on User { slug }
  }
  actualReceiver {
    ... on User { slug }
  }
  senderSide {
    wei
    anyCards {
      assetId
      ... on Card {
        slug
        rarity
        player {
          id
          displayName
          position
          activeClub { name }
        }
      }
    }
  }
  receiverSide {
    wei
    anyCards {
      assetId
      ... on Card {
        slug
        rarity
        player {
          id
          displayName
          position
          activeClub { name }
        }
      }
    }
  }
}`;

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

class MarketWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private clientCount = 0;
  private _status: ConnectionStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;
  private reconnectDelay = 1000;
  private identifier: string = "";

  get status() {
    return this._status;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.emit("status", { connected: status === "connected", status });
  }

  addClient() {
    this.clientCount++;
    if (this.clientCount === 1) {
      this.connect();
    }
  }

  removeClient() {
    this.clientCount = Math.max(0, this.clientCount - 1);
    if (this.clientCount === 0) {
      this.disconnect();
    }
  }

  private connect() {
    if (this.ws) return;

    const apiKey = process.env.SORARE_API_KEY;
    if (!apiKey) {
      console.error("[Market WS] SORARE_API_KEY not set");
      this.setStatus("error");
      return;
    }

    this.setStatus("connecting");
    this.reconnectDelay = 1000;

    this.identifier = JSON.stringify({
      channel: "GraphqlChannel",
      channelId: Math.random().toString(36).substring(2, 8),
    });

    try {
      this.ws = new WebSocket(WS_URL, undefined, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      this.ws.on("open", () => {
        console.log("[Market WS] Connection opened");
        this.lastHeartbeat = Date.now();
        this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), 10000);
      });

      this.ws.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          this.handleMessage(data);
        } catch {
          // ignore malformed messages
        }
      });

      this.ws.on("close", () => {
        console.log("[Market WS] Connection closed");
        this.cleanup();
        this.setStatus("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[Market WS] Error:", err.message);
        this.cleanup();
        this.setStatus("error");
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error("[Market WS] Failed to create connection:", err);
      this.setStatus("error");
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: Record<string, unknown>) {
    const type = data.type as string | undefined;

    switch (type) {
      case "welcome":
        // Send subscribe command
        this.send({ identifier: this.identifier, command: "subscribe" });
        break;

      case "ping":
        this.lastHeartbeat = Date.now();
        break;

      case "confirm_subscription":
        // Send execute query
        this.send({
          identifier: this.identifier,
          command: "message",
          data: JSON.stringify({
            action: "execute",
            query: `subscription { ${TOKEN_OFFER_QUERY} }`,
          }),
        });
        this.setStatus("connected");
        this.reconnectDelay = 1000;
        console.log("[Market WS] Subscription confirmed");
        break;

      case "reject_subscription":
        console.error("[Market WS] Subscription rejected");
        this.setStatus("error");
        break;

      case "disconnect":
        this.ws?.close();
        break;

      default:
        // Data message
        this.handleOfferMessage(data.message as Record<string, unknown>);
        break;
    }
  }

  private async handleOfferMessage(message: Record<string, unknown>) {
    if (!message) return;

    const offer = (message as { result?: { data?: { tokenOfferWasUpdated?: RawTokenOffer } } })
      ?.result?.data?.tokenOfferWasUpdated;

    if (!offer) return;

    // Only process accepted offers
    if (offer.status !== "accepted") return;

    const card =
      offer.receiverSide?.anyCards?.[0] || offer.senderSide?.anyCards?.[0];
    const player = card?.player;
    if (!player || !card) return;

    const priceWei =
      offer.receiverSide?.wei || offer.senderSide?.wei || "0";
    const priceEth = parseFloat(priceWei) / 1e18;

    const parsed = {
      offerId: offer.id,
      playerSlug: player.id,
      playerName: player.displayName,
      position: player.position || null,
      rarity: (card.rarity || "unknown").toLowerCase(),
      priceWei,
      priceEth,
      buyerSlug: offer.actualReceiver?.slug || null,
      sellerSlug: offer.sender?.slug || null,
      clubName: player.activeClub?.name || null,
      cardSlug: card.slug || null,
    };

    this.emit("offer", parsed);

    // Run anomaly detection
    try {
      const alert = await processOffer(parsed);
      if (alert) {
        this.emit("alert", alert);
      }
    } catch (err) {
      console.error("[Market WS] Anomaly engine error:", err);
    }
  }

  private send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private checkHeartbeat() {
    if (!this.lastHeartbeat) return;
    if (Date.now() - this.lastHeartbeat > 15000) {
      console.log("[Market WS] Heartbeat timeout, reconnecting");
      this.ws?.close();
    }
  }

  private cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.clientCount === 0) return;
    if (this.reconnectTimer) return;

    console.log(`[Market WS] Reconnecting in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.clientCount > 0) {
        this.connect();
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
    console.log("[Market WS] Disconnected (no clients)");
  }
}

// Singleton via globalThis (same pattern as db.ts)
const globalForWs = globalThis as { marketWsManager?: MarketWebSocketManager };

export const wsManager =
  globalForWs.marketWsManager ?? new MarketWebSocketManager();

if (process.env.NODE_ENV !== "production") {
  globalForWs.marketWsManager = wsManager;
}
