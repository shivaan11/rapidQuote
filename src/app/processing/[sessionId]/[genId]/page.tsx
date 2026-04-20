"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";

// Expected generation time with Nano Banana Pro. Only used to shape the
// asymptotic progress curve — if it takes longer, the bar just pauses near 95%.
const EXPECTED_DURATION_MS = 45_000;

export default function ProcessingPage({
  params,
}: {
  params: Promise<{ sessionId: string; genId: string }>;
}) {
  const { sessionId, genId } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/job/${genId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        setStatus(data.status);

        if (data.status === "complete") {
          setProgress(100);
          // Brief pause so the user sees the bar hit 100% before the route swap
          setTimeout(() => {
            if (!cancelled) router.push(`/result/${sessionId}/${genId}`);
          }, 300);
          return;
        }

        if (data.status === "failed") {
          setError(data.error ?? "Generation failed");
          return;
        }

        setTimeout(poll, 2000);
      } catch {
        if (!cancelled) setTimeout(poll, 3000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [genId, sessionId, router]);

  // Tick the progress bar + elapsed counter every 200ms while the job is live.
  // Curve: 95 * (1 - e^(-t/tau)) — fast at first, asymptotes at 95% until the
  // poll returns "complete" and we snap to 100%.
  useEffect(() => {
    if (status === "complete" || status === "failed") return;
    const tau = EXPECTED_DURATION_MS / 3;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
      setProgress(95 * (1 - Math.exp(-elapsed / tau)));
    }, 200);
    return () => clearInterval(id);
  }, [status]);

  const stages: Record<string, string> = {
    pending: "Preparing your image…",
    processing: "Adding lights to your yard…",
    complete: "Done! Redirecting…",
    failed: "Something went wrong",
  };

  const elapsedLabel = `${Math.floor(elapsedMs / 1000)}s`;

  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-canvas-bg px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {status !== "failed" ? (
          <>
            <h1 className="font-serif text-2xl text-cream">
              {stages[status] ?? "Working…"}
            </h1>
            <div className="w-full">
              <div className="h-2 w-full overflow-hidden rounded-full bg-cream/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-cream/50">
                <span>{Math.round(progress)}%</span>
                <span>{elapsedLabel}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 text-3xl text-red-400">
              !
            </div>
            <h1 className="font-serif text-2xl text-cream">
              Generation failed
            </h1>
            <p className="max-w-sm text-sm text-cream/50">{error}</p>
            <button
              type="button"
              onClick={() => router.push(`/annotate/${sessionId}`)}
              className="mt-4 inline-flex min-h-[48px] items-center rounded-full bg-accent px-6 text-sm font-medium text-charcoal transition hover:bg-accent-strong active:scale-95"
            >
              Edit annotations
            </button>
          </>
        )}
      </div>
    </main>
  );
}
