import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

/** Map raw errors to user-friendly messages */
function friendlyMessage(error: Error): string {
  const msg = error.message.toLowerCase();
  if (msg.includes("429") || msg.includes("rate limit")) {
    return "Rate limited — retrying in a few seconds";
  }
  if (msg.includes("500") || msg.includes("internal server")) {
    return "Something went wrong. Try again";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
    return "Can't reach server. Check your connection";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "Request timed out. Try again";
  }
  return error.message;
}

export function QueryError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-zinc-400">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-zinc-300">{friendlyMessage(error)}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
