import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ competitionSlug: string }>;
}

// Helper: pull identity from query (GET/DELETE) or body (PUT). The helper
// (`userSlug`) is the logged-in account that owns the draft row; `forUserSlug`
// is who the draft is BUILT FOR (self or clan member). They differ in the
// "ba-zii helps nimrodel" flow.
function readIdentity(searchParams: URLSearchParams) {
  return {
    userSlug: searchParams.get("userSlug"),
    forUserSlug: searchParams.get("forUserSlug") ?? searchParams.get("userSlug"),
    fixtureSlug: searchParams.get("fixtureSlug"),
  };
}

export async function GET(request: Request, ctx: RouteParams) {
  const { competitionSlug } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const { userSlug, forUserSlug, fixtureSlug } = readIdentity(searchParams);

  if (!userSlug || !forUserSlug || !fixtureSlug) {
    return NextResponse.json(
      { error: "Missing userSlug or fixtureSlug" },
      { status: 400 },
    );
  }

  const draft = await prisma.inSeasonDraft.findUnique({
    where: {
      userSlug_forUserSlug_competitionSlug_fixtureSlug: {
        userSlug,
        forUserSlug,
        competitionSlug,
        fixtureSlug,
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ draft: null });
  }

  return NextResponse.json({
    draft: {
      id: draft.id,
      userSlug: draft.userSlug,
      forUserSlug: draft.forUserSlug,
      competitionSlug: draft.competitionSlug,
      fixtureSlug: draft.fixtureSlug,
      payload: JSON.parse(draft.payload),
      updatedAt: draft.updatedAt.toISOString(),
    },
  });
}

interface PutBody {
  userSlug: string;
  forUserSlug?: string;
  fixtureSlug: string;
  payload: unknown;
}

export async function PUT(request: Request, ctx: RouteParams) {
  const { competitionSlug } = await ctx.params;
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userSlug = body.userSlug;
  const forUserSlug = body.forUserSlug ?? body.userSlug;
  const fixtureSlug = body.fixtureSlug;

  if (!userSlug || !forUserSlug || !fixtureSlug || !body.payload) {
    return NextResponse.json(
      { error: "Missing userSlug, fixtureSlug, or payload" },
      { status: 400 },
    );
  }

  const payloadJson = JSON.stringify(body.payload);

  const draft = await prisma.inSeasonDraft.upsert({
    where: {
      userSlug_forUserSlug_competitionSlug_fixtureSlug: {
        userSlug,
        forUserSlug,
        competitionSlug,
        fixtureSlug,
      },
    },
    create: {
      userSlug,
      forUserSlug,
      competitionSlug,
      fixtureSlug,
      payload: payloadJson,
    },
    update: {
      payload: payloadJson,
    },
  });

  return NextResponse.json({
    draft: {
      id: draft.id,
      userSlug: draft.userSlug,
      forUserSlug: draft.forUserSlug,
      competitionSlug: draft.competitionSlug,
      fixtureSlug: draft.fixtureSlug,
      updatedAt: draft.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(request: Request, ctx: RouteParams) {
  const { competitionSlug } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const { userSlug, forUserSlug, fixtureSlug } = readIdentity(searchParams);

  if (!userSlug || !forUserSlug || !fixtureSlug) {
    return NextResponse.json(
      { error: "Missing userSlug or fixtureSlug" },
      { status: 400 },
    );
  }

  await prisma.inSeasonDraft
    .delete({
      where: {
        userSlug_forUserSlug_competitionSlug_fixtureSlug: {
          userSlug,
          forUserSlug,
          competitionSlug,
          fixtureSlug,
        },
      },
    })
    .catch(() => null); // tolerate "not found"

  return NextResponse.json({ ok: true });
}
