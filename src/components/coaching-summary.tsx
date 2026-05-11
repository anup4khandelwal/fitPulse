"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "streaming" | "done" | "error";

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="mt-4 first:mt-0 text-base font-semibold text-white">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-3 font-semibold text-teal-300">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-white">
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
              <span>{renderInline(line.slice(2))}</span>
            </p>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function CoachingSummary() {
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText("");
    setStatus("loading");

    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setText(msg || "Failed to load coaching summary.");
        setStatus("error");
        return;
      }

      if (!res.body) {
        setText(await res.text());
        setStatus("done");
        return;
      }

      setStatus("streaming");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setStatus("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setText("Could not load coaching summary. Check that ANTHROPIC_API_KEY is configured.");
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <section className="soft-card fade-up d-6 rounded-3xl p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">AI Coach</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Weekly Coaching Summary</h2>
          <p className="mt-0.5 text-xs text-slate-500">Personalized insights from your last 14 days · Powered by Claude</p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={status === "loading" || status === "streaming"}
          className="shrink-0 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" || status === "streaming" ? "Generating…" : status === "done" ? "Refresh" : "Generate"}
        </button>
      </div>

      {status === "idle" && (
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/2 py-8 text-center">
          <div className="text-3xl">🧠</div>
          <p className="text-sm text-slate-400">
            Click <span className="font-semibold text-violet-300">Generate</span> for a personalized coaching summary
          </p>
          <p className="text-xs text-slate-600">Analyzes sleep, Zone 2, HRV, steps, and recovery trends</p>
        </div>
      )}

      {status === "loading" && (
        <div className="flex min-h-[120px] items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <span className="text-sm text-slate-400">Analyzing your health data…</span>
        </div>
      )}

      {(status === "streaming" || status === "done") && text && (
        <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
          <MarkdownText text={text} />
          {status === "streaming" && (
            <span className="mt-2 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />
          )}
        </div>
      )}

      {status === "error" && text && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
          {text}
        </div>
      )}
    </section>
  );
}
