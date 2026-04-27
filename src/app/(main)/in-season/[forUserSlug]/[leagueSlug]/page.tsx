"use client";

import { use } from "react";
import { InSeasonWorkspace } from "@/components/in-season-workspace/workspace";

export default function Page({
  params,
}: {
  params: Promise<{ forUserSlug: string; leagueSlug: string }>;
}) {
  const { forUserSlug, leagueSlug } = use(params);
  return (
    <InSeasonWorkspace forUserSlug={forUserSlug} leagueSlug={leagueSlug} />
  );
}
