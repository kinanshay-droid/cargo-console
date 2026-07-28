import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeftRight, FolderOpen, Plane, Ship, PackageOpen, Truck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { listCases, CASE_PIPELINE_STATUS_META, type CasePipelineStatus } from "@/lib/operations.functions";
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מס' תיק</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">מסלול</TableHead>
              <TableHead className="text-right">סוג משלוח</TableHead>
              <TableHead className="text-right">סטטוס תפעולי</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  טוען...
                </TableCell>
              </TableRow>
            ) : pickupCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <div className="text-base font-medium">אין משלוחים מוכנים לאיסוף/הפצה כרגע</div>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    תיק יופיע כאן אוטומטית כשסטטוס התיק בעמוד "משלוחים" יעודכן ל"מוכן לאיסוף".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              pickupCases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.case_code}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{c.customer_name ?? "—"}</div>
                    {c.customer_ref ? (
                      <div className="text-xs text-muted-foreground">{c.customer_ref}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.origin_port ?? "—"} <span className="text-muted-foreground">→</span> {c.dest_port ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {isShipKind(c.shipment_kind) ? (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", SHIP_KIND_CONFIG[c.shipment_kind].badgeClass)}>
                        {(() => {
                          const Icon = SHIP_KIND_CONFIG[c.shipment_kind].icon;
                          return <Icon className="h-3 w-3" />;
                        })()}
                        {SHIP_KIND_CONFIG[c.shipment_kind].label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-accent/15 text-accent">{CASE_PIPELINE_STATUS_META[PICKUP_STAGE].label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline" className="gap-2">
                      <Link to="/dashboard/shipments/$id" params={{ id: c.id }}>
                        <FolderOpen className="h-3.5 w-3.5" /> פתח תיק
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
