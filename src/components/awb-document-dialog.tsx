import { useEffect, useRef, useState } from "react";
import { FileStack, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildAwbOverlaySvg, type AwbFillData } from "@/lib/awb-fill";

// Fetches the blank AWB template (public/awb-template.svg), overlays
// whatever case data we can confidently map onto it, and previews the
// result in a dialog with a print/save-as-PDF button. Only opens/builds the
// filled document when the dialog is actually opened, so the fetch doesn't
// run on every case page load.
export function AwbDocumentLauncher({ data }: { data: AwbFillData }) {
  const [open, setOpen] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || svg || error) return;
    fetch("/awb-template.svg")
      .then((r) => {
        if (!r.ok) throw new Error("template fetch failed");
        return r.text();
      })
      .then((template) => setSvg(buildAwbOverlaySvg(template, data)))
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const html = svg
    ? `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{margin:0;background:#eef1f5;display:flex;justify-content:center;padding:12px 0;}svg{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.15);width:100%;max-width:900px;}</style></head><body>${svg}</body></html>`
    : null;

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <FileStack className="h-4 w-4" /> טופס AWB
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-4xl overflow-y-auto text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>שטר מטען אווירי (AWB)</DialogTitle>
            <DialogDescription>
              מולא אוטומטית מתוך פרטי התיק הקיימים. שדות שלא ניתן להשלים מהנתונים נשארו ריקים למילוי ידני.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
              טעינת תבנית ה-AWB נכשלה.
            </div>
          ) : html ? (
            <iframe ref={iframeRef} srcDoc={html} title="AWB" className="h-[70vh] w-full rounded-lg border bg-white" />
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">טוען...</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              className="gap-2"
              disabled={!html}
              onClick={() => iframeRef.current?.contentWindow?.print()}
            >
              <Printer className="h-4 w-4" /> הדפס / שמור כ-PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
