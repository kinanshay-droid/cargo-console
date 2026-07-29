import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Plane, Ship, PackageOpen, Truck, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { listCases, CASE_PIPELINE_STATUS_META, getCaseDisplayCode, type CasePipelineStatus, type CaseRep } from "@/lib/operations.functions";
import { TONE_GRADIENT } from "@/lib/theme";

export const Route = createFileRoute("/dashboard/pickup-distribution")({
  head: () => ({
    meta: [
      { title: "איסוף/הפצה — AFIK Logistics Platform" },
      { name: "description", content: "משלוחים שהועברו לסטטוס מוכן לאיסוף/הפצה." },
      { property: "og:title", content: "איסוף/הפצה — AFIK Logistics Platform" },
      { property: "og:description", content: "משלוחים שהועברו לסטטוס מוכן לאיסוף/הפצה." },
    ],
  }),
  component: PickupDistributionPage,
});

// Same four categories used across the New Quote wizard and Shipments dashboard.
const SHIP_KIND_ORDER = ["export", "import", "distribution", "domestic"] as const;
type ShipKindValue = (typeof SHIP_KIND_ORDER)[number];

const SHIP_KIND_CONFIG: Record<ShipKindValue, { label: string; icon: typeof Truck; badgeClass: string }> = {
  export: { label: "ייצוא", icon: Plane, badgeClass: "bg-primary/10 text-primary" },
  import: { label: "ייבוא", icon: Ship, badgeClass: "bg-accent/15 text-accent" },
  distribution: { label: "משלוחי דרופ", icon: PackageOpen, badgeClass: "bg-success/15 text-success" },
  domestic: { label: "פנים ארצי", icon: Truck, badgeClass: "bg-warning/15 text-warning" },
};

function isShipKind(v: string | null | undefined): v is ShipKindValue {
  return !!v && (SHIP_KIND_ORDER as readonly string[]).includes(v);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The detailed pipeline status lives on payload.pipelineStatus (JSONB), not
// a dedicated column — same read pattern used by the Operations dashboard.
function getPipelineStatus(payload: unknown): CasePipelineStatus {
  const p = isRecord(payload) ? payload : {};
  const raw = p.pipelineStatus;
  return typeof raw === "string" && raw in CASE_PIPELINE_STATUS_META ? (raw as CasePipelineStatus) : "new";
}

function getAssignedRep(payload: unknown): CaseRep {
  const p = isRecord(payload) ? payload : {};
  const rep = p.assignedRep;
  return isRecord(rep) && typeof rep.id === "string" && rep.id
    ? { id: String(rep.id), name: String(rep.name ?? ""), role: String(rep.role ?? "") }
    : null;
}

// BL number lives in payload.blNumber (JSONB) — same read pattern as the
// case detail page and the Operations dashboard.
function getBlNumber(payload: unknown): string | null {
  const p = isRecord(payload) ? payload : {};
  const raw = p.blNumber;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

// The scheduled pickup/distribution date is set on the case detail page's
// "העבר לאיסוף/הפצה" action (payload.pickupDueDate) — this is what the
// date filter below should key off, not the shipment's arrive_date (which
// is the port/destination ETA, a different date entirely).
function getPickupDueDate(payload: unknown): string | null {
  const p = isRecord(payload) ? payload : {};
  const raw = p.pickupDueDate;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

const PICKUP_STAGE: CasePipelineStatus = "ready_for_pickup";

// Date-filter options — filters rows by payload.pickupDueDate ("מועד לביצוע").
type DateFilter = "all" | "today" | "tomorrow" | "next_week" | "custom";

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "כל התאריכים" },
  { value: "today", label: "היום" },
  { value: "tomorrow", label: "מחר" },
  { value: "next_week", label: "השבוע הבא" },
  { value: "custom", label: "טווח מותאם אישית" },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Resolves the active quick-filter (or custom from/to inputs) to a concrete
// [from, to] window. Returns null for "all" (no filtering).
function resolveDateRange(filter: DateFilter, customFrom: string, customTo: string): { from: Date; to: Date } | null {
  const today = startOfDay(new Date());
  if (filter === "today") return { from: today, to: endOfDay(today) };
  if (filter === "tomorrow") {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return { from: t, to: endOfDay(t) };
  }
  if (filter === "next_week") {
    const from = new Date(today);
    from.setDate(from.getDate() + 1);
    const to = new Date(today);
    to.setDate(to.getDate() + 7);
    return { from, to: endOfDay(to) };
  }
  if (filter === "custom") {
    if (!customFrom && !customTo) return null;
    const from = customFrom ? startOfDay(new Date(customFrom)) : new Date(0);
    const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(new Date(today.getFullYear() + 50, 0, 1));
    return { from, to };
  }
  return null;
}

function PickupDistributionPage() {
  const navigate = useNavigate();
  const listCasesFn = useServerFn(listCases);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });

  const pickupCases = useMemo(
    () => cases.filter((c) => getPipelineStatus(c.payload) === PICKUP_STAGE),
    [cases],
  );

  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(
    () => resolveDateRange(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo],
  );

  const dateFilteredCases = useMemo(() => {
    if (!dateRange) return pickupCases;
    return pickupCases.filter((c) => {
      const dueDate = getPickupDueDate(c.payload);
      if (!dueDate) return false;
      const d = new Date(dueDate);
      return d >= dateRange.from && d <= dateRange.to;
    });
  }, [pickupCases, dateRange]);

  // Split the pickup/distribution list into one group per shipment kind, so
  // each kind (ייצוא/ייבוא/משלוחי דרופ/פנים ארצי) is shown separately —
  // same pattern as the Operations dashboard's active-shipments panel.
  const pickupCasesByKind = useMemo(() => {
    const groups: Record<ShipKindValue, typeof dateFilteredCases> = { export: [], import: [], distribution: [], domestic: [] };
    for (const c of dateFilteredCases) {
      if (isShipKind(c.shipment_kind)) groups[c.shipment_kind].push(c);
    }
    return groups;
  }, [dateFilteredCases]);

  return (
    <div dir="rtl" className="space-y-6">
      <PageHeader
        title="איסוף/הפצה"
        description={`משלוחים שהועברו לסטטוס "${CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}" — ${CASE_PIPELINE_STATUS_META[PICKUP_STAGE].description}.`}
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className={cn("flex items-center gap-3 bg-gradient-to-br p-4 text-white", TONE_GRADIENT.accent)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <ArrowLeftRight className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm/6 opacity-90">מוכנים לאיסוף/הפצה</div>
            <div className="text-2xl font-bold">{dateFilteredCases.length}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          תצוגה לפי תאריך
        </div>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateFilter === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              מתאריך
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-40"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              עד תאריך
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-40"
              />
            </label>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card py-10 text-center text-muted-foreground">טוען...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {SHIP_KIND_ORDER.map((kind) => {
            const kindCases = pickupCasesByKind[kind];
            const conf = SHIP_KIND_CONFIG[kind];
            const KindIcon = conf.icon;
            return (
              <div key={kind} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", conf.badgeClass)}>
                      <KindIcon className="h-3.5 w-3.5" />
                    </span>
                    {conf.label}
                  </div>
                  <Badge className={conf.badgeClass}>{kindCases.length}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">לקוח</TableHead>
                      <TableHead className="text-right">מס' תיק</TableHead>
                      <TableHead className="text-right">נציג מטפל</TableHead>
                      <TableHead className="text-right">מס' שטר מטען</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">מועד לביצוע</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kindCases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                          אין משלוחים פעילים מסוג זה
                        </TableCell>
                      </TableRow>
                    ) : (
                      kindCases.map((c) => {
                        const rep = getAssignedRep(c.payload);
                        const blNumber = getBlNumber(c.payload);
                        const dueDate = getPickupDueDate(c.payload);
                        return (
                          <TableRow
                            key={c.id}
                            onClick={() => navigate({ to: "/dashboard/shipments/$id", params: { id: c.id } })}
                            className="cursor-pointer hover:bg-muted/40"
                          >
                            <TableCell className="text-xs">
                              <div className="font-medium">{c.customer_name ?? "—"}</div>
                              {c.customer_ref ? (
                                <div className="text-[11px] text-muted-foreground">{c.customer_ref}</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <Link
                                to="/dashboard/shipments/$id"
                                params={{ id: c.id }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline"
                              >
                                {getCaseDisplayCode(c.payload, c.case_code)}
                              </Link>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{rep?.name || "—"}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{blNumber ?? "—"}</TableCell>
                            <TableCell>
                              <Badge className="bg-accent/15 text-accent">{CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {dueDate ? new Date(dueDate).toLocaleDateString("he-IL") : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <div className="border-t p-3 text-center">
                  <Link to="/dashboard/shipments" className="text-xs font-medium text-primary hover:underline">
                    לכל המשלוחים הפעילים
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
