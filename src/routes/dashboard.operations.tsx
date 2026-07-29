import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  PackageCheck,
  RadioTower,
  Plane,
  Ship,
  PackageOpen,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  listCases,
  SERVICE_REPS,
  CASE_PIPELINE_STATUS_META,
  type CaseStatus,
  type CasePipelineStatus,
  type CaseRep,
} from "@/lib/operations.functions";
import { listMyQuotes } from "@/lib/quotes.functions";
import { TONE_GRADIENT } from "@/lib/theme";

export const Route = createFileRoute("/dashboard/operations")({
  head: () => ({
    meta: [
      { title: "תפעול — AFIK Logistics Platform" },
      { name: "description", content: "ריכוז התראות וניהול יומי לצורך בקרה תפעולית." },
      { property: "og:title", content: "תפעול" },
      { property: "og:description", content: "ריכוז התראות וניהול יומי לצורך בקרה תפעולית." },
    ],
  }),
  component: OperationsDashboard,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type CaseRow = {
  id: string;
  case_code: string;
  status: CaseStatus;
  customer_name: string | null;
  origin_port: string | null;
  dest_port: string | null;
  transit_ports: string[] | null;
  shipment_kind: string | null;
  arrive_date: string | null;
  created_at: string;
  updated_at: string;
  payload: unknown;
};

function getPipelineStatus(c: CaseRow): CasePipelineStatus {
  const payload = isRecord(c.payload) ? c.payload : {};
  const raw = payload.pipelineStatus;
  return typeof raw === "string" && raw in CASE_PIPELINE_STATUS_META ? (raw as CasePipelineStatus) : "new";
}

function getAssignedRep(c: CaseRow): CaseRep {
  const payload = isRecord(c.payload) ? c.payload : {};
  const rep = payload.assignedRep;
  return isRecord(rep) && typeof rep.id === "string" && rep.id
    ? { id: String(rep.id), name: String(rep.name ?? ""), role: String(rep.role ?? "") }
    : null;
}

// BL number lives in payload.blNumber (JSONB) — same read pattern as the
// case detail page, since there's no dedicated column.
function getBlNumber(c: CaseRow): string | null {
  const payload = isRecord(c.payload) ? c.payload : {};
  const raw = payload.blNumber;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

// Same four categories as step 1 of the New Quote wizard ("סוג משלוח") — a
// case inherits its shipment_kind from the quote it was transferred from.
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

const REP_FILTER_ALL = "all";

// "Blocked on someone else" pipeline stages — used to approximate the
// "cases needing immediate attention" panel until a real SLA/escalation
// system exists.
const BLOCKING_STATUSES: CasePipelineStatus[] = [
  "pending_documents",
  "pending_customer_approval",
  "pending_credit",
  "data_review",
];

const STATUS_BADGE_CLASS: Record<CaseStatus, string> = {
  new: "bg-primary/10 text-primary",
  in_progress: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function relativeTimeHe(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `מזה ${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `מזה ${hours} שעות`;
  const days = Math.round(hours / 24);
  return `מזה ${days} ימים`;
}

function timeHHMM(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function OperationsDashboard() {
  const listCasesFn = useServerFn(listCases);
  const listMyQuotesFn = useServerFn(listMyQuotes);

  const { data: rawCases = [], isLoading } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });
  const cases = rawCases as CaseRow[];

  const { data: quotes = [] } = useQuery({
    queryKey: ["my-quotes"],
    queryFn: () => listMyQuotesFn(),
  });

  const [repFilter, setRepFilter] = useState<string>(REP_FILTER_ALL);
  const filteredCases = useMemo(
    () => (repFilter === REP_FILTER_ALL ? cases : cases.filter((c) => getAssignedRep(c)?.id === repFilter)),
    [cases, repFilter],
  );

  const activeCases = useMemo(
    () => filteredCases.filter((c) => c.status !== "completed" && c.status !== "cancelled"),
    [filteredCases],
  );

  const openQuotesCount = useMemo(
    () =>
      quotes.filter((q) => {
        const payload = isRecord(q.payload) ? q.payload : {};
        return payload.opsStatus !== "archived";
      }).length,
    [quotes],
  );
  const inProgressCount = useMemo(() => filteredCases.filter((c) => c.status === "in_progress").length, [filteredCases]);
  const pendingCount = useMemo(
    () => filteredCases.filter((c) => BLOCKING_STATUSES.includes(getPipelineStatus(c))).length,
    [filteredCases],
  );
  const closedCount = useMemo(() => filteredCases.filter((c) => c.status === "completed").length, [filteredCases]);
  // No exceptions/incidents tracking exists yet — placeholder until that
  // data source is defined.
  const exceptionsCount = 0;

  const urgentCases = useMemo(
    () =>
      activeCases
        .filter((c) => BLOCKING_STATUSES.includes(getPipelineStatus(c)))
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .slice(0, 5),
    [activeCases],
  );

  const recentActivity = useMemo(
    () => [...filteredCases].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5),
    [filteredCases],
  );

  const activeShipments = useMemo(
    () => [...activeCases].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6),
    [activeCases],
  );

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">תפעול</h1>
          <p className="mt-1 text-sm text-muted-foreground">ריכוז התראות וניהול יומי לצורך בקרה תפעולית.</p>
        </div>
        <Select value={repFilter} onValueChange={setRepFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="הצג תיקים">
              {repFilter === REP_FILTER_ALL
                ? "הצג תיקים · הכל"
                : `הצג תיקים · ${SERVICE_REPS.find((r) => r.id === repFilter)?.name ?? ""}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={REP_FILTER_ALL}>הצג את כל התיקים</SelectItem>
            {SERVICE_REPS.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.name} · {rep.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">טוען...</div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <KpiCard label="הצעות מחיר פתוחות" value={openQuotesCount} gradient={TONE_GRADIENT.primary} />
            <KpiCard label="תיקים בטיפול" value={inProgressCount} gradient={TONE_GRADIENT.accent} />
            <KpiCard label="תיקים ממתינים" value={pendingCount} gradient={TONE_GRADIENT.warning} />
            <KpiCard label="תיקים סגורים" value={closedCount} gradient={TONE_GRADIENT.success} />
            <KpiCard label="תיקים חריגים / בעיות" value={exceptionsCount} gradient={TONE_GRADIENT.destructive} />
          </div>

          {/* Activity / urgent row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <RadioTower className="h-4 w-4 text-muted-foreground" /> ציר זמן חי · עדכונים אחרונים
              </div>
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">אין עדכונים עדיין</div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((c) => {
                    const meta = CASE_PIPELINE_STATUS_META[getPipelineStatus(c)];
                    return (
                      <Link
                        key={c.id}
                        to="/dashboard/shipments/$id"
                        params={{ id: c.id }}
                        className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
                      >
                        <div className="flex items-start gap-2">
                          <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <div className="text-xs font-medium">
                              {meta.label} · {c.case_code}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.customer_name ?? "—"} · {c.origin_port ?? "?"} → {c.dest_port ?? "?"}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {timeHHMM(c.updated_at)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> תיקים הדורשים טיפול מיידי
                </div>
                <Badge className="bg-destructive/15 text-destructive">{urgentCases.length}</Badge>
              </div>
              {urgentCases.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">אין תיקים חוסמים כרגע</div>
              ) : (
                <div className="space-y-2">
                  {urgentCases.map((c) => {
                    const meta = CASE_PIPELINE_STATUS_META[getPipelineStatus(c)];
                    return (
                      <Link
                        key={c.id}
                        to="/dashboard/shipments/$id"
                        params={{ id: c.id }}
                        className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 hover:bg-destructive/10"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-destructive">{meta.label}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {c.case_code} · {c.origin_port ?? "?"} → {c.dest_port ?? "?"}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {relativeTimeHe(c.updated_at)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Active shipments */}
          <div className="grid grid-cols-1 gap-4">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="border-b p-4 text-sm font-semibold">משלוחים פעילים</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">מס' תיק</TableHead>
                    <TableHead className="text-right">סוג משלוח</TableHead>
                    <TableHead className="text-right">נציג מטפל</TableHead>
                    <TableHead className="text-right">מס' שטר מטען</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeShipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                        אין משלוחים פעילים
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeShipments.map((c) => {
                      const meta = CASE_PIPELINE_STATUS_META[getPipelineStatus(c)];
                      const rep = getAssignedRep(c);
                      const blNumber = getBlNumber(c);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {initials(c.customer_name)}
                              </span>
                              <span className="truncate font-medium">{c.customer_name ?? "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <Link to="/dashboard/shipments/$id" params={{ id: c.id }} className="text-primary hover:underline">
                              {c.case_code}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs">
                            {isShipKind(c.shipment_kind) ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                                  SHIP_KIND_CONFIG[c.shipment_kind].badgeClass,
                                )}
                              >
                                {(() => {
                                  const Icon = SHIP_KIND_CONFIG[c.shipment_kind as ShipKindValue].icon;
                                  return <Icon className="h-3 w-3" />;
                                })()}
                                {SHIP_KIND_CONFIG[c.shipment_kind as ShipKindValue].label}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{rep?.name || "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{blNumber ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_BADGE_CLASS[c.status]}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.arrive_date ? new Date(c.arrive_date).toLocaleDateString("he-IL") : "—"}
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
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm", gradient)}>
      <div className="text-xs font-medium opacity-90">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}
