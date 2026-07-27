import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  PackageCheck,
  RadioTower,
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
import { AIRPORTS } from "@/lib/airports";

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

// Rough country centroids (percent of the panel, same 0-100 scheme as the
// continent silhouettes below) — used to place ANY airport/port code
// roughly in the right part of the world by looking up its country via
// src/lib/airports.ts, since we don't have real per-airport coordinates.
// This is still schematic, not a real map projection.
const COUNTRY_POS: Record<string, { x: number; y: number }> = {
  US: { x: 16, y: 36 }, CA: { x: 18, y: 18 }, MX: { x: 13, y: 50 },
  BR: { x: 28, y: 68 }, AR: { x: 24, y: 80 }, CL: { x: 20, y: 78 },
  GB: { x: 45, y: 20 }, IE: { x: 42, y: 20 }, FR: { x: 46, y: 28 },
  DE: { x: 49, y: 23 }, NL: { x: 47, y: 21 }, BE: { x: 47, y: 22 },
  IT: { x: 50, y: 33 }, ES: { x: 42, y: 35 }, PT: { x: 39, y: 35 },
  CH: { x: 48, y: 27 }, PL: { x: 51, y: 21 }, RU: { x: 66, y: 14 },
  IL: { x: 57, y: 44 }, AE: { x: 63, y: 49 }, SA: { x: 59, y: 51 },
  TR: { x: 54, y: 34 }, EG: { x: 54, y: 49 }, ZA: { x: 52, y: 78 },
  IN: { x: 68, y: 54 }, CN: { x: 78, y: 34 }, JP: { x: 88, y: 31 },
  KR: { x: 84, y: 31 }, SG: { x: 77, y: 62 }, HK: { x: 81, y: 47 },
  TH: { x: 74, y: 57 }, VN: { x: 75, y: 57 }, ID: { x: 77, y: 69 },
  AU: { x: 85, y: 74 }, NZ: { x: 92, y: 82 },
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Resolve a port code to a plotting position: known country centroid (with a
// small deterministic jitter so airports sharing a country don't fully
// overlap), or a deterministic pseudo-random fallback if the code isn't in
// the airports table at all.
function getPortPos(code: string): { x: number; y: number } {
  const h = hashCode(code);
  const airport = AIRPORTS.find((a) => a.iata === code);
  const base = airport ? COUNTRY_POS[airport.iso2] : undefined;
  if (base) {
    const jitterX = (h % 7) - 3;
    const jitterY = ((h >> 3) % 7) - 3;
    return {
      x: Math.min(96, Math.max(4, base.x + jitterX)),
      y: Math.min(90, Math.max(8, base.y + jitterY)),
    };
  }
  return { x: 10 + (h % 80), y: 12 + ((h >> 4) % 70) };
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

  // Each active case's real route: origin → transit stops → destination, in
  // order, exactly as defined on the case. Used both for the node counts and
  // for drawing one connector per leg per case.
  const caseRoutes = useMemo(() => {
    return activeCases
      .map((c) => {
        const path = [c.origin_port, ...(c.transit_ports ?? []), c.dest_port]
          .map((p) => p?.trim().toUpperCase())
          .filter((p): p is string => Boolean(p));
        return { id: c.id, path };
      })
      .filter((r) => r.path.length >= 2);
  }, [activeCases]);

  const mapPoints = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of caseRoutes) {
      for (const code of r.path) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([code, count]) => ({ code, count, ...getPortPos(code) }));
  }, [caseRoutes]);

  const posByCode = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const p of mapPoints) map.set(p.code, { x: p.x, y: p.y });
    return map;
  }, [mapPoints]);

  // One segment per leg per case (capped to keep the SVG light).
  const routeSegments = useMemo(() => {
    const segments: { key: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
    for (const r of caseRoutes.slice(0, 25)) {
      for (let i = 0; i < r.path.length - 1; i++) {
        const from = posByCode.get(r.path[i]);
        const to = posByCode.get(r.path[i + 1]);
        if (from && to) segments.push({ key: `${r.id}-${i}`, from, to });
      }
    }
    return segments;
  }, [caseRoutes, posByCode]);

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

          {/* Active shipments / map row */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="border-b p-4 text-sm font-semibold">משלוחים פעילים</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">מס' תיק</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeShipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                        אין משלוחים פעילים
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeShipments.map((c) => {
                      const meta = CASE_PIPELINE_STATUS_META[getPipelineStatus(c)];
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

            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-muted-foreground" /> מפת משלוחים פעילים
              </div>
              <div className="relative h-56 overflow-hidden rounded-xl border bg-accent/5 dark:bg-muted">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  {/* Stylized continent silhouettes — decorative, not a real projection */}
                  <g className="fill-muted-foreground/25">
                    <ellipse cx="15" cy="25" rx="10" ry="8" />
                    <ellipse cx="22" cy="33" rx="7" ry="10" />
                    <ellipse cx="23" cy="60" rx="6" ry="13" />
                    <ellipse cx="48" cy="20" rx="6" ry="5" />
                    <ellipse cx="50" cy="46" rx="8" ry="15" />
                    <ellipse cx="68" cy="30" rx="18" ry="12" />
                    <ellipse cx="76" cy="46" rx="12" ry="10" />
                    <ellipse cx="85" cy="68" rx="7" ry="5" />
                  </g>
                  {routeSegments.map((seg) => {
                    const mx = (seg.from.x + seg.to.x) / 2;
                    const my = Math.min(seg.from.y, seg.to.y) - 8;
                    return (
                      <path
                        key={seg.key}
                        d={`M ${seg.from.x} ${seg.from.y} Q ${mx} ${my} ${seg.to.x} ${seg.to.y}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={0.5}
                        strokeDasharray="1.6 1.6"
                        className="text-primary/60"
                      />
                    );
                  })}
                </svg>
                {mapPoints.length === 0 ? (
                  <div className="relative flex h-full items-center justify-center text-xs text-muted-foreground">
                    אין נתוני מסלול להצגה
                  </div>
                ) : (
                  mapPoints.map((p) => (
                    <div
                      key={p.code}
                      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                      style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-md">
                        {p.count}
                      </span>
                      <span className="rounded bg-background/90 px-1.5 text-[10px] font-medium text-foreground shadow-sm">
                        {p.code}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link
                to="/dashboard/shipments"
                className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> למעקב מפורט
              </Link>
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
