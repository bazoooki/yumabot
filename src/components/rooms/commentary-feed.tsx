"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, MessageCircle, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { RoomMessage } from "@/lib/rooms/types";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

export function CommentaryFeed({
  roomId,
  userSlug,
}: {
  roomId: string;
  userSlug: string;
}) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as RoomMessage[]);
    }
    load();
  }, [roomId]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const msg = payload.new as RoomMessage;
          setMessages((prev) => {
            // Deduplicate (optimistic message may already exist)
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Replace optimistic messages from same author with same text
            const withoutOptimistic = prev.filter(
              (m) => !(m.author === msg.author && m.message === msg.message && m.id !== msg.id),
            );
            return [...withoutOptimistic, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || isSending) return;
    setChatInput("");
    setIsSending(true);

    // Optimistic: show message immediately
    const optimistic: RoomMessage = {
      id: crypto.randomUUID(),
      room_id: roomId,
      author: userSlug,
      message: text,
      message_type: "chat",
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from("room_messages").insert({
      room_id: roomId,
      author: userSlug,
      message: text,
      message_type: "chat",
      metadata: {},
    });

    if (error) {
      console.error("Chat insert failed:", error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }

    setIsSending(false);
  }

  return (
    <div className="flex flex-col h-full bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-transparent">
        <div className="p-2 rounded-xl bg-amber-500/10">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">Live Commentary</h3>
          <p className="text-[10px] text-muted-foreground">AI-powered match insights</p>
        </div>
        {messages.length > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground mb-1">Waiting for kickoff</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                AI narrator will provide live commentary once games begin
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-xl px-4 py-3 transition-all duration-200",
                msg.message_type === "narration"
                  ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20"
                  : msg.message_type === "event"
                    ? "bg-secondary/30 border border-border/50"
                    : "bg-secondary/20 border border-border/30"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {msg.message_type === "narration" ? (
                  <div className="p-1 rounded-full bg-amber-500/20">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </div>
                ) : msg.message_type === "event" ? (
                  <div className="p-1 rounded-full bg-primary/20">
                    <Zap className="w-3 h-3 text-primary" />
                  </div>
                ) : (
                  <div className="p-1 rounded-full bg-secondary">
                    <MessageCircle className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    msg.message_type === "narration"
                      ? "text-amber-400"
                      : msg.author === userSlug
                        ? "text-primary"
                        : "text-foreground"
                  )}
                >
                  {msg.author === "ai" ? "AI Narrator" : msg.author}
                  {msg.author === userSlug && (
                    <span className="text-[10px] text-muted-foreground ml-1">(You)</span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {timeAgo(msg.created_at)}
                </span>
              </div>
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  msg.message_type === "narration"
                    ? "text-amber-100/90"
                    : "text-foreground/90"
                )}
              >
                {msg.message}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Chat input */}
      <div className="p-3 border-t border-border/50 bg-card/50">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Say something..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            className="flex-1 px-4 py-2.5 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim() || isSending}
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200",
              chatInput.trim() && !isSending
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send className={cn("w-4 h-4", isSending && "animate-pulse")} />
          </button>
        </div>
      </div>
    </div>
  );
}
