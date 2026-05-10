import Table from "cli-table3";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  return String(v);
}

export function printTable(rows: Row[]) {
  if (rows.length === 0) { console.log("No data."); return; }
  const keys = Object.keys(rows[0]);
  const table = new Table({ head: keys, style: { head: ["cyan"] } });
  for (const row of rows) table.push(keys.map((k) => str(row[k])));
  console.log(table.toString());
}

export function printJson(rows: Row[]) {
  console.log(JSON.stringify(rows, null, 2));
}

export function printCsv(rows: Row[]) {
  if (rows.length === 0) { console.log("No data."); return; }
  const keys = Object.keys(rows[0]);
  console.log(keys.join(","));
  for (const row of rows) console.log(keys.map((k) => str(row[k])).join(","));
}

export function printMarkdown(rows: Row[]) {
  if (rows.length === 0) { console.log("No data."); return; }
  const keys = Object.keys(rows[0]);
  console.log(`| ${keys.join(" | ")} |`);
  console.log(`| ${keys.map(() => "---").join(" | ")} |`);
  for (const row of rows) console.log(`| ${keys.map((k) => str(row[k])).join(" | ")} |`);
}

export function output(rows: Row[], format: string) {
  if (format === "json") return printJson(rows);
  if (format === "csv") return printCsv(rows);
  if (format === "md" || format === "markdown") return printMarkdown(rows);
  printTable(rows);
}
