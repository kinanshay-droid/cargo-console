import { useEffect, useMemo, useRef, useState } from "react";
import { FileStack, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildAwbOverlaySvg, type AwbFillData } from "@/lib/awb-fill";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

// Fetches the blank AWB template (public/awb-template.svg), pre-fills an
// editable form with whatever case data we can confidently map onto it, and
// shows a live SVG preview that re-renders as the user edits any field
// (including the ones we left blank) — so the case data is just a starting
// point, not the final word. Print/PDF uses whatever is in the form at that
// moment, not the original autofill.
export function AwbDocumentLauncher({ data }: { data: AwbFillData }) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<AwbFillData>(data);
  const [goodsText, setGoodsText] = useState(data.goodsLines.join("\n"));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    // Reset the form to the case's current autofill every time the dialog
    // is (re)opened, so it reflects any edits made to the case since last time.
    setForm(data);
    setGoodsText(data.goodsLines.join("\n"));
    if (template || error) return;
    fetch("/awb-template.svg")
      .then((r) => {
        if (!r.ok) throw new Error("template fetch failed");
        return r.text();
      })
      .then(setTemplate)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function upd<K extends keyof AwbFillData>(key: K, value: AwbFillData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const effectiveData: AwbFillData = useMemo(
    () => ({ ...form, goodsLines: goodsText.split("\n").map((l) => l.trim()).filter(Boolean) }),
    [form, goodsText],
  );

  const svg = useMemo(() => (template ? buildAwbOverlaySvg(template, effectiveData) : null), [template, effectiveData]);
  const html = svg
    ? `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{margin:0;background:#eef1f5;display:flex;justify-content:center;padding:12px 0;}svg{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.15);width:100%;max-width:900px;}</style></head><body>${svg}</body></html>`
    : null;

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <FileStack className="h-4 w-4" /> טופס AWB
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[92vh] max-w-6xl overflow-y-auto text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>שטר מטען אווירי (AWB)</DialogTitle>
            <DialogDescription>
              מולא אוטומטית מתוך פרטי התיק. כל שדה ניתן לעריכה — כולל שדות שנשארו ריקים — והתצוגה מתעדכנת בזמן אמת.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
              טעינת תבנית ה-AWB נכשלה.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
              <div className="max-h-[70vh] space-y-4 overflow-y-auto pl-1">
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">שולח (Shipper)</div>
                  <Field label="שם" value={form.shipperName} onChange={(v) => upd("shipperName", v)} />
                  <Field label="כתובת" value={form.shipperAddress} onChange={(v) => upd("shipperAddress", v)} />
                  <Field label="איש קשר / טלפון" value={form.shipperContactLine} onChange={(v) => upd("shipperContactLine", v)} />
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">נמען (Consignee)</div>
                  <Field label="שם" value={form.consigneeName} onChange={(v) => upd("consigneeName", v)} />
                  <Field label="כתובת" value={form.consigneeAddress} onChange={(v) => upd("consigneeAddress", v)} />
                  <Field label="איש קשר / טלפון" value={form.consigneeContactLine} onChange={(v) => upd("consigneeContactLine", v)} />
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">פרטי משלוח</div>
                  <Field label="Issued By" value={form.issuedBy} onChange={(v) => upd("issuedBy", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="נמל מוצא" value={form.originPort} onChange={(v) => upd("originPort", v)} />
                    <Field label="נמל יעד" value={form.destPort} onChange={(v) => upd("destPort", v)} />
                  </div>
                  <Field label="Reference Number" value={form.referenceNumber} onChange={(v) => upd("referenceNumber", v)} />
                  <Field label="חברת תעופה / תאריך טיסה" value={form.flightAndDate} onChange={(v) => upd("flightAndDate", v)} />
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">טיפול ומטען</div>
                  <Field label="הוראות טיפול" value={form.handlingInfo} onChange={(v) => upd("handlingInfo", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="No. of Pieces" value={form.pieces} onChange={(v) => upd("pieces", v)} />
                    <Field label="Gross Weight" value={form.grossWeight} onChange={(v) => upd("grossWeight", v)} />
                    <Field label="Rate Class" value={form.commodityLabel} onChange={(v) => upd("commodityLabel", v)} />
                    <Field label="Chargeable Weight" value={form.chargeableWeight} onChange={(v) => upd("chargeableWeight", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nature and Quantity of Goods (שורה לכל פריט)</Label>
                    <Textarea value={goodsText} onChange={(e) => setGoodsText(e.target.value)} rows={5} className="text-sm" />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">חתימה</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Executed on (date)" value={form.executedDate} onChange={(v) => upd("executedDate", v)} />
                    <Field label="at (place)" value={form.executedPlace} onChange={(v) => upd("executedPlace", v)} />
                  </div>
                </div>
              </div>

              {html ? (
                <iframe ref={iframeRef} srcDoc={html} title="AWB" className="h-[70vh] w-full rounded-lg border bg-white" />
              ) : (
                <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">טוען...</div>
              )}
            </div>
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
