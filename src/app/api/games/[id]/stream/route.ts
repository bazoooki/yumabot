import { NextRequest } from "next/server";
import { wsManager } from "@/lib/market/ws-manager";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Ensure WS is connected (add a client if needed)
      wsManager.addClient();
      wsManager.subscribeToGame(gameId);

      const sendSSE = (event: string, data: unknown) => {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {
          // Stream closed
        }
      };

      // Send initial status
      sendSSE("status", {
        connected: wsManager.status === "connected",
        gameId,
      });

      // Listen for game updates (filter to this game)
      const onGameUpdated = (gameData: Record<string, unknown>) => {
        if (gameData.id === gameId) {
          console.log(
            `[Game Stream] Sending update for ${gameId}:`,
            JSON.stringify(gameData).slice(0, 200),
          );
          sendSSE("game_update", gameData);
        }
      };

      const onStatus = (status: unknown) => sendSSE("status", status);

      wsManager.on("game_updated", onGameUpdated);
      wsManager.on("status", onStatus);

      // Heartbeat every 15s
      const heartbeat = setInterval(() => {
        sendSSE("heartbeat", {});
      }, 15000);

      // Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        wsManager.off("game_updated", onGameUpdated);
        wsManager.off("status", onStatus);
        clearInterval(heartbeat);
        wsManager.unsubscribeFromGame(gameId);
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
