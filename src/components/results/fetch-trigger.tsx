"use client";

import { useState } from "react";
import { Download, Loader2, Check, AlertCircle } from "lucide-react";

export function FetchTrigger({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleFetch = async () => {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/results/fetch?type=LIVE", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Failed to fetch");
        return;
      }

      setStatus("success");
      setMessage(
        `GW ${data.gameWeek}: ${data.fetched} fetched, ${data.skipped} skipped`,
      );
      onComplete();
    } catch {
      setStatus("error");
      setMessage("Network error");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleFetch}
        disabled={status === "loading"}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        {status === "loading" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : status === "success" ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : status === "error" ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {status === "loading" ? "Fetching..." : "Fetch Results"}
      </button>
      {message && (
        <span
          className={`text-[11px] ${status === "error" ? "text-red-400" : "text-zinc-500"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
