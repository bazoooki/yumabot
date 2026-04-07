import { NextRequest, NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { UPCOMING_FIXTURE_QUERY, CURRENT_FIXTURE_QUERY } from "@/lib/queries";
import type { Fixture } from "@/lib/types";

interface FixtureResponse {
  so5: {
    so5Fixture: Fixture;
  };
}

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get("type") ?? "upcoming";
    const query =
      type === "live" ? CURRENT_FIXTURE_QUERY : UPCOMING_FIXTURE_QUERY;

    const result = await sorareClient.request<FixtureResponse>(query);

    const fixture = result?.so5?.so5Fixture;
    if (!fixture) {
      return NextResponse.json(
        { error: `No ${type} fixture found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ fixture });
  } catch (error: unknown) {
    console.error("Error fetching fixture:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch fixture";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
