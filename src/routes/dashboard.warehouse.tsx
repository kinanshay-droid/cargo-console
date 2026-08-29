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
} from "lucide-react";
import {
  listWarehouseItems,
  createWarehouseItem,
  updateWarehouseItem,
  setWarehouseItemActive,
  adjustWarehouseStock,
  type WarehouseItem,
  type WarehouseCategory,
  type WarehouseCurrency,
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <AdjustStockDialog item={item} onSaved={onSaved} />
                    <ItemFormDialog item={item} onSaved={onSaved} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={togglePending}
                      onClick={() => onToggleActive(item.id, !item.active)}
                    >
                      {item.active ? (
                        <>
                          <Archive className="h-3.5 w-3.5" /> הוסף לארכיון
                        </>
                      ) : (
                        "שחזר מארכיון"
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
        action={<ItemFormDialog onSaved={invalidate} />}
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

function ItemFormDialog({ item, onSaved }: { item?: WarehouseItem; onSaved: () => void }) {
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
          <Button size="sm" variant="outline">
            <Pencil className="h-3.5 w-3.5" /> עריכה
          </Button>
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function AdjustStockDialog({ item, onSaved }: { item: WarehouseItem; onSaved: () => void }) {
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
        <Button size="sm" variant="outline">
          <PackagePlus className="h-3.5 w-3.5" /> עדכון מלאי
        </Button>
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
