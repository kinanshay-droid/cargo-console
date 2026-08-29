import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ClipboardCheck,
  Check,
  X,
  ChevronDown,
  PackageCheck,
  Plus,
  Trash2,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveCaseChecklist } from "@/lib/operations.functions";
import { listWarehouseItems, adjustWarehouseStock } from "@/lib/warehouse.functions";
import {
  CHECKLIST_SECTIONS,
  emptyChecklistData,
  parseChecklistData,
  checklistProgress,
  buildCaseReferenceValues,
  GENERAL_BOX_ID,
  type ChecklistData,
  type ChecklistItemStatus,
  type ChecklistCaseSnapshot,
  type ChecklistBox,
} from "@/lib/packaging-checklist";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CHECKLIST_STATUS_ICON: Record<ChecklistItemStatus, string> = {
  ok: "✔",
  not_ok: "✘",
  unset: "—",
};

// Builds a standalone printable HTML document from the checklist's current
// in-progress state (including unsaved edits) and opens it in a new tab for
// printing — this sidesteps trying to print the dialog itself, which sits
// inside a fixed/transformed/scroll-clipped Radix Dialog and doesn't print
// reliably. Mirrors the "ייצוא ל-PDF" pattern used on the quote detail page
// (a clean page + window.print()), just generated on the fly here instead
// of being a real route, since the data being exported may not be saved yet.
function buildChecklistReportHtml(
  data: ChecklistData,
  boxLabel: string | undefined,
  caseRef: Record<string, string>,
): string {
  const sectionsHtml = CHECKLIST_SECTIONS.map((section) => {
    const rowsHtml = section.items
      .map((item) => {
        const state = data.items[item.key] ?? { status: "unset" as ChecklistItemStatus, note: "" };
        const ref = caseRef[item.key];
        return `<tr>
          <td>${escapeHtml(item.label)}${ref ? `<div class="ref">מהתיק: ${escapeHtml(ref)}</div>` : ""}</td>
          <td class="status status-${state.status}">${CHECKLIST_STATUS_ICON[state.status]}</td>
          <td>${escapeHtml(state.note || "")}</td>
        </tr>`;
      })
      .join("");
    return `<h3>${escapeHtml(section.title)}</h3>
      <table>
        <thead><tr><th>סעיף</th><th>סטטוס</th><th>הערות</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }).join("");

  const consumedHtml = data.consumedItems.length
    ? `<h3>פריטים שנצרכו מהמחסן</h3>
      <table>
        <thead><tr><th>פריט</th><th>כמות</th></tr></thead>
        <tbody>${data.consumedItems
          .map((ci) => `<tr><td>${escapeHtml(ci.itemName)}</td><td>${ci.quantity}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : "";

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>צ'קליסט הכנת מארז${boxLabel ? ` — ${escapeHtml(boxLabel)}` : ""}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; color: #666; margin: 0 0 16px; font-weight: normal; }
  h3 { font-size: 14px; margin-top: 22px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f3f3f3; }
  .ref { font-size: 11px; color: #2563eb; margin-top: 2px; }
  .status { text-align: center; font-weight: bold; width: 60px; }
  .status-ok { color: #16a34a; }
  .status-not_ok { color: #dc2626; }
  .status-unset { color: #999; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; font-size: 13px; }
  .meta .label { color: #666; font-size: 11px; display: block; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; font-size: 13px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>צ'קליסט הכנת מארז מבוקר טמפרטורה${boxLabel ? ` — ${escapeHtml(boxLabel)}` : ""}</h1>
  <h2>${data.savedAt ? `נשמר לאחרונה: ${new Date(data.savedAt).toLocaleString("he-IL")}` : "טרם נשמר"}</h2>
  <div class="meta">
    <div><span class="label">מספר משלוח</span>${escapeHtml(data.shipmentNumber || "—")}</div>
    <div><span class="label">לקוח</span>${escapeHtml(data.customer || "—")}</div>
    <div><span class="label">יעד</span>${escapeHtml(data.destination || "—")}</div>
    <div><span class="label">תאריך</span>${escapeHtml(data.date || "—")}</div>
  </div>
  ${sectionsHtml}
  ${consumedHtml}
  <div class="sign">
    <div><span class="label">אורז</span>${escapeHtml(data.packedBy || "—")}</div>
    <div><span class="label">QA</span>${escapeHtml(data.qaBy || "—")}</div>
    <div><span class="label">תאריך</span>${escapeHtml(data.signedDate || "—")}</div>
  </div>
</body>
</html>`;
}

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  boxId: string;
  boxLabel?: string;
  existing: unknown;
  defaults: { shipmentNumber?: string; customer?: string; destination?: string };
  caseSnapshot?: ChecklistCaseSnapshot;
  lockDestination?: boolean;
};

// Controlled fillable checklist for a single box — used directly when the
// case has zero or one box, and opened from the picker below when it has
// more than one.
function PackagingChecklistFormDialog({
  open,
  onOpenChange,
  caseId,
  boxId,
  boxLabel,
  existing,
  defaults,
  caseSnapshot,
  lockDestination,
}: FormDialogProps) {
  const [data, setData] = useState<ChecklistData>(emptyChecklistData);
  const [baselineConsumed, setBaselineConsumed] = useState<Record<string, number>>({});
  const [autoSuggested, setAutoSuggested] = useState(false);
  const queryClient = useQueryClient();
  const saveChecklistFn = useServerFn(saveCaseChecklist);
  const listWarehouseItemsFn = useServerFn(listWarehouseItems);
  const adjustWarehouseStockFn = useServerFn(adjustWarehouseStock);
  const caseRef = useMemo(() => buildCaseReferenceValues(caseSnapshot ?? {}), [caseSnapshot]);

  const warehouseItemsQuery = useQuery({
    queryKey: ["warehouse-items"],
    queryFn: () => listWarehouseItemsFn(),
    enabled: open,
  });
  const activeWarehouseItems = (warehouseItemsQuery.data ?? []).filter((i) => i.active);

  useEffect(() => {
    if (!open) return;
    const parsed = parseChecklistData(existing);
    const hasContent = parsed.savedAt != null;
    setData(
      hasContent
        ? { ...parsed, destination: lockDestination ? "ישראל" : parsed.destination }
        : {
            ...parsed,
            shipmentNumber: defaults.shipmentNumber ?? "",
            customer: defaults.customer ?? "",
            destination: lockDestination ? "ישראל" : (defaults.destination ?? ""),
            date: todayISO(),
          },
    );
    const baseline: Record<string, number> = {};
    for (const ci of parsed.consumedItems) baseline[ci.itemId] = ci.quantity;
    setBaselineConsumed(baseline);
    setAutoSuggested(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boxId]);

  // Pre-fill the consumed-items list with every warehouse item that matches
  // something already recorded on the quote/case for this box — the box
  // model itself (seeded 1:1 from the CoolGuard/BioTherm catalog — see
  // supabase/migrations/20260827100000_seed_warehouse_packaging_catalog.sql)
  // and the assigned temperature logger (seeded 1:1 from TEMP_LOGGERS — see
  // supabase/migrations/20260827130000_add_warehouse_box_logger_categories.sql),
  // matched by exact name. So the record used to build the box lines up with
  // what's actually deducted from stock. Only runs once per box, and only if
  // nothing was recorded yet.
  useEffect(() => {
    if (!open || autoSuggested) return;
    const items = warehouseItemsQuery.data;
    if (!items) return;
    setAutoSuggested(true);
    if (data.consumedItems.length > 0) return;
    const matches = [caseSnapshot?.boxType, caseSnapshot?.loggerLabel]
      .map((name) => (name ? items.find((i) => i.active && i.name === name) : undefined))
      .filter((m): m is NonNullable<typeof m> => m != null);
    if (matches.length === 0) return;
    setData((d) =>
      d.consumedItems.length > 0
        ? d
        : {
            ...d,
            consumedItems: matches.map((m) => ({ itemId: m.id, itemName: m.name, quantity: 1 })),
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    autoSuggested,
    warehouseItemsQuery.data,
    caseSnapshot?.boxType,
    caseSnapshot?.loggerLabel,
  ]);

  function addConsumedRow() {
    setData((d) => ({
      ...d,
      consumedItems: [...d.consumedItems, { itemId: "", itemName: "", quantity: 1 }],
    }));
  }
  function removeConsumedRow(idx: number) {
    setData((d) => ({ ...d, consumedItems: d.consumedItems.filter((_, i) => i !== idx) }));
  }
  function setConsumedItemId(idx: number, itemId: string) {
    const item = activeWarehouseItems.find((i) => i.id === itemId);
    setData((d) => ({
      ...d,
      consumedItems: d.consumedItems.map((ci, i) =>
        i === idx ? { ...ci, itemId, itemName: item?.name ?? "" } : ci,
      ),
    }));
  }
  function setConsumedQuantity(idx: number, quantity: number) {
    setData((d) => ({
      ...d,
      consumedItems: d.consumedItems.map((ci, i) => (i === idx ? { ...ci, quantity } : ci)),
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const consumedItems = data.consumedItems.filter((ci) => ci.itemId && ci.quantity > 0);
      await saveChecklistFn({ data: { id: caseId, boxId, checklist: { ...data, consumedItems } } });

      // Reconcile warehouse stock against what was recorded on the previous
      // save: only the delta moves, so editing quantities up/down or
      // removing a row corrects stock instead of double-deducting it.
      const newQty: Record<string, number> = {};
      for (const ci of consumedItems) newQty[ci.itemId] = (newQty[ci.itemId] ?? 0) + ci.quantity;
      const itemIds = new Set([...Object.keys(baselineConsumed), ...Object.keys(newQty)]);
      const reason = `צ'קליסט אריזה — תיק ${caseId}${boxLabel ? ` / ${boxLabel}` : ""}`;
      for (const itemId of itemIds) {
        const before = baselineConsumed[itemId] ?? 0;
        const after = newQty[itemId] ?? 0;
        const delta = -(after - before);
        if (delta === 0) continue;
        try {
          await adjustWarehouseStockFn({ data: { itemId, delta, reason, caseId } });
        } catch (e) {
          toast.error(
            `עדכון מלאי נכשל עבור פריט: ${e instanceof Error ? e.message : "שגיאה לא ידועה"}`,
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("הצ'קליסט נשמר בתיק");
      queryClient.invalidateQueries({ queryKey: ["operations-case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["operations-cases"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-items"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת הצ'קליסט נכשלה"),
  });

  function setItemStatus(key: string, status: ChecklistItemStatus) {
    setData((d) => ({
      ...d,
      items: {
        ...d.items,
        [key]: { ...d.items[key], status: d.items[key]?.status === status ? "unset" : status },
      },
    }));
  }
  function setItemNote(key: string, note: string) {
    setData((d) => ({ ...d, items: { ...d.items, [key]: { ...d.items[key], note } } }));
  }

  function exportReport() {
    const html = buildChecklistReportHtml(data, boxLabel, caseRef);
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("החלון נחסם על ידי הדפדפן — יש לאפשר חלונות קופצים ולנסות שוב");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give the new tab a moment to paint before invoking print.
    setTimeout(() => win.print(), 300);
  }

  const progress = checklistProgress(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] max-w-3xl overflow-y-auto text-right sm:text-right"
      >
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>
            צ'קליסט הכנת מארז מבוקר טמפרטורה
            {boxLabel && <span className="font-normal text-muted-foreground"> — {boxLabel}</span>}
          </DialogTitle>
          <DialogDescription>
            מלא/י את הסעיפים והערות לפי הצורך, ולחצ/י "שמור" כדי לצרף את הצ'קליסט לתיק.
            {progress.done > 0 && ` (${progress.done}/${progress.total} סעיפים סומנו)`}
          </DialogDescription>
          <Progress value={(progress.done / progress.total) * 100} className="mt-1 h-1.5" />
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">מספר משלוח</Label>
            <Input
              value={data.shipmentNumber}
              onChange={(e) => setData((d) => ({ ...d, shipmentNumber: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">לקוח</Label>
            <Input
              value={data.customer}
              onChange={(e) => setData((d) => ({ ...d, customer: e.target.value }))}
            />
          </div>
          {caseSnapshot?.boxType && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">סוג מארז</Label>
              <Input
                value={
                  caseSnapshot.boxSize
                    ? `${caseSnapshot.boxType} — ${caseSnapshot.boxSize}`
                    : caseSnapshot.boxType
                }
                disabled
                className="bg-muted/50 font-medium text-foreground disabled:opacity-100"
              />
            </div>
          )}
          {caseSnapshot?.loggerLabel && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">רשם טמפרטורה משויך</Label>
              <Input
                value={caseSnapshot.loggerLabel}
                disabled
                className="bg-muted/50 font-medium text-foreground disabled:opacity-100"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">יעד</Label>
            {lockDestination ? (
              <Input
                value="ישראל"
                disabled
                className="bg-muted/50 font-medium text-foreground disabled:opacity-100"
              />
            ) : (
              <Input
                value={data.destination}
                onChange={(e) => setData((d) => ({ ...d, destination: e.target.value }))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תאריך</Label>
            <Input
              type="date"
              value={data.date}
              onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-5">
          {CHECKLIST_SECTIONS.map((section) => (
            <div key={section.key} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
                {section.title}
              </div>
              <div className="divide-y">
                {section.items.map((item) => {
                  const state = data.items[item.key] ?? { status: "unset", note: "" };
                  const ref = caseRef[item.key];
                  return (
                    <div key={item.key} className="flex flex-wrap items-center gap-2 px-4 py-2">
                      <span className="min-w-[180px] flex-1 text-sm">
                        {item.label}
                        {ref && (
                          <span className="mt-0.5 block text-xs font-medium text-primary">
                            מהתיק: {ref}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemStatus(item.key, "ok")}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md border text-success transition-colors",
                            state.status === "ok"
                              ? "border-success bg-success/15"
                              : "border-transparent hover:bg-muted",
                          )}
                          aria-label="תקין"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemStatus(item.key, "not_ok")}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md border text-destructive transition-colors",
                            state.status === "not_ok"
                              ? "border-destructive bg-destructive/15"
                              : "border-transparent hover:bg-muted",
                          )}
                          aria-label="לא תקין"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Input
                        value={state.note}
                        onChange={(e) => setItemNote(item.key, e.target.value)}
                        placeholder="הערות"
                        className="h-8 min-w-[140px] flex-[2] text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
            <span>פריטים שנצרכו מהמחסן</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={addConsumedRow}
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף פריט
            </Button>
          </div>
          {data.consumedItems.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              לא נרשמו פריטים שנצרכו עבור מארז זה.
            </div>
          ) : (
            <div className="divide-y">
              {data.consumedItems.map((ci, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2">
                  <Select value={ci.itemId} onValueChange={(v) => setConsumedItemId(idx, v)}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="בחר/י פריט" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWarehouseItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.quantityOnHand} {item.unit} במלאי)
                          {caseSnapshot?.boxType === item.name ? " — מארז זה" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={ci.quantity}
                    onChange={(e) => setConsumedQuantity(idx, Number(e.target.value) || 0)}
                    className="h-8 w-20 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeConsumedRow(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">אורז</Label>
            <Input
              value={data.packedBy}
              onChange={(e) => setData((d) => ({ ...d, packedBy: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">QA</Label>
            <Input
              value={data.qaBy}
              onChange={(e) => setData((d) => ({ ...d, qaBy: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תאריך</Label>
            <Input
              type="date"
              value={data.signedDate}
              onChange={(e) => setData((d) => ({ ...d, signedDate: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          {data.savedAt && (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              נשמר לאחרונה: {new Date(data.savedAt).toLocaleString("he-IL")}
            </span>
          )}
          <Button type="button" variant="outline" onClick={exportReport} className="gap-2">
            <FileDown className="h-4 w-4" /> ייצוא דוח
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "שומר…" : "שמור בתיק"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type LauncherProps = {
  caseId: string;
  boxes: ChecklistBox[];
  existingChecklists: Record<string, unknown>;
  baseSnapshot: ChecklistCaseSnapshot;
  defaults: { shipmentNumber?: string; customer?: string; destination?: string };
  lockDestination?: boolean;
};

// Decides how the checklist button behaves: a case usually ships in one box,
// so clicking it opens the checklist directly. If more than one box/model
// was selected on the case, it opens a small picker first so each box gets
// its own independently-saved checklist instead of one shared form.
export function PackagingChecklistLauncher({
  caseId,
  boxes,
  existingChecklists,
  baseSnapshot,
  defaults,
  lockDestination,
}: LauncherProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);

  const effectiveBoxes: ChecklistBox[] =
    boxes.length > 0 ? boxes : [{ id: GENERAL_BOX_ID, label: "צ'קליסט למשלוח", boxType: "" }];

  function isSaved(boxId: string) {
    return parseChecklistData(existingChecklists[boxId]).savedAt != null;
  }

  function openBox(boxId: string) {
    setActiveBoxId(boxId);
    setPickerOpen(false);
  }

  const activeBox = effectiveBoxes.find((b) => b.id === activeBoxId) ?? null;
  const activeSnapshot: ChecklistCaseSnapshot | undefined = activeBox
    ? {
        ...baseSnapshot,
        boxType: activeBox.boxType || undefined,
        boxSize: activeBox.boxSize,
        loggerLabel: activeBox.loggerLabel,
      }
    : undefined;

  return (
    <>
      {effectiveBoxes.length === 1 ? (
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
          onClick={() => openBox(effectiveBoxes[0].id)}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15">
            <ClipboardCheck className="h-3 w-3" />
          </span>
          צ'קליסט למשלוח
        </Button>
      ) : (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15">
                <ClipboardCheck className="h-3 w-3" />
              </span>
              צ'קליסט למשלוח ({effectiveBoxes.length} מארזים)
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent dir="rtl" align="end" className="w-80 p-2">
            <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">
              בחר/י מארז למילוי הצ'קליסט
            </div>
            <div className="space-y-1">
              {effectiveBoxes.map((box) => (
                <button
                  key={box.id}
                  type="button"
                  onClick={() => openBox(box.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-right text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <PackageCheck
                      className={cn(
                        "h-4 w-4",
                        isSaved(box.id) ? "text-success" : "text-muted-foreground",
                      )}
                    />
                    <span>
                      <span className="block font-medium">{box.label}</span>
                      {box.boxSize && (
                        <span className="block text-xs text-muted-foreground">{box.boxSize}</span>
                      )}
                    </span>
                  </span>
                  {isSaved(box.id) && (
                    <span className="whitespace-nowrap text-xs text-success">נשמר</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {activeBox && (
        <PackagingChecklistFormDialog
          open={activeBoxId != null}
          onOpenChange={(o) => setActiveBoxId(o ? activeBox.id : null)}
          caseId={caseId}
          boxId={activeBox.id}
          boxLabel={effectiveBoxes.length > 1 ? activeBox.label : undefined}
          existing={existingChecklists[activeBox.id]}
          defaults={defaults}
          caseSnapshot={activeSnapshot}
          lockDestination={lockDestination}
        />
      )}
    </>
  );
}
