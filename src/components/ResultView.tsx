"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

type GenerationOption = {
  id: string;
  resultUrl: string;
  label: string;
  createdAt: string;
};

type Props = {
  sessionId: string;
  genId: string;
  originalUrl: string;
  resultUrl: string;
  annotatedUrl?: string;
  label?: string;
  generations?: GenerationOption[];
};

export default function ResultView({
  sessionId,
  genId,
  originalUrl,
  resultUrl,
  annotatedUrl,
  label,
  generations = [],
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedLabel, setSavedLabel] = useState(label ?? "");
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeGenId, setActiveGenId] = useState(genId);
  const [gens, setGens] = useState(generations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const activeGen = gens.find((g) => g.id === activeGenId);
  const activeResultUrl = activeGen?.resultUrl ?? resultUrl;

  async function handleDeleteGeneration(targetId: string) {
    if (gens.length <= 1) return;
    if (!confirm("Delete this generation? This can't be undone.")) return;
    setDeletingId(targetId);
    setError(null);
    try {
      const res = await fetch(`/api/generations/${targetId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      const remaining = gens.filter((g) => g.id !== targetId);
      setGens(remaining);
      if (activeGenId === targetId) {
        const next = remaining[0];
        if (next) {
          setActiveGenId(next.id);
          router.replace(`/result/${sessionId}/${next.id}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: savedLabel || null }),
      });
      if (!res.ok) throw new Error("Failed to save label");
      setShowLabelInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/regenerate/${sessionId}`, { method: "POST" });
      if (!res.ok) throw new Error("Regeneration failed");
      const { generationId } = await res.json();
      window.location.href = `/processing/${sessionId}/${generationId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
      setRegenerating(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(activeResultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lighting-render-${activeGenId.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal/10 text-lg text-charcoal transition hover:bg-charcoal/20 active:scale-95"
        >
          ←
        </button>
        <h1 className="font-serif text-lg text-charcoal">Result</h1>
        <div className="w-12" />
      </div>

      {/* Generation picker */}
      {gens.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2">
          {gens.map((g) => {
            const isActive = activeGenId === g.id;
            const isDeleting = deletingId === g.id;
            return (
              <div
                key={g.id}
                className={`flex shrink-0 items-center rounded-full text-xs font-medium transition ${
                  isActive
                    ? "bg-charcoal text-cream"
                    : "bg-charcoal/8 text-charcoal hover:bg-charcoal/15"
                } ${isDeleting ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setActiveGenId(g.id)}
                  disabled={isDeleting}
                  className="py-1.5 pl-4 pr-2 transition active:scale-95"
                >
                  {g.label}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGeneration(g.id)}
                  disabled={isDeleting}
                  aria-label={`Delete ${g.label}`}
                  className={`mr-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition active:scale-90 ${
                    isActive
                      ? "text-cream/70 hover:bg-cream/15 hover:text-cream"
                      : "text-charcoal/50 hover:bg-charcoal/15 hover:text-charcoal"
                  }`}
                >
                  {isDeleting ? <Spinner /> : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Before/After slider */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4">
        <div className="w-full overflow-hidden rounded-2xl shadow-lg" style={{ maxHeight: "calc(100dvh - 13rem)" }}>
          <ReactCompareSlider
            key={activeGenId}
            itemOne={
              <ReactCompareSliderImage
                src={originalUrl}
                alt="Original photo"
                style={{ objectFit: "contain", maxHeight: "calc(100dvh - 13rem)" }}
              />
            }
            itemTwo={
              <ReactCompareSliderImage
                src={activeResultUrl}
                alt="AI-generated lighting render"
                style={{ objectFit: "contain", maxHeight: "calc(100dvh - 13rem)" }}
              />
            }
            style={{ width: "100%", maxHeight: "calc(100dvh - 13rem)" }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-charcoal-muted">
          Drag the slider to compare original ↔ rendered
        </p>
      </div>

      {/* Label input */}
      {showLabelInput && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={savedLabel}
              onChange={(e) => setSavedLabel(e.target.value)}
              placeholder="Label this session (e.g. 123 Oak St)"
              className="min-h-[48px] flex-1 rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-[48px] rounded-xl bg-accent px-4 py-2 text-sm font-medium text-charcoal transition hover:bg-accent-strong active:scale-95 disabled:opacity-50"
            >
              {saving ? <Spinner /> : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pb-6">
        <ActionBtn onClick={() => setShowLabelInput((s) => !s)}>
          {showLabelInput ? "Cancel" : "Label"}
        </ActionBtn>
        <ActionBtn onClick={() => router.push(`/annotate/${sessionId}`)}>
          Edit annotations
        </ActionBtn>
        <ActionBtn onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? <><Spinner /> Regenerating…</> : "Regenerate"}
        </ActionBtn>
        <ActionBtn onClick={handleDownload} disabled={downloading}>
          {downloading ? <><Spinner /> Downloading…</> : "Download"}
        </ActionBtn>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-charcoal/15 px-5 py-2.5 text-sm font-medium text-charcoal transition hover:bg-charcoal/5 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
