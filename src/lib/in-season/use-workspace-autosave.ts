"use client";

import { useEffect, useRef, useState } from "react";
import {
  useWorkspaceStore,
  selectWorkspacePayload,
  type WorkspacePayload,
} from "./workspace-store";

const DEBOUNCE_MS = 1000;

export interface AutosaveStatus {
  savedAt: Date | null;
  isFlushing: boolean;
  error: string | null;
}

interface PutArgs {
  userSlug: string;
  forUserSlug: string;
  fixtureSlug: string;
  competitionSlug: string;
  payload: WorkspacePayload;
}

async function putDraft({
  userSlug,
  forUserSlug,
  fixtureSlug,
  competitionSlug,
  payload,
}: PutArgs): Promise<void> {
  const res = await fetch(`/api/in-season/drafts/${competitionSlug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userSlug, forUserSlug, fixtureSlug, payload }),
  });
  if (!res.ok) {
    throw new Error(`autosave: ${res.status}`);
  }
}

export function useWorkspaceAutosave(): AutosaveStatus {
  const dirty = useWorkspaceStore((s) => s.dirty);
  const userSlug = useWorkspaceStore((s) => s.userSlug);
  const forUserSlug = useWorkspaceStore((s) => s.forUserSlug);
  const competitionSlug = useWorkspaceStore((s) => s.competitionSlug);
  const fixtureSlug = useWorkspaceStore((s) => s.fixtureSlug);
  const markClean = useWorkspaceStore((s) => s.markClean);

  const [status, setStatus] = useState<AutosaveStatus>({
    savedAt: null,
    isFlushing: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush helper that snapshots the latest payload at call time.
  const flush = useRef(async () => {
    const state = useWorkspaceStore.getState();
    if (!state.dirty) return;
    if (
      !state.userSlug ||
      !state.forUserSlug ||
      !state.competitionSlug ||
      !state.fixtureSlug
    ) {
      return;
    }
    setStatus((s) => ({ ...s, isFlushing: true, error: null }));
    try {
      await putDraft({
        userSlug: state.userSlug,
        forUserSlug: state.forUserSlug,
        fixtureSlug: state.fixtureSlug,
        competitionSlug: state.competitionSlug,
        payload: selectWorkspacePayload(state),
      });
      markClean();
      setStatus({ savedAt: new Date(), isFlushing: false, error: null });
    } catch (err) {
      setStatus({
        savedAt: null,
        isFlushing: false,
        error: err instanceof Error ? err.message : "save failed",
      });
    }
  });

  // Debounced save whenever `dirty` flips on (and identity is set).
  useEffect(() => {
    if (!dirty) return;
    if (!userSlug || !forUserSlug || !competitionSlug || !fixtureSlug) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush.current(), DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, userSlug, forUserSlug, competitionSlug, fixtureSlug]);

  // Best-effort flush on tab close.
  useEffect(() => {
    const onBeforeUnload = () => {
      const state = useWorkspaceStore.getState();
      if (
        !state.dirty ||
        !state.userSlug ||
        !state.forUserSlug ||
        !state.competitionSlug ||
        !state.fixtureSlug
      ) {
        return;
      }
      // Use sendBeacon for reliability during unload — fire-and-forget.
      const body = JSON.stringify({
        userSlug: state.userSlug,
        forUserSlug: state.forUserSlug,
        fixtureSlug: state.fixtureSlug,
        payload: selectWorkspacePayload(state),
      });
      navigator.sendBeacon(
        `/api/in-season/drafts/${state.competitionSlug}`,
        new Blob([body], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return status;
}
