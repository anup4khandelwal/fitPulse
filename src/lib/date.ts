import { addDays, format, parseISO, startOfDay } from "date-fns";

export const DATE_FMT = "yyyy-MM-dd";

export function dateKeyToUtcDate(dateKey: string) {
  const parsed = parseISO(`${dateKey}T00:00:00.000Z`);
  return startOfDay(parsed);
}

export function enumerateDateKeys(from: string, to: string) {
  const start = parseISO(`${from}T00:00:00.000Z`);
  const end = parseISO(`${to}T00:00:00.000Z`);

  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    keys.push(format(cursor, DATE_FMT));
  }

  return keys;
}
