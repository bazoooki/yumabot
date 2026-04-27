import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/in-season/drafts?fixtureSlug=...&userSlug=...
// Lists drafts owned by `userSlug` (the helper) for the given fixture, across
// all competitions. Used by the dashboard to mark "has draft" + by the clan
// helper view to list drafts saved on behalf of others.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userSlug = searchParams.get("userSlug");
  const fixtureSlug = searchParams.get("fixtureSlug");

  if (!userSlug || !fixtureSlug) {
    return NextResponse.json(
      { error: "Missing userSlug or fixtureSlug" },
      { status: 400 },
    );
  }

  const drafts = await prisma.inSeasonDraft.findMany({
    where: { userSlug, fixtureSlug },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      id: d.id,
      userSlug: d.userSlug,
      forUserSlug: d.forUserSlug,
      competitionSlug: d.competitionSlug,
      fixtureSlug: d.fixtureSlug,
      payload: JSON.parse(d.payload),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}
