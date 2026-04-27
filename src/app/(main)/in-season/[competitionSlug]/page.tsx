"use client";

import { use } from "react";
import { InSeasonWorkspace } from "@/components/in-season-workspace/workspace";

export default function Page({
  params,
}: {
  params: Promise<{ competitionSlug: string }>;
}) {
  const { competitionSlug } = use(params);
  return <InSeasonWorkspace competitionSlug={competitionSlug} />;
}
