import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
  RawTokenOffer,
  RawCardUpdate,
  TradeType,
  CounterCard,
  OfferLifecycleEvent,
  OfferLifecycleStatus,
  CardStateEvent,
} from "./types";
import { processOffer, processOfferLifecycle, processCardState } from "./anomaly-engine";

const WS_URL = "wss://ws.sorare.com/cable";

// ── Subscription Queries ──

// Depth limit: 7 without APIKEY. Max path now:
// subscription > tokenOfferWasUpdated > senderSide > anyCards > Card > player > activeClub = 7
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
        grade
        power
        seasonYear
        serialNumber
        player {
          id
          slug
          displayName
          position
          averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
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
        grade
        power
        seasonYear
        serialNumber
        player {
          id
          slug
          displayName
          position
          averageScore(type: LAST_FIFTEEN_SO5_AVERAGE_SCORE)
          activeClub { name }
        }
      }
    }
  }
}`;

// anyCardWasUpdated returns AnyCardSubscription { eventType, card }
// Depth: subscription > anyCardWasUpdated > card > Card > liveSo5Lineup > so5Leaderboard = 6
const ANY_CARD_UPDATED_QUERY = `anyCardWasUpdated(sports: [FOOTBALL]) {
  eventType
  card {
    slug
    rarity
    power
    onSale
    ... on Card {
      liveSo5Lineup {
        so5Leaderboard { title }
      }
    }
    player {
      slug
      displayName
      position
    }
    userOwner {
      slug
    }
  }
}`;

// ── Multi-Subscription Types ──

type SubName = "tokenOfferWasUpdated" | "anyCardWasUpdated";

interface SubEntry {
  name: SubName;
  identifier: string;
  query: string;
  confirmed: boolean;
}

const SUB_QUERIES: Record<SubName, string> = {
  tokenOfferWasUpdated: TOKEN_OFFER_QUERY,
  anyCardWasUpdated: ANY_CARD_UPDATED_QUERY,
};

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

class MarketWebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private clientCount = 0;
  private _status: ConnectionStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeat = 0;
  private reconnectDelay = 1000;

  /** Multi-subscription registry */
  private subscriptions = new Map<SubName, SubEntry>();
  private _advancedEnabled = false;
  private _advancedClientCount = 0;

  /** Deduplication maps */
  private _seenOffers = new Map<string, string>();
  private _seenLifecycle = new Map<string, string>();
  private _seenCardStates = new Map<string, { onSale: boolean; inLineup: boolean }>();

  get status() {
    return this._status;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.emit("status", { connected: status === "connected", status });
  }

  // ── Client management ──

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

  addAdvancedClient() {
    this._advancedClientCount++;
    if (this._advancedClientCount === 1) {
      this.enableAdvanced();
    }
  }

  removeAdvancedClient() {
    this._advancedClientCount = Math.max(0, this._advancedClientCount - 1);
    if (this._advancedClientCount === 0) {
      this.disableAdvanced();
    }
  }

  // ── Advanced Analytics Subscription Control ──

  private enableAdvanced() {
    if (this._advancedEnabled) return;
    this._advancedEnabled = true;

    // Add anyCardWasUpdated subscription
    const entry = this.createSubEntry("anyCardWasUpdated");
    this.subscriptions.set("anyCardWasUpdated", entry);

    // If WS is already open, subscribe immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ identifier: entry.identifier, command: "subscribe" });
    }
  }

  private disableAdvanced() {
    if (!this._advancedEnabled) return;
    this._advancedEnabled = false;

    const entry = this.subscriptions.get("anyCardWasUpdated");
    if (entry && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ identifier: entry.identifier, command: "unsubscribe" });
    }
    this.subscriptions.delete("anyCardWasUpdated");
  }

  private createSubEntry(name: SubName): SubEntry {
    return {
      name,
      identifier: JSON.stringify({
        channel: "GraphqlChannel",
        channelId: `${name}_${Math.random().toString(36).substring(2, 8)}`,
      }),
      query: SUB_QUERIES[name],
      confirmed: false,
    };
  }

  // ── Connection ──

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

    // Initialize subscription entries
    this.subscriptions.clear();
    this.subscriptions.set("tokenOfferWasUpdated", this.createSubEntry("tokenOfferWasUpdated"));
    if (this._advancedEnabled) {
      this.subscriptions.set("anyCardWasUpdated", this.createSubEntry("anyCardWasUpdated"));
    }

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

  // ── Message Routing ──

  private handleMessage(data: Record<string, unknown>) {
    const type = data.type as string | undefined;

    switch (type) {
      case "welcome":
        // Subscribe all active channels
        for (const entry of this.subscriptions.values()) {
          this.send({ identifier: entry.identifier, command: "subscribe" });
        }
        break;

      case "ping":
        this.lastHeartbeat = Date.now();
        break;

      case "confirm_subscription": {
        const confirmedId = data.identifier as string;
        const entry = this.findEntryByIdentifier(confirmedId);
        if (entry) {
          entry.confirmed = true;
          // Send the GraphQL execute query for this subscription
          this.send({
            identifier: entry.identifier,
            command: "message",
            data: JSON.stringify({
              action: "execute",
              query: `subscription { ${entry.query} }`,
            }),
          });
          console.log(`[Market WS] Subscription confirmed: ${entry.name}`);
        }
        // Set connected once base subscription is confirmed
        const baseEntry = this.subscriptions.get("tokenOfferWasUpdated");
        if (baseEntry?.confirmed) {
          this.setStatus("connected");
          this.reconnectDelay = 1000;
        }
        break;
      }

      case "reject_subscription": {
        const rejectedId = data.identifier as string;
        const entry = this.findEntryByIdentifier(rejectedId);
        console.error(`[Market WS] Subscription rejected: ${entry?.name || rejectedId}`);
        // Only set error if base subscription was rejected
        if (entry?.name === "tokenOfferWasUpdated") {
          this.setStatus("error");
        }
        break;
      }

      case "disconnect":
        this.ws?.close();
        break;

      default: {
        const msg = data.message as Record<string, unknown> | undefined;
        const result = msg?.result as Record<string, unknown> | undefined;

        if (result?.errors) {
          console.error("[Market WS] GraphQL subscription error:", JSON.stringify(result.errors));
          return;
        }

        const resultData = result?.data as Record<string, unknown> | undefined;
        if (!resultData) return;

        // Route to the correct handler based on which key is present
        if (resultData.tokenOfferWasUpdated) {
          this.handleOfferMessage(msg as Record<string, unknown>);
        } else if (resultData.anyCardWasUpdated) {
          // AnyCardSubscription has { eventType, card }
          const sub = resultData.anyCardWasUpdated as { eventType?: string; card?: RawCardUpdate };
          if (sub.card) {
            this.handleCardStateMessage(sub.card, sub.eventType);
          }
        }
        break;
      }
    }
  }

  private findEntryByIdentifier(identifier: string): SubEntry | undefined {
    for (const entry of this.subscriptions.values()) {
      if (entry.identifier === identifier) return entry;
    }
    return undefined;
  }

  // ── Handler: tokenOfferWasUpdated ──
  // When advanced analytics is ON, non-accepted offers are emitted as lifecycle events.
  // Accepted offers always flow through the normal offer pipeline.

  private async handleOfferMessage(message: Record<string, unknown>) {
    if (!message) return;

    const offer = (message as { result?: { data?: { tokenOfferWasUpdated?: RawTokenOffer } } })
      ?.result?.data?.tokenOfferWasUpdated;

    if (!offer) return;

    // When advanced is on, emit lifecycle events for ALL statuses
    if (this._advancedEnabled && offer.status !== "accepted") {
      this.emitOfferLifecycleEvent(offer);
      return;
    }

    // Only completed sales for the main offer pipeline
    if (offer.status !== "accepted") return;

    // Deduplicate
    if (this._seenOffers.has(offer.id)) return;
    this._seenOffers.set(offer.id, offer.status);
    if (this._seenOffers.size > 5000) {
      const keys = [...this._seenOffers.keys()];
      for (let i = 0; i < 1000; i++) this._seenOffers.delete(keys[i]);
    }

    const senderCards = offer.senderSide?.anyCards || [];
    const receiverCards = offer.receiverSide?.anyCards || [];

    // The "main" card is the one being sold/traded — pick from either side
    const card = receiverCards[0] || senderCards[0];
    const player = card?.player;
    if (!player || !card) return;

    // Skip if no meaningful player data
    if (!player.displayName) return;

    // Skip non-tradeable rarities (common, custom_series)
    const rarity = (card.rarity || "").toLowerCase();
    if (rarity && !["limited", "rare", "super_rare", "unique"].includes(rarity)) return;

    const priceWei =
      offer.receiverSide?.wei || offer.senderSide?.wei || "0";
    const priceEth = parseFloat(priceWei) / 1e18;

    // Determine trade type
    const hasSenderCards = senderCards.length > 0;
    const hasReceiverCards = receiverCards.length > 0;
    const hasEth = priceEth > 0;
    let tradeType: TradeType = "sale";
    if (hasSenderCards && hasReceiverCards) {
      tradeType = hasEth ? "mixed" : "swap";
    }

    // Build counter cards info (the "other side" cards in a swap/mixed trade)
    let counterCards: CounterCard[] | null = null;
    if (tradeType !== "sale") {
      // Counter cards = the side opposite to our main card
      const otherSide = receiverCards[0] === card ? senderCards : receiverCards;
      counterCards = otherSide
        .filter((c) => c.player?.displayName)
        .map((c) => ({
          playerName: c.player!.displayName,
          rarity: (c.rarity || "unknown").toLowerCase(),
        }));
    }

    const parsed = {
      offerId: offer.id,
      playerSlug: player.slug || player.id,
      playerName: player.displayName,
      position: player.position || null,
      rarity: (card.rarity || "unknown").toLowerCase(),
      priceWei,
      priceEth,
      buyerSlug: offer.actualReceiver?.slug || null,
      sellerSlug: offer.sender?.slug || null,
      clubName: player.activeClub?.name || null,
      cardSlug: card.slug || null,
      offerType: offer.type || null,
      offerStatus: offer.status || null,
      dealStatus: offer.dealStatus || null,
      receivedAt: new Date().toISOString(),
      upcomingGame: null, // upcomingGames removed from query to stay under depth limit
      avgScore: player.averageScore ?? null,
      tradeType,
      cardGrade: card.grade ?? null,
      cardPower: card.power ?? null,
      cardSeason: card.seasonYear ?? null,
      cardSerial: card.serialNumber ?? null,
      counterCards,
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

  // ── Offer lifecycle from tokenOfferWasUpdated (non-accepted statuses) ──

  private async emitOfferLifecycleEvent(offer: RawTokenOffer) {
    try {
      const dedupeKey = `${offer.id}:${offer.status}`;
      if (this._seenLifecycle.has(dedupeKey)) return;
      this._seenLifecycle.set(dedupeKey, offer.status);
      if (this._seenLifecycle.size > 10000) {
        const keys = [...this._seenLifecycle.keys()];
        for (let i = 0; i < 2000; i++) this._seenLifecycle.delete(keys[i]);
      }

      const senderCards = offer.senderSide?.anyCards || [];
      const receiverCards = offer.receiverSide?.anyCards || [];
      const card = receiverCards[0] || senderCards[0];
      const player = card?.player;
      if (!player?.displayName || !card) return;

      const rarity = (card.rarity || "").toLowerCase();
      if (rarity && !["limited", "rare", "super_rare", "unique"].includes(rarity)) return;

      const priceWei = offer.receiverSide?.wei || offer.senderSide?.wei || "0";
      const priceEth = parseFloat(priceWei) / 1e18;

      // Map Sorare status to our lifecycle status
      const status = this.mapOfferStatus(offer.status);

      // Track price per offer ID to detect price changes
      const prevKey = `${offer.id}:price`;
      const previousPriceStr = this._seenLifecycle.get(prevKey);
      const previousPriceEth = previousPriceStr ? parseFloat(previousPriceStr) : null;
      this._seenLifecycle.set(prevKey, String(priceEth));

      // Detect price update: same offer seen before at a different price
      const actualStatus =
        previousPriceEth !== null && previousPriceEth !== priceEth && Math.abs(previousPriceEth - priceEth) > 0.0001
          ? "price_updated" as const
          : status;

      const event: OfferLifecycleEvent = {
        offerId: offer.id,
        playerSlug: player.slug || player.id,
        playerName: player.displayName,
        position: player.position || null,
        rarity,
        priceEth,
        previousPriceEth: actualStatus === "price_updated" ? previousPriceEth : null,
        status: actualStatus,
        sellerSlug: offer.sender?.slug || null,
        cardSlug: card.slug || null,
        clubName: player.activeClub?.name || null,
        receivedAt: new Date().toISOString(),
      };

      this.emit("offer_lifecycle", event);

      const alert = await processOfferLifecycle(event);
      if (alert) {
        this.emit("alert", alert);
      }
    } catch (err) {
      console.error("[Market WS] Offer lifecycle error:", err);
    }
  }

  private mapOfferStatus(sorareStatus: string): OfferLifecycleStatus {
    const lower = sorareStatus.toLowerCase();
    if (lower === "accepted" || lower === "completed") return "accepted";
    if (lower === "cancelled" || lower === "canceled") return "cancelled";
    if (lower === "expired" || lower === "ended") return "expired";
    if (lower === "rejected") return "rejected";
    if (lower === "opened") return "created";
    return "pending";
  }

  // ── Handler: anyCardWasUpdated (Advanced Analytics) ──

  private async handleCardStateMessage(raw: RawCardUpdate, _eventType?: string) {
    try {
      if (!raw?.slug || !raw.player) return;

      const rarity = (raw.rarity || "").toLowerCase();
      if (rarity && !["limited", "rare", "super_rare", "unique"].includes(rarity)) return;

      // Detect lineup from liveSo5Lineup field
      const inLineup = !!raw.liveSo5Lineup;

      // Check if state actually changed
      const prev = this._seenCardStates.get(raw.slug);
      const currentState = { onSale: !!raw.onSale, inLineup };

      if (prev && prev.onSale === currentState.onSale && prev.inLineup === currentState.inLineup) {
        return; // No meaningful change
      }

      this._seenCardStates.set(raw.slug, currentState);
      if (this._seenCardStates.size > 5000) {
        const keys = [...this._seenCardStates.keys()];
        for (let i = 0; i < 1000; i++) this._seenCardStates.delete(keys[i]);
      }

      // Extract lineup details if present
      const lineupDetails = raw.liveSo5Lineup?.so5Leaderboard?.title
        ? { competitionName: raw.liveSo5Lineup.so5Leaderboard.title, gameDate: "" }
        : null;

      const ownerSlug = raw.userOwner?.slug || null;

      const event: CardStateEvent = {
        cardSlug: raw.slug,
        playerSlug: raw.player.slug || "",
        playerName: raw.player.displayName || "",
        rarity,
        onSale: !!raw.onSale,
        inLineup,
        lineupDetails,
        ownerSlug,
        receivedAt: new Date().toISOString(),
      };

      this.emit("card_state", event);

      const alert = await processCardState(event);
      if (alert) {
        this.emit("alert", alert);
      }
    } catch (err) {
      console.error("[Market WS] Card state handler error:", err);
    }
  }

  // ── Utility ──

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
    // Reset confirmation state
    for (const entry of this.subscriptions.values()) {
      entry.confirmed = false;
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
