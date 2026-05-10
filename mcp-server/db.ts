import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
export const prisma = new PrismaClient({ adapter });

export type DateRange = { from: string; to: string };

export function defaultRange(days = 7): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function parseRange(from?: string, to?: string): DateRange {
  const def = defaultRange(7);
  return { from: from ?? def.from, to: to ?? def.to };
}
