import { addDays, format } from "date-fns";

import { DATE_FMT, dateKeyToUtcDate } from "@/lib/date";
import { FitbitApiError } from "@/lib/fitbit/client";
import { syncDateRange } from "@/lib/fitbit/sync";
import { prisma } from "@/lib/prisma";

type SyncTrigger = "manual" | "auto";

type RunSyncOptions = {
  userId: string;
  from: string;
  to: string;
  trigger: SyncTrigger;
  maxAttempts?: number;
};

export type RunSyncResult = {
  syncedDays: number;
  warnings: string[];
  attempts: number;
  status: "SUCCESS" | "PARTIAL";
};

function isRetryable(error: unknown) {
  if (!(error instanceof FitbitApiError)) {
    return true;
  }

  return error.status === 429 || error.status === 408 || error.status >= 500;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown sync failure.";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getAutoSyncRange(daysBack = 3) {
  const toDate = new Date();
  const fromDate = addDays(toDate, -(Math.max(1, daysBack) - 1));

  return {
    from: format(fromDate, DATE_FMT),
    to: format(toDate, DATE_FMT),
  };
}

export async function runLoggedSync({ userId, from, to, trigger, maxAttempts = 3 }: RunSyncOptions): Promise<RunSyncResult> {
  const run = await prisma.syncRun.create({
    data: {
      userId,
      trigger,
      status: "RUNNING",
      fromDate: dateKeyToUtcDate(from),
      toDate: dateKeyToUtcDate(to),
      startedAt: new Date(),
    },
  });

  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const result = await syncDateRange(userId, from, to, { failFast: true });
      const status = result.warnings.length > 0 ? "PARTIAL" : "SUCCESS";

      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status,
          syncedDays: result.syncedDays,
          warnings: result.warnings.length > 0 ? result.warnings.join("\n") : null,
          attempts: attempt,
          endedAt: new Date(),
          lastError: null,
        },
      });

      return {
        syncedDays: result.syncedDays,
        warnings: result.warnings,
        attempts: attempt,
        status,
      };
    } catch (error) {
      const shouldRetry = isRetryable(error) && attempt < maxAttempts;
      if (shouldRetry) {
        await delay(1500 * attempt);
        continue;
      }

      await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          attempts: attempt,
          endedAt: new Date(),
          lastError: getErrorMessage(error),
        },
      });

      throw error;
    }
  }

  await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      attempts: attempt,
      endedAt: new Date(),
      lastError: "Sync exhausted retries.",
    },
  });

  throw new Error("Sync exhausted retries.");
}
