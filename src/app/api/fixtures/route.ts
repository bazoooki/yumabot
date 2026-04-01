import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { UPCOMING_FIXTURE_QUERY } from "@/lib/queries";
import type { Fixture } from "@/lib/types";

interface FixtureResponse {
  so5: {
    so5Fixture: Fixture;
  };
}

export async function GET() {
  try {
    const result =
      await sorareClient.request<FixtureResponse>(UPCOMING_FIXTURE_QUERY);

    const fixture = result?.so5?.so5Fixture;
    if (!fixture) {
      return NextResponse.json(
        { error: "No upcoming fixture found" },
        { status: 404 }
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
