"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { SorareCard } from "@/lib/types";
import { getToolsForScreen, type ToolHandler, type ToolDefinition } from "./tool-registry";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface RichMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

/** Simplified display message (for UI) */
interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallStatus {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending" | "executed" | "error";
  result?: string;
  metadata?: Record<string, unknown>;
}

const MAX_HISTORY = 10;
const MAX_TOOL_ROUNDS = 3;

/**
 * Parse an SSE stream from /api/ai/chat.
 * Returns accumulated text, tool calls with their raw data, and the stop_reason.
 */
async function parseStream(
  res: Response,
  onTextDelta: (text: string) => void,
  onToolUse: (tc: { id: string; name: string; input: Record<string, unknown> }) => void,
): Promise<{ text: string; toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>; stopReason: string }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  const collectedToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  let stopReason = "end_turn";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7);
      } else if (line.startsWith("data: ") && eventType) {
        const data = JSON.parse(line.slice(6));

        if (eventType === "text_delta") {
          accumulatedText += data.text;
          onTextDelta(accumulatedText);
        } else if (eventType === "tool_use") {
          collectedToolCalls.push({ id: data.id, name: data.name, input: data.input });
          onToolUse(data);
        } else if (eventType === "done") {
          stopReason = data.stop_reason || "end_turn";
        } else if (eventType === "error") {
          throw new Error(data.message);
        }
        eventType = "";
      }
    }
  }

  return { text: accumulatedText, toolCalls: collectedToolCalls, stopReason };
}

export function useCommandBar(activeTab: string, cards: SorareCard[]) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallStatus[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const tools = useMemo(
    () => getToolsForScreen(activeTab, cards),
    [activeTab, cards],
  );

  const toolHandlerMap = useMemo(() => {
    const map = new Map<string, ToolHandler>();
    for (const t of tools) {
      map.set(t.definition.name, t);
    }
    return map;
  }, [tools]);

  const toolDefinitions = useMemo(
    () => tools.map((t) => t.definition),
    [tools],
  );

  const sendMessage = useCallback(
    async (userMessage: string, contextSnapshot?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Display messages for UI
      const displayHistory: DisplayMessage[] = [
        ...messages.slice(-(MAX_HISTORY - 1)),
        { role: "user" as const, content: userMessage },
      ];
      setMessages(displayHistory);
      setStreamedText("");
      setToolCalls([]);
      setError(null);
      setIsStreaming(true);

      try {
        // Rich messages track the full Anthropic conversation (with content blocks)
        let richMessages: RichMessage[] = displayHistory.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const screenContext = {
          activeTab,
          tools: toolDefinitions,
          contextSnapshot,
        };

        let totalText = "";
        let round = 0;

        // Tool-use loop: keep going while Claude returns tool_use stop_reason
        while (round < MAX_TOOL_ROUNDS) {
          round++;

          const res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: richMessages, screenContext }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          const { text, toolCalls: roundToolCalls, stopReason } = await parseStream(
            res,
            (accumulated) => setStreamedText(totalText + accumulated),
            (tc) => {
              setToolCalls((prev) => [
                ...prev,
                { id: tc.id, name: tc.name, input: tc.input, status: "pending" },
              ]);
            },
          );

          totalText += text;

          // If no tool calls, we're done
          if (roundToolCalls.length === 0 || stopReason !== "tool_use") {
            break;
          }

          // Execute all tool calls locally and collect results
          const toolResults: Array<{ tool_use_id: string; result: string }> = [];

          for (const tc of roundToolCalls) {
            const handler = toolHandlerMap.get(tc.name);
            if (handler) {
              try {
                const rawResult = await handler.execute(tc.input);
                const result = typeof rawResult === "string" ? rawResult : rawResult.text;
                const metadata = typeof rawResult === "object" ? rawResult.metadata : undefined;
                toolResults.push({ tool_use_id: tc.id, result });
                setToolCalls((prev) =>
                  prev.map((t) =>
                    t.id === tc.id ? { ...t, status: "executed", result, metadata } : t,
                  ),
                );
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Tool execution failed";
                toolResults.push({ tool_use_id: tc.id, result: `Error: ${errMsg}` });
                setToolCalls((prev) =>
                  prev.map((t) =>
                    t.id === tc.id ? { ...t, status: "error", result: errMsg } : t,
                  ),
                );
              }
            } else {
              toolResults.push({ tool_use_id: tc.id, result: "Unknown tool" });
            }
          }

          // Build the assistant message with text + tool_use blocks
          const assistantContent: ContentBlock[] = [];
          if (text) {
            assistantContent.push({ type: "text", text });
          }
          for (const tc of roundToolCalls) {
            assistantContent.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.input,
            });
          }

          // Build the user message with tool_result blocks
          const toolResultContent: ContentBlock[] = toolResults.map((tr) => ({
            type: "tool_result" as const,
            tool_use_id: tr.tool_use_id,
            content: tr.result,
          }));

          // Append to rich conversation for the follow-up request
          richMessages = [
            ...richMessages,
            { role: "assistant", content: assistantContent },
            { role: "user", content: toolResultContent },
          ];
        }

        // Save final assistant text to display history
        if (totalText) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: totalText },
          ]);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(
            err instanceof Error ? err.message : "Failed to send message",
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, activeTab, toolDefinitions, toolHandlerMap],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamedText("");
    setToolCalls([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    sendMessage,
    messages,
    streamedText,
    toolCalls,
    isStreaming,
    error,
    reset,
  };
}
