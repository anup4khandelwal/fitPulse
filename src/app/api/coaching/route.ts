import Anthropic from "@anthropic-ai/sdk";
import { getOrCreateSingleUser } from "@/lib/dashboard";
import { demoModeForced } from "@/lib/env";
import { buildDemoCoachingData, getCoachingData } from "@/lib/coaching";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are FitPulse Coach, an expert personal health and fitness coach with deep knowledge of:
- Sleep science and recovery optimization
- Cardiovascular training (Zone 2, VO2 max, heart rate zones)
- HRV (heart rate variability) and autonomic nervous system health
- Strength and conditioning periodization
- Nutrition and lifestyle factors affecting fitness

Your role is to analyze a user's last 14 days of health data from Google Health and deliver a concise, actionable weekly coaching summary.

Guidelines:
- Be specific and data-driven: reference actual numbers from the data
- Identify 2-3 key wins to celebrate (positive reinforcement)
- Identify 1-2 areas for focused improvement with concrete actions
- If you spot anomalies (e.g. HRV drop >20%, sleep efficiency <75%, RHR spike), call them out clearly
- Keep the tone warm, encouraging, and coach-like — not clinical
- Format with clear sections using markdown headers (##)
- Total length: 350-500 words
- End with one "This week's focus" sentence that's the single most impactful action`;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 503 });
  }

  const user = await getOrCreateSingleUser();
  const auth = await prisma.fitbitAuth.findUnique({ where: { userId: user.id } });
  const isDemo = demoModeForced || !auth;

  const data = isDemo ? buildDemoCoachingData() : await getCoachingData(user.id, 14);

  const hasAnyData =
    data.sleep.length > 0 ||
    data.steps.length > 0 ||
    data.heartZones.length > 0 ||
    data.recovery.length > 0;

  if (!hasAnyData) {
    return new Response(
      "No health data available yet. Connect Google Health and sync data to receive AI coaching.",
      { status: 200, headers: { "Content-Type": "text/plain" } },
    );
  }

  const client = new Anthropic({ apiKey });

  const userMessage = `Here is my health data for ${data.period.from} to ${data.period.to}:

## Sleep (${data.sleep.length} days)
${JSON.stringify(data.sleep, null, 2)}

## Daily Activity (${data.steps.length} days)
${JSON.stringify(data.steps, null, 2)}

## Heart Rate Zones (${data.heartZones.length} days)
${JSON.stringify(data.heartZones, null, 2)}

## Recovery Biomarkers (${data.recovery.length} days)
${JSON.stringify(data.recovery, null, 2)}

## Exercise Sessions (${data.activities.length} sessions)
${JSON.stringify(data.activities, null, 2)}

Please give me my weekly coaching summary.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          thinking: { type: "adaptive" },
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Coaching unavailable";
        controller.enqueue(encoder.encode(`\n\n*Error: ${msg}*`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
