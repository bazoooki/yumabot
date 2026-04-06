import { wsManager } from "@/lib/market/ws-manager";
import { cleanupOldData } from "@/lib/market/anomaly-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Clean up old data on connection start
  cleanupOldData().catch(console.error);

  const url = new URL(request.url);
  const wantsAdvanced = url.searchParams.get("advanced") === "true";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      wsManager.addClient();
      if (wantsAdvanced) {
        wsManager.addAdvancedClient();
      }

      const sendSSE = (event: string, data: unknown) => {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Stream closed
        }
      };

      // Send current status immediately
      sendSSE("status", {
        connected: wsManager.status === "connected",
        status: wsManager.status,
      });

      const onOffer = (offer: unknown) => sendSSE("offer", offer);
      const onAlert = (alert: unknown) => sendSSE("alert", alert);
      const onStatus = (status: unknown) => sendSSE("status", status);
      const onOfferLifecycle = (event: unknown) => sendSSE("offer_lifecycle", event);
      const onCardState = (event: unknown) => sendSSE("card_state", event);

      wsManager.on("offer", onOffer);
      wsManager.on("alert", onAlert);
      wsManager.on("status", onStatus);
      if (wantsAdvanced) {
        wsManager.on("offer_lifecycle", onOfferLifecycle);
        wsManager.on("card_state", onCardState);
      }

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        sendSSE("heartbeat", {});
      }, 15000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        wsManager.off("offer", onOffer);
        wsManager.off("alert", onAlert);
        wsManager.off("status", onStatus);
        wsManager.off("offer_lifecycle", onOfferLifecycle);
        wsManager.off("card_state", onCardState);
        clearInterval(heartbeat);
        wsManager.removeClient();
        if (wantsAdvanced) {
          wsManager.removeAdvancedClient();
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
