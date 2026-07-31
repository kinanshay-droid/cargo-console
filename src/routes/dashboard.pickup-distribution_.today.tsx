import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight, CalendarCheck2, Plane, Ship, PackageOpen, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/dashboard/pickup-distribution/today")({
  head: () => ({
    meta: [
      { title: "משימות להיום — צוות הבלדרים — AFIK Logistics Platform" },
      { name: "description", content: "דשבורד תפעול איסוף/הפצה לצוות הבלדרים — משימות מתוזמנות להיום." },
    ],
  }),
  component: TodayTasksPage,
});

// Same four categories used across the New Quote wizard / Shipments /
// Pickup-Distribution pages — duplicated locally per this codebase's
// per-file convention.
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

function toText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getPipelineStatus(payload: unknown): CasePipelineStatus {
  const p = isRecord(payload) ? payload : {};
  const raw = p.pipelineStatus;
  return typeof raw === "string" && raw in CASE_PIPELINE_STATUS_META ? (raw as CasePipelineStatus) : "new";
}

function getPickupDueDate(payload: unknown): string | null {
  const p = isRecord(payload) ? payload : {};
  const raw = p.pickupDueDate;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

// Mirrors the same payload.critilog columns edited on the case detail page's
// "מעקב" section (itself mirroring the CritiLog operational tracking sheet)
// — this is the exact set of columns the courier team's own reference sheet
// uses day to day (see "דשבורד תפעול אסוף הפצה.xlsx"): Name / לקוח / איש
// שירות / שטר מטען / REF / לתפעול / ניתוב / איסוף-מסירה בישראל / סוג /
// בלדר / סטטוס לבדיקה.
type CritiLogRow = {
  name: string;
  serviceRep: string;
  blNumber: string;
  customer: string;
  ref: string;
  route: string;
  type: string;
  reviewStatus: string;
  opsNotes: string;
  pickupIsrael: string;
  courier: string;
};

function getCritiLog(payload: unknown): CritiLogRow {
  const p = isRecord(payload) ? payload : {};
  const raw = isRecord(p.critilog) ? p.critilog : {};
  return {
    name: toText(raw.name),
    serviceRep: toText(raw.serviceRep),
    blNumber: toText(raw.blNumber),
    customer: toText(raw.customer),
    ref: toText(raw.ref),
    route: toText(raw.route),
    type: toText(raw.type),
    reviewStatus: toText(raw.reviewStatus),
    opsNotes: toText(raw.opsNotes),
    pickupIsrael: toText(raw.pickupIsrael),
    courier: toText(raw.courier),
  };
}

function formatPickupIsrael(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) + (hasTime ? ` · ${d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "");
}

const PICKUP_STAGE: CasePipelineStatus = "ready_for_pickup";

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function TodayTasksPage() {
  const navigate = useNavigate();
  const listCasesFn = useServerFn(listCases);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });

  const todayCases = useMemo(
    () =>
      cases.filter((c) => {
        if (getPipelineStatus(c.payload) !== PICKUP_STAGE) return false;
        const due = getPickupDueDate(c.payload);
        return !!due && isToday(due);
      }),
    [cases],
  );

  const todayCasesByKind = useMemo(() => {
    const groups: Record<ShipKindValue, typeof todayCases> = { export: [], import: [], distribution: [], domestic: [] };
    for (const c of todayCases) {
      if (isShipKind(c.shipment_kind)) groups[c.shipment_kind].push(c);
    }
    return groups;
  }, [todayCases]);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [],
  );

  return (
    <div dir="rtl" className="space-y-6">
      <PageHeader
        title="דשבורד תפעול — צוות הבלדרים"
        description={`משימות איסוף/הפצה מתוזמנות להיום — ${todayLabel}`}
        action={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/pickup-distribution">
              <ArrowRight className="h-4 w-4" /> חזרה לאיסוף/הפצה
            </Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className={cn("flex items-center gap-3 bg-gradient-to-br p-4 text-white", TONE_GRADIENT.accent)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <CalendarCheck2 className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm/6 opacity-90">משימות מתוזמנות להיום</div>
            <div className="text-2xl font-bold">{todayCases.length}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card py-10 text-center text-muted-foreground">טוען...</div>
      ) : todayCases.length === 0 ? (
        <div className="rounded-2xl border bg-card py-10 text-center text-sm text-muted-foreground">
          אין משימות מתוזמנות להיום
        </div>
      ) : (
        <div className="space-y-4">
          {SHIP_KIND_ORDER.map((kind) => {
            const kindCases = todayCasesByKind[kind];
            if (kindCases.length === 0) return null;
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-right">מס' תיק</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Name</TableHead>
                        <TableHead className="whitespace-nowrap text-right">לקוח</TableHead>
                        <TableHead className="whitespace-nowrap text-right">איש שירות</TableHead>
                        <TableHead className="whitespace-nowrap text-right">שטר מטען</TableHead>
                        <TableHead className="whitespace-nowrap text-right">REF</TableHead>
                        <TableHead className="whitespace-nowrap text-right">לתפעול</TableHead>
                        <TableHead className="whitespace-nowrap text-right">ניתוב</TableHead>
                        <TableHead className="whitespace-nowrap text-right">איסוף/מסירה בישראל</TableHead>
                        <TableHead className="whitespace-nowrap text-right">סוג</TableHead>
                        <TableHead className="whitespace-nowrap text-right">בלדר</TableHead>
                        <TableHead className="whitespace-nowrap text-right">סטטוס לבדיקה</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kindCases.map((c) => {
                        const cl = getCritiLog(c.payload);
                        return (
                          <TableRow
                            key={c.id}
                            onClick={() => navigate({ to: "/dashboard/shipments/$id", params: { id: c.id } })}
                            className="cursor-pointer hover:bg-muted/40"
                          >
                            <TableCell className="whitespace-nowrap font-mono text-xs">
                              <Link
                                to="/dashboard/shipments/$id"
                                params={{ id: c.id }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline"
                              >
                                {getCaseDisplayCode(c.payload, c.case_code)}
                              </Link>
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{cl.name || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{cl.customer || c.customer_name || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{cl.serviceRep || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{cl.blNumber || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{cl.ref || c.customer_ref || "—"}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={cl.opsNotes}>
                              {cl.opsNotes || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{cl.route || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatPickupIsrael(cl.pickupIsrael)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{cl.type || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs font-medium">{cl.courier || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {cl.reviewStatus ? (
                                <Badge className="bg-accent/15 text-accent">{cl.reviewStatus}</Badge>
                              ) : (
                                <Badge className="bg-accent/15 text-accent">{CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
