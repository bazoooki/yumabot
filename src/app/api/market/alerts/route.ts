import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AlertRuleType, AlertSeverity } from "@/lib/market/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const alerts = await prisma.marketAlert.findMany({
      where: severity ? { severity } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        ...a,
        ruleType: a.ruleType as AlertRuleType,
        severity: a.severity as AlertSeverity,
        metadata: JSON.parse(a.metadata),
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { id } = await request.json();

    if (!id || typeof id !== "number") {
      return NextResponse.json({ error: "Invalid alert id" }, { status: 400 });
    }

    await prisma.marketAlert.update({
      where: { id },
      data: { acknowledged: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
