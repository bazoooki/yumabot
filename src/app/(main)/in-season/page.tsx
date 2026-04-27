"use client";

import { useCards } from "@/providers/cards-provider";
import { InSeasonWorkspace } from "@/components/in-season-workspace/workspace";

// Bare `/in-season` mounts the workspace against the logged-in user's gallery
// without rewriting the URL. To help a clan member, navigate to
// `/in-season/<otherUserSlug>` explicitly.
export default function InSeasonPage() {
  const { userSlug } = useCards();
  if (!userSlug) {
    return (
      <div className="flex-1 grid place-items-center text-zinc-500 text-sm">
        Loading…
      </div>
    );
  }
  return <InSeasonWorkspace forUserSlug={userSlug} leagueSlug={null} />;
}
