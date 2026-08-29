import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  PackagePlus,
  PackageMinus,
  Pencil,
  Boxes,
  Wrench,
  Package,
  Thermometer,
  Warehouse,
  LayoutGrid,
  Archive,
  ArchiveRestore,
  FileDown,
} from "lucide-react";
import {
  listWarehouseItems,
  createWarehouseItem,
  updateWarehouseItem,
  setWarehouseItemActive,
  adjustWarehouseStock,
  listWarehouseMovementsInRange,
  type WarehouseItem,
  type WarehouseCategory,
  type WarehouseCurrency,
  type WarehouseMovementWithItem,
} from "@/lib/warehouse.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { TONE_SOLID, TONE_OUTLINE_BUTTON, type Tone } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dashboard/warehouse")({
  head: () => ({
    meta: [
      { title: "מחסן — AFIK Logistics Platform" },
      { name: "description", content: "ניהול מלאי פריטי אריזה וציוד." },
    ],
  }),
  component: WarehousePage,
});

const CATEGORY_LABEL: Record<WarehouseCategory, string> = {
  boxes: "מארזים",
  loggers: "רשמי טמפרטורה",
  packaging: "פריט אריזה",
  equipment: "ציוד",
};

const CATEGORY_FILTERS: { value: WarehouseCategory; icon: typeof Boxes; tone: Tone }[] = [
  { value: "boxes", icon: Package, tone: "accent" },
  { value: "loggers", icon: Thermometer, tone: "warning" },
  { value: "packaging", icon: Boxes, tone: "success" },
  { value: "equipment", icon: Wrench, tone: "muted" },
];

function isLowStock(item: WarehouseItem): boolean {
  return item.minThreshold != null && item.quantityOnHand <= item.minThreshold;
}

const CURRENCY_SYMBOL: Record<WarehouseCurrency, string> = {
  ILS: "₪",
  USD: "$",
  EUR: "€",
};

const EXPIRY_SOON_DAYS = 30;

function expiryStatus(item: WarehouseItem): "expired" | "soon" | null {
  if (!item.expiryDate) return null;
  const days = (new Date(item.expiryDate).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= EXPIRY_SOON_DAYS) return "soon";
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Builds a standalone printable HTML inventory report from the warehouse
// items currently in view (active or archive), grouped by category —
// mirrors the "ייצוא דוח" pattern used on the packaging checklist dialog
// (window.open + document.write + print), since there's no dedicated report
// route and the data is generated on the fly from whatever's loaded.
function buildWarehouseReportHtml(items: WarehouseItem[], scopeLabel: string): string {
  const sectionsHtml = CATEGORY_FILTERS.map(({ value }) => {
    const group = items.filter((i) => i.category === value);
    if (group.length === 0) return "";
    const rowsHtml = group
      .map((item) => {
        const low = isLowStock(item);
        const expiry = expiryStatus(item);
        const value =
          item.unitCost != null
            ? `${(item.unitCost * item.quantityOnHand).toLocaleString("he-IL", { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOL[item.unitCostCurrency]}`
            : "—";
        return `<tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.sku || "—")}</td>
          <td class="${low ? "low" : ""}">${item.quantityOnHand} ${escapeHtml(item.unit)}${low ? " (מלאי נמוך)" : ""}</td>
          <td>${value}</td>
          <td class="${expiry ? expiry : ""}">${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("he-IL") : "—"}${expiry === "expired" ? " (פג תוקף)" : expiry === "soon" ? " (בקרוב)" : ""}</td>
          <td>${item.active ? "פעיל" : "בארכיון"}</td>
        </tr>`;
      })
      .join("");
    return `<h3>${escapeHtml(CATEGORY_LABEL[value])} (${group.length})</h3>
      <table>
        <thead><tr><th>שם</th><th>מק"ט</th><th>כמות</th><th>שווי</th><th>תוקף</th><th>סטטוס</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }).join("");

  const totalsByCurrency: Record<string, number> = {};
  for (const item of items) {
    if (item.unitCost == null) continue;
    totalsByCurrency[item.unitCostCurrency] =
      (totalsByCurrency[item.unitCostCurrency] ?? 0) + item.unitCost * item.quantityOnHand;
  }
  const lowStockCount = items.filter(isLowStock).length;
  const expiringCount = items.filter((i) => expiryStatus(i) != null).length;

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>דוח מלאי מחסן — ${escapeHtml(scopeLabel)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; color: #666; margin: 0 0 16px; font-weight: normal; }
  h3 { font-size: 14px; margin-top: 22px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f3f3f3; }
  .low, .expired { color: #dc2626; font-weight: bold; }
  .soon { color: #b45309; font-weight: bold; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 24px; margin: 16px 0; font-size: 13px; }
  .summary .label { color: #666; font-size: 11px; display: block; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>דוח מלאי מחסן — ${escapeHtml(scopeLabel)}</h1>
  <h2>הופק: ${new Date().toLocaleString("he-IL")}</h2>
  <div class="summary">
    <div><span class="label">סה״כ פריטים</span>${items.length}</div>
    <div><span class="label">מלאי נמוך</span>${lowStockCount}</div>
    <div><span class="label">פג/קרב לפוג תוקף</span>${expiringCount}</div>
    ${Object.entries(totalsByCurrency)
      .map(
        ([cur, total]) =>
          `<div><span class="label">שווי מלאי (${cur})</span>${total.toLocaleString("he-IL", { minimumFractionDigits: 2 })} ${CURRENCY_SYMBOL[cur as WarehouseCurrency]}</div>`,
      )
      .join("")}
  </div>
  ${sectionsHtml || '<p style="color:#666">אין פריטים להצגה.</p>'}
</body>
</html>`;
}

// Same printable pattern as buildWarehouseReportHtml, but for the
// "movements during a period" flavor of the report — a list of what moved
// in/out of stock in a chosen month/date range, grouped by category, rather
// than a point-in-time snapshot of current quantities.
function buildWarehouseMovementsReportHtml(
  movements: WarehouseMovementWithItem[],
  periodLabel: string,
): string {
  const sectionsHtml = CATEGORY_FILTERS.map(({ value }) => {
    const group = movements.filter((m) => m.category === value);
    if (group.length === 0) return "";
    const rowsHtml = group
      .map(
        (m) => `<tr>
          <td>${new Date(m.movementDate).toLocaleDateString("he-IL")}</td>
          <td>${escapeHtml(m.itemName)}</td>
          <td class="${m.delta >= 0 ? "in" : "out"}">${m.delta >= 0 ? "+" : ""}${m.delta} ${escapeHtml(m.unit)}</td>
          <td>${escapeHtml(m.reason)}</td>
        </tr>`,
      )
      .join("");
    const received = group.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0);
    const consumed = group.filter((m) => m.delta < 0).reduce((s, m) => s - m.delta, 0);
    return `<h3>${escapeHtml(CATEGORY_LABEL[value])} — ${group.length} תנועות (התקבלו ${received} · נצרכו ${consumed})</h3>
      <table>
        <thead><tr><th>תאריך</th><th>פריט</th><th>כמות</th><th>סיבה</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }).join("");

  const totalIn = movements.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0);
  const totalOut = movements.filter((m) => m.delta < 0).reduce((s, m) => s - m.delta, 0);

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>דוח תנועות מלאי — ${escapeHtml(periodLabel)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; color: #666; margin: 0 0 16px; font-weight: normal; }
  h3 { font-size: 14px; margin-top: 22px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f3f3f3; }
  .in { color: #16a34a; font-weight: bold; }
  .out { color: #dc2626; font-weight: bold; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 24px; margin: 16px 0; font-size: 13px; }
  .summary .label { color: #666; font-size: 11px; display: block; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>דוח תנועות מלאי — ${escapeHtml(periodLabel)}</h1>
  <h2>הופק: ${new Date().toLocaleString("he-IL")}</h2>
  <div class="summary">
    <div><span class="label">סה״כ תנועות</span>${movements.length}</div>
    <div><span class="label">התקבל</span>${totalIn}</div>
    <div><span class="label">נצרך</span>${totalOut}</div>
  </div>
  ${sectionsHtml || '<p style="color:#666">אין תנועות בתקופה שנבחרה.</p>'}
</body>
</html>`;
}

// Shared row-set renderer used both for the flat "active" table and for the
// per-category grouped sections in archive view, so the two views can't
// drift out of sync in columns/actions.
function WarehouseItemsTable({
  items,
  emptyMessage,
  onSaved,
  onToggleActive,
  togglePending,
}: {
  items: WarehouseItem[];
  emptyMessage: string;
  onSaved: () => void;
  onToggleActive: (id: string, active: boolean) => void;
  togglePending: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">שם</TableHead>
            <TableHead className="text-right">קטגוריה</TableHead>
            <TableHead className="text-right">מק"ט</TableHead>
            <TableHead className="text-right">כמות במלאי</TableHead>
            <TableHead className="text-right">עלות יחידה</TableHead>
            <TableHead className="text-right">תוקף</TableHead>
            <TableHead className="text-right">סטטוס</TableHead>
            <TableHead className="text-right">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.name}
                  {item.notes && <div className="text-xs text-muted-foreground">{item.notes}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {CATEGORY_LABEL[item.category]}
                </TableCell>
                <TableCell className="text-muted-foreground">{item.sku || "—"}</TableCell>
                <TableCell>
                  <span className={isLowStock(item) ? "font-semibold text-destructive" : ""}>
                    {item.quantityOnHand} {item.unit}
                  </span>
                  {isLowStock(item) && (
                    <Badge className="mr-2 bg-destructive/10 text-destructive">מלאי נמוך</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.unitCost != null ? (
                    <>
                      {item.unitCost.toLocaleString("he-IL", { minimumFractionDigits: 2 })}{" "}
                      {CURRENCY_SYMBOL[item.unitCostCurrency]}
                      <div className="text-xs">
                        סה״כ:{" "}
                        {(item.unitCost * item.quantityOnHand).toLocaleString("he-IL", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {CURRENCY_SYMBOL[item.unitCostCurrency]}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.expiryDate ? (
                    <span
                      className={
                        expiryStatus(item) === "expired"
                          ? "font-semibold text-destructive"
                          : expiryStatus(item) === "soon"
                            ? "font-semibold text-warning"
                            : ""
                      }
                    >
                      {new Date(item.expiryDate).toLocaleDateString("he-IL")}
                      {expiryStatus(item) === "expired" && " (פג תוקף)"}
                      {expiryStatus(item) === "soon" && " (בקרוב)"}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      item.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }
                  >
                    {item.active ? "פעיל" : "בארכיון"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <AdjustStockDialog item={item} onSaved={onSaved} compact />
                    <ItemFormDialog item={item} onSaved={onSaved} compact />
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={togglePending}
                      title={item.active ? "הוסף לארכיון" : "שחזר מארכיון"}
                      className={
                        item.active ? TONE_OUTLINE_BUTTON.warning : TONE_OUTLINE_BUTTON.success
                      }
                      onClick={() => onToggleActive(item.id, !item.active)}
                    >
                      {item.active ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Lets the user scope a report before generating it: which categories to
// include, whether to include active/archived items, and whether it's a
// point-in-time stock snapshot or a log of movements within a chosen month
// or custom date range.
function WarehouseReportDialog({ items }: { items: WarehouseItem[] }) {
  const listMovementsInRangeFn = useServerFn(listWarehouseMovementsInRange);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<WarehouseCategory[]>(
    CATEGORY_FILTERS.map((c) => c.value),
  );
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [scope, setScope] = useState<"snapshot" | "period">("snapshot");
  const [periodType, setPeriodType] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);

  const toggleCategory = (cat: WarehouseCategory) => {
    setCategories((c) => (c.includes(cat) ? c.filter((v) => v !== cat) : [...c, cat]));
  };

  const generate = useMutation({
    mutationFn: async () => {
      if (categories.length === 0) throw new Error("יש לבחור לפחות קטגוריה אחת");
      if (scope === "snapshot") {
        const filteredItems = items.filter(
          (i) =>
            categories.includes(i.category) &&
            (statusFilter === "all" || i.active === (statusFilter === "active")),
        );
        const statusLabel =
          statusFilter === "active" ? "מלאי פעיל" : statusFilter === "archived" ? "ארכיון" : "הכל";
        return buildWarehouseReportHtml(filteredItems, statusLabel);
      }
      let from: string;
      let to: string;
      let periodLabel: string;
      if (periodType === "month") {
        const [y, m] = month.split("-").map(Number);
        if (!y || !m) throw new Error("יש לבחור חודש תקין");
        from = `${month}-01`;
        to = new Date(y, m, 0).toISOString().slice(0, 10);
        periodLabel = new Date(y, m - 1, 1).toLocaleDateString("he-IL", {
          month: "long",
          year: "numeric",
        });
      } else {
        if (!fromDate || !toDate) throw new Error("יש לבחור תאריך התחלה וסיום");
        from = fromDate;
        to = toDate;
        periodLabel = `${new Date(from).toLocaleDateString("he-IL")} — ${new Date(to).toLocaleDateString("he-IL")}`;
      }
      const movements = await listMovementsInRangeFn({ data: { from, to } });
      const filteredMovements = movements.filter((m) => categories.includes(m.category));
      return buildWarehouseMovementsReportHtml(filteredMovements, periodLabel);
    },
    onSuccess: (html) => {
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("יש לאפשר חלונות קופצים כדי להפיק דוח");
        return;
      }
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפקת הדוח נכשלה"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileDown className="h-4 w-4" /> דוח מלאי
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>הפקת דוח מלאי</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            generate.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>קטגוריות לכלול בדוח</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map(({ value, icon: Icon }) => {
                const checked = categories.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleCategory(value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      checked ? cn(TONE_SOLID.primary, "shadow-sm") : TONE_OUTLINE_BUTTON.primary,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {CATEGORY_LABEL[value]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>אילו פריטים לכלול</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעילים בלבד</SelectItem>
                <SelectItem value="archived">ארכיון בלבד</SelectItem>
                <SelectItem value="all">הכל</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>סוג הדוח</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                variant={scope === "snapshot" ? "default" : "outline"}
                onClick={() => setScope("snapshot")}
              >
                מצב מלאי נוכחי
              </Button>
              <Button
                type="button"
                className="flex-1"
                variant={scope === "period" ? "default" : "outline"}
                onClick={() => setScope("period")}
              >
                תנועות בתקופה
              </Button>
            </div>
          </div>

          {scope === "period" && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={periodType === "month" ? "default" : "outline"}
                  onClick={() => setPeriodType("month")}
                >
                  לפי חודש
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  variant={periodType === "range" ? "default" : "outline"}
                  onClick={() => setPeriodType("range")}
                >
                  לפי טווח תאריכים
                </Button>
              </div>
              {periodType === "month" ? (
                <div className="space-y-1.5">
                  <Label>חודש</Label>
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>מתאריך</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>עד תאריך</Label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={generate.isPending}>
              {generate.isPending ? "מפיק…" : "הפק דוח"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WarehousePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWarehouseItems);
  const setActiveFn = useServerFn(setWarehouseItemActive);
  const [categoryFilter, setCategoryFilter] = useState<"all" | WarehouseCategory>("all");
  const [view, setView] = useState<"active" | "archive">("active");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["warehouse-items"],
    queryFn: () => listFn(),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setActiveFn({ data: { id, active } }),
    onSuccess: (_data, vars) => {
      toast.success(vars.active ? "הפריט שוחזר מהארכיון" : "הפריט הועבר לארכיון");
      qc.invalidateQueries({ queryKey: ["warehouse-items"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["warehouse-items"] });
  const handleToggleActive = (id: string, active: boolean) => toggleActive.mutate({ id, active });

  // Archive view shows everything ever deactivated, split into its own tab
  // so it doesn't clutter the active-stock list — grouped by category per
  // request, instead of one flat table.
  const viewItems = items.filter((i) => i.active === (view === "active"));
  const filtered = viewItems.filter(
    (i) => categoryFilter === "all" || i.category === categoryFilter,
  );

  return (
    <div className="mx-auto max-w-6xl" dir="rtl">
      <PageHeader
        title="מחסן"
        description="מלאי פריטי אריזה וציוד המשמשים בבניית מארזים."
        icon={Warehouse}
        tone="success"
        action={
          <div className="flex gap-2">
            <WarehouseReportDialog items={items} />
            <ItemFormDialog onSaved={invalidate} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              categoryFilter === "all"
                ? cn(TONE_SOLID.primary, "shadow-sm")
                : TONE_OUTLINE_BUTTON.primary,
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> הכל
          </button>
          {CATEGORY_FILTERS.map(({ value, icon: Icon, tone }) => {
            const active = categoryFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategoryFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active ? cn(TONE_SOLID[tone], "shadow-sm") : TONE_OUTLINE_BUTTON[tone],
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {CATEGORY_LABEL[value]}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("active")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              view === "active" ? cn(TONE_SOLID.primary, "shadow-sm") : TONE_OUTLINE_BUTTON.primary,
            )}
          >
            <Warehouse className="h-3.5 w-3.5" /> מלאי פעיל
          </button>
          <button
            type="button"
            onClick={() => setView("archive")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              view === "archive" ? cn(TONE_SOLID.muted, "shadow-sm") : TONE_OUTLINE_BUTTON.muted,
            )}
          >
            <Archive className="h-3.5 w-3.5" /> ארכיון
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
          טוען…
        </div>
      ) : view === "active" ? (
        <WarehouseItemsTable
          items={filtered}
          emptyMessage="אין עדיין פריטים במחסן."
          onSaved={invalidate}
          onToggleActive={handleToggleActive}
          togglePending={toggleActive.isPending}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
          הארכיון ריק.
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_FILTERS.map(({ value, icon: Icon }) => {
            const group = filtered.filter((i) => i.category === value);
            if (group.length === 0) return null;
            return (
              <div key={value}>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <Icon className="h-4 w-4" /> {CATEGORY_LABEL[value]} ({group.length})
                </h2>
                <WarehouseItemsTable
                  items={group}
                  emptyMessage="הארכיון ריק."
                  onSaved={invalidate}
                  onToggleActive={handleToggleActive}
                  togglePending={toggleActive.isPending}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemFormDialog({
  item,
  onSaved,
  compact,
}: {
  item?: WarehouseItem;
  onSaved: () => void;
  compact?: boolean;
}) {
  const createFn = useServerFn(createWarehouseItem);
  const updateFn = useServerFn(updateWarehouseItem);
  const [open, setOpen] = useState(false);
  const isEdit = !!item;

  const [form, setForm] = useState({
    name: item?.name ?? "",
    category: item?.category ?? ("packaging" as WarehouseCategory),
    sku: item?.sku ?? "",
    unit: item?.unit ?? "יח׳",
    quantityOnHand: 0,
    minThreshold: item?.minThreshold != null ? String(item.minThreshold) : "",
    expiryDate: item?.expiryDate ?? "",
    unitCost: item?.unitCost != null ? String(item.unitCost) : "",
    unitCostCurrency: item?.unitCostCurrency ?? ("ILS" as WarehouseCurrency),
    notes: item?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? updateFn({
            data: {
              id: item.id,
              name: form.name,
              category: form.category,
              sku: form.sku || null,
              unit: form.unit,
              minThreshold: form.minThreshold ? Number(form.minThreshold) : null,
              expiryDate: form.expiryDate || null,
              unitCost: form.unitCost ? Number(form.unitCost) : null,
              unitCostCurrency: form.unitCostCurrency,
              notes: form.notes || null,
            },
          })
        : createFn({
            data: {
              name: form.name,
              category: form.category,
              sku: form.sku || null,
              unit: form.unit,
              quantityOnHand: form.quantityOnHand,
              minThreshold: form.minThreshold ? Number(form.minThreshold) : null,
              expiryDate: form.expiryDate || null,
              unitCost: form.unitCost ? Number(form.unitCost) : null,
              unitCostCurrency: form.unitCostCurrency,
              notes: form.notes || null,
            },
          }),
    onSuccess: () => {
      toast.success(isEdit ? "הפריט עודכן" : "הפריט נוצר");
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          compact ? (
            <Button
              size="icon"
              variant="outline"
              title="עריכה"
              className={TONE_OUTLINE_BUTTON.muted}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline">
              <Pencil className="h-3.5 w-3.5" /> עריכה
            </Button>
          )
        ) : (
          <Button>
            <Plus className="h-4 w-4" /> פריט חדש
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת פריט" : "פריט חדש במחסן"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>שם הפריט</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>קטגוריה</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as WarehouseCategory }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="boxes">מארזים</SelectItem>
                <SelectItem value="loggers">רשמי טמפרטורה</SelectItem>
                <SelectItem value="packaging">פריט אריזה</SelectItem>
                <SelectItem value="equipment">ציוד</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מק"ט (לא חובה)</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>יחידת מידה</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>כמות פתיחה</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantityOnHand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantityOnHand: Number(e.target.value) }))
                  }
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>סף מלאי מינימלי (לא חובה)</Label>
              <Input
                type="number"
                min={0}
                value={form.minThreshold}
                onChange={(e) => setForm((f) => ({ ...f, minThreshold: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך תפוגה (לא חובה)</Label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>עלות יחידה (לא חובה)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitCost}
                  onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                  className="flex-1"
                />
                <Select
                  value={form.unitCostCurrency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, unitCostCurrency: v as WarehouseCurrency }))
                  }
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">₪</SelectItem>
                    <SelectItem value="USD">$</SelectItem>
                    <SelectItem value="EUR">€</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "שומר…" : isEdit ? "שמור שינויים" : "צור פריט"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({
  item,
  onSaved,
  compact,
}: {
  item: WarehouseItem;
  onSaved: () => void;
  compact?: boolean;
}) {
  const adjustFn = useServerFn(adjustWarehouseStock);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [movementDate, setMovementDate] = useState(todayISO);

  const adjust = useMutation({
    mutationFn: () =>
      adjustFn({
        data: {
          itemId: item.id,
          delta: direction === "in" ? Number(qty) : -Number(qty),
          reason: reason.trim(),
          movementDate,
        },
      }),
    onSuccess: () => {
      toast.success("המלאי עודכן");
      setOpen(false);
      setQty("");
      setReason("");
      setMovementDate(todayISO());
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            size="icon"
            variant="outline"
            title="עדכון מלאי"
            className={TONE_OUTLINE_BUTTON.primary}
          >
            <PackagePlus className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <PackagePlus className="h-3.5 w-3.5" /> עדכון מלאי
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>עדכון מלאי — {item.name}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!qty || Number(qty) <= 0) return toast.error("יש להזין כמות חיובית");
            adjust.mutate();
          }}
        >
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              variant={direction === "in" ? "default" : "outline"}
              onClick={() => setDirection("in")}
            >
              <PackagePlus className="h-4 w-4" /> קבלת מלאי
            </Button>
            <Button
              type="button"
              className="flex-1"
              variant={direction === "out" ? "default" : "outline"}
              onClick={() => setDirection("out")}
            >
              <PackageMinus className="h-4 w-4" /> צריכת מלאי
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>כמות ({item.unit})</Label>
            <Input
              type="number"
              min={0}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>סיבה</Label>
            <Input
              required
              placeholder={direction === "in" ? "לדוגמה: הזמנה מספק" : "לדוגמה: שימוש במארז"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{direction === "in" ? "תאריך כניסה למלאי" : "תאריך התנועה"}</Label>
            <Input
              type="date"
              required
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            מלאי נוכחי: {item.quantityOnHand} {item.unit}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending ? "מעדכן…" : "עדכן מלאי"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
