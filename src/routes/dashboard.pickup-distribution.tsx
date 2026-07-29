import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeftRight, Plane, Ship, PackageOpen, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCases, CASE_PIPELINE_STATUS_META, type CasePipelineStatus, type CaseRep } from "@/lib/operations.functions";
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

const PICKUP_STAGE: CasePipelineStatus = "ready_for_pickup";

function PickupDistributionPage() {
  const listCasesFn = useServerFn(listCases);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });

  const pickupCases = useMemo(
    () => cases.filter((c) => getPipelineStatus(c.payload) === PICKUP_STAGE),
    [cases],
  );

  // Split the pickup/distribution list into one group per shipment kind, so
  // each kind (ייצוא/ייבוא/משלוחי דרופ/פנים ארצי) is shown separately —
  // same pattern as the Operations dashboard's active-shipments panel.
  const pickupCasesByKind = useMemo(() => {
    const groups: Record<ShipKindValue, typeof pickupCases> = { export: [], import: [], distribution: [], domestic: [] };
    for (const c of pickupCases) {
      if (isShipKind(c.shipment_kind)) groups[c.shipment_kind].push(c);
    }
    return groups;
  }, [pickupCases]);

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
            <div className="text-2xl font-bold">{pickupCases.length}</div>
          </div>
        </div>
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
                      <TableHead className="text-right">ETA</TableHead>
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
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs">
                              <div className="font-medium">{c.customer_name ?? "—"}</div>
                              {c.customer_ref ? (
                                <div className="text-[11px] text-muted-foreground">{c.customer_ref}</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <Link to="/dashboard/shipments/$id" params={{ id: c.id }} className="text-primary hover:underline">
                                {c.case_code}
                              </Link>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{rep?.name || "—"}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{blNumber ?? "—"}</TableCell>
                            <TableCell>
                              <Badge className="bg-accent/15 text-accent">{CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}</Badge>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
