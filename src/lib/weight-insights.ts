import { subDays, format } from "date-fns";
import { prisma } from "@/lib/prisma";

export type WeightDataPoint = {
  date: string;
  weightKg: number;
  bodyFatPct: number | null;
  bmi: number | null;
};

export type WeightInsightsPayload = {
  points: WeightDataPoint[];
  latestWeightKg: number | null;
  latestBodyFatPct: number | null;
  latestBmi: number | null;
  changeKg: number | null;
  changePct: number | null;
};

export async function getWeightInsights(userId: string): Promise<WeightInsightsPayload> {
  const since = subDays(new Date(), 90);
  const rows = await prisma.weightLog.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true, bodyFatPct: true, bmi: true },
  });

  const points: WeightDataPoint[] = rows.map((r) => ({
    date: format(r.date, "yyyy-MM-dd"),
    weightKg: r.weightKg,
    bodyFatPct: r.bodyFatPct,
    bmi: r.bmi,
  }));

  const latest = points[points.length - 1] ?? null;
  const oldest = points[0] ?? null;

  const changeKg =
    latest && oldest && oldest.date !== latest.date ? +(latest.weightKg - oldest.weightKg).toFixed(1) : null;
  const changePct = changeKg != null && oldest ? +((changeKg / oldest.weightKg) * 100).toFixed(1) : null;

  return {
    points,
    latestWeightKg: latest?.weightKg ?? null,
    latestBodyFatPct: latest?.bodyFatPct ?? null,
    latestBmi: latest?.bmi ?? null,
    changeKg,
    changePct,
  };
}

export function buildDemoWeightInsights(): WeightInsightsPayload {
  const today = new Date();
  const points: WeightDataPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(today, 29 - i);
    const base = 78.5 - i * 0.05 + (Math.random() - 0.5) * 0.4;
    return {
      date: format(d, "yyyy-MM-dd"),
      weightKg: +base.toFixed(1),
      bodyFatPct: +(18.2 - i * 0.03 + (Math.random() - 0.5) * 0.3).toFixed(1),
      bmi: +(24.1 - i * 0.015).toFixed(1),
    };
  });

  const latest = points[points.length - 1];
  const oldest = points[0];
  const changeKg = +(latest.weightKg - oldest.weightKg).toFixed(1);
  const changePct = +((changeKg / oldest.weightKg) * 100).toFixed(1);

  return {
    points,
    latestWeightKg: latest.weightKg,
    latestBodyFatPct: latest.bodyFatPct,
    latestBmi: latest.bmi,
    changeKg,
    changePct,
  };
}
