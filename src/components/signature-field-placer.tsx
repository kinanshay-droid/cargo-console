import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Renders a "document to sign" (image or PDF) with clickable pin markers
// for signature placement, shared between:
// - staff placement UI (dashboard.shipments_.$id.tsx): click the document
//   to add a pin, label it (e.g. "איסוף"), remove pins — edit mode.
// - the courier's app (courier.$token.tsx): tap an unsigned pin to sign it
//   — sign mode, read-only positions.
//
// PDFs are rendered client-side via pdf.js loaded from cdnjs at runtime
// (never a static/top-level import — this file ships into the SSR bundle
// too, and pdf.js needs a real browser: canvas, Worker, DOM). Only page 1
// is rendered; multi-page signature documents aren't supported yet.
const PDFJS_VERSION = "4.7.76";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export type SignatureFieldPin = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
};

type Props = {
  fileUrl: string;
  isPdf: boolean;
  fields: SignatureFieldPin[];
  // Edit mode (staff): clicking empty space starts a new pin.
  onAddField?: (field: { label: string; xPercent: number; yPercent: number }) => void;
  onRemoveField?: (id: string) => void;
  // Sign mode (courier): tapping an existing pin signs it.
  onFieldTap?: (field: SignatureFieldPin) => void;
  signedFieldIds?: string[];
};

export function SignatureFieldPlacer({
  fileUrl,
  isPdf,
  fields,
  onAddField,
  onRemoveField,
  onFieldTap,
  signedFieldIds = [],
}: Props) {
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pendingPos, setPendingPos] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPdf) {
      setPdfImageUrl(null);
      setPdfError(null);
      return;
    }
    let cancelled = false;
    setPdfImageUrl(null);
    setPdfError(null);
    (async () => {
      // @vite-ignore — deliberately loaded from a CDN at runtime, not
      // bundled, so this heavy library never ships in the app's own JS and
      // never has to run during SSR.
      const pdfjsLib = await import(/* @vite-ignore */ PDFJS_URL);
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      const doc = await pdfjsLib.getDocument(fileUrl).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) setPdfImageUrl(canvas.toDataURL("image/png"));
    })().catch(() => {
      if (!cancelled) setPdfError("לא ניתן להציג את המסמך לתצוגה מקדימה");
    });
    return () => {
      cancelled = true;
    };
  }, [isPdf, fileUrl]);

  const displaySrc = isPdf ? pdfImageUrl : fileUrl;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onAddField || !containerRef.current) return;
    // Ignore clicks that landed on an existing pin (they bubble here too).
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPos({ xPercent, yPercent });
    setPendingLabel("");
  }

  if (isPdf && pdfError) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {pdfError}
      </div>
    );
  }
  if (isPdf && !pdfImageUrl) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-md border bg-white",
        onAddField && "cursor-crosshair",
      )}
    >
      {displaySrc && (
        <img src={displaySrc} alt="מסמך לחתימה" className="block w-full" draggable={false} />
      )}

      {fields.map((f) => {
        const signed = signedFieldIds.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            data-pin
            onClick={(e) => {
              e.stopPropagation();
              onFieldTap?.(f);
            }}
            disabled={!onFieldTap || signed}
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-full flex-col items-center",
              onFieldTap && !signed ? "cursor-pointer" : "cursor-default",
            )}
            style={{ left: `${f.xPercent}%`, top: `${f.yPercent}%` }}
          >
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white shadow",
                signed ? "bg-success" : "bg-destructive",
              )}
            >
              {signed ? <Check className="h-3 w-3" /> : null}
              {f.label || "חתימה"}
            </span>
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border-2 border-white shadow",
                signed ? "bg-success" : "bg-destructive",
              )}
            />
            {onRemoveField && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveField(f.id);
                }}
                className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-muted-foreground shadow"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}

      {pendingPos && onAddField && (
        <div
          className="absolute z-10 w-48 -translate-x-1/2 rounded-lg border bg-card p-2 shadow-lg"
          style={{ left: `${pendingPos.xPercent}%`, top: `${pendingPos.yPercent}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={pendingLabel}
            onChange={(e) => setPendingLabel(e.target.value)}
            placeholder="תיאור, למשל: איסוף"
            className="w-full rounded border px-2 py-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && pendingLabel.trim()) {
                onAddField({ ...pendingPos, label: pendingLabel.trim() });
                setPendingPos(null);
              }
              if (e.key === "Escape") setPendingPos(null);
            }}
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setPendingPos(null)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={!pendingLabel.trim()}
              onClick={() => {
                onAddField({ ...pendingPos, label: pendingLabel.trim() });
                setPendingPos(null);
              }}
              className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              הוספה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
