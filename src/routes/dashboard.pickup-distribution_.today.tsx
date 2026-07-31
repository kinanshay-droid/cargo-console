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
      { title: "משימות להיום — איסוף/הפצה — AFIK Logistics Platform" },
      { name: "description", content: "משלוחי איסוף/הפצה שמועד הביצוע שלהם הוא היום." },
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

function getBlNumber(payload: unknown): string | null {
  const p = isRecord(payload) ? payload : {};
  const raw = p.blNumber;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function getPickupDueDate(payload: unknown): string | null {
  const p = isRecord(payload) ? payload : {};
  const raw = p.pickupDueDate;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
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

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [],
  );

  return (
    <div dir="rtl" className="space-y-6">
      <PageHeader
        title="משימות להיום"
        description={`איסוף/הפצה — ${todayLabel}`}
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

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">מס' תיק</TableHead>
              <TableHead className="text-right">סוג משלוח</TableHead>
              <TableHead className="text-right">נציג מטפל</TableHead>
              <TableHead className="text-right">מס' שטר מטען</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            ) : todayCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  אין משימות מתוזמנות להיום
                </TableCell>
              </TableRow>
            ) : (
              todayCases.map((c) => {
                const rep = getAssignedRep(c.payload);
                const blNumber = getBlNumber(c.payload);
                const kind = isShipKind(c.shipment_kind) ? SHIP_KIND_CONFIG[c.shipment_kind] : null;
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
                    <TableCell>
                      {kind ? (
                        <Badge className={cn("gap-1", kind.badgeClass)}>
                          <kind.icon className="h-3 w-3" /> {kind.label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rep?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{blNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-accent/15 text-accent">{CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
