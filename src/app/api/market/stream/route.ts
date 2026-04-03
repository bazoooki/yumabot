import { wsManager } from "@/lib/market/ws-manager";
import { cleanupOldOffers } from "@/lib/market/anomaly-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Clean up old data on connection start
  cleanupOldOffers().catch(console.error);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      wsManager.addClient();

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

      wsManager.on("offer", onOffer);
      wsManager.on("alert", onAlert);
      wsManager.on("status", onStatus);

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        sendSSE("heartbeat", {});
      }, 15000);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        wsManager.off("offer", onOffer);
        wsManager.off("alert", onAlert);
        wsManager.off("status", onStatus);
        clearInterval(heartbeat);
        wsManager.removeClient();
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
