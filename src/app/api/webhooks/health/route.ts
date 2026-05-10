import { NextRequest, NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { getAutoSyncSecret } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { runLoggedSync } from "@/lib/sync-run";
import { format, parseISO, addDays } from "date-fns";

// Google Health API sends webhook notifications when data changes.
// Set WEBHOOK_SECRET in .env and configure it as the authorizationToken
// when registering the subscriber in Google Cloud Console.

type HealthInterval = {
  civilDateTimeInterval?: {
    startTime?: string;
    endTime?: string;
  };
  physicalInterval?: {
    startTime?: string;
    endTime?: string;
  };
};

type HealthNotification = {
  type?: string;
  healthUserId?: string;
  operation?: "UPSERT" | "DELETE";
  dataType?: string;
  intervals?: HealthInterval[];
};

type WebhookPayload = {
  version?: string;
  subscriberNotifications?: Array<{
    notification?: HealthNotification;
  }>;
};

function extractDateRange(intervals: HealthInterval[]): { from: string; to: string } | null {
  const dates: Date[] = [];

  for (const interval of intervals) {
    const civil = interval.civilDateTimeInterval;
    const physical = interval.physicalInterval;
    const start = civil?.startTime ?? physical?.startTime;
    const end = civil?.endTime ?? physical?.endTime;

    if (start) dates.push(parseISO(start.slice(0, 10)));
    if (end) dates.push(parseISO(end.slice(0, 10)));
  }

  if (dates.length === 0) return null;

  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));

  return {
    from: format(min, "yyyy-MM-dd"),
    to: format(max, "yyyy-MM-dd"),
  };
}

export async function POST(req: NextRequest) {
  // Validate authorization token
  const authHeader = req.headers.get("authorization");
  const webhookSecret = process.env.WEBHOOK_SECRET ?? getAutoSyncSecret();
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Respond 204 immediately — Google requires a fast response
  const body = (await req.json().catch(() => null)) as WebhookPayload | null;

  // Handle subscriber registration verification (no-op, just return 204)
  const firstNotification = body?.subscriberNotifications?.[0]?.notification;
  if (firstNotification?.type === "SUBSCRIBER_REGISTRATION_VERIFICATION") {
    return new NextResponse(null, { status: 204 });
  }

  // Process notifications asynchronously after returning 204
  // We can't await here in a serverless function, so we fire-and-forget
  void processNotifications(body);

  return new NextResponse(null, { status: 204 });
}

async function processNotifications(body: WebhookPayload | null) {
  if (!body?.subscriberNotifications?.length) return;

  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  if (!auth) return;

  // Collect the broadest date range across all notifications
  const allDates: string[] = [];
  for (const { notification } of body.subscriberNotifications) {
    if (!notification?.intervals?.length) continue;
    const range = extractDateRange(notification.intervals);
    if (range) {
      allDates.push(range.from, range.to);
    }
  }

  if (allDates.length === 0) {
    // Fall back to today if no date info
    const today = format(new Date(), "yyyy-MM-dd");
    allDates.push(today, today);
  }

  const sortedDates = allDates.sort();
  const from = sortedDates[0];
  const to = sortedDates[sortedDates.length - 1];

  try {
    await runLoggedSync({ userId: user.id, from, to, trigger: "auto", maxAttempts: 2 });
  } catch {
    // Webhook sync failures are non-fatal
  }
}
