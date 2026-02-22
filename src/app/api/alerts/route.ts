import { NextRequest, NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { evaluateAndStoreAlerts, listRecentAlerts } from "@/lib/alerts";

export async function GET(req: NextRequest) {
  const user = await getOrCreateSingleUser();
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? limitParam : 20;
  const alerts = await listRecentAlerts(user.id, limit);

  return NextResponse.json({ alerts });
}

export async function POST() {
  const user = await getOrCreateSingleUser();
  const created = await evaluateAndStoreAlerts(user.id);
  return NextResponse.json({ created: created.length });
}
