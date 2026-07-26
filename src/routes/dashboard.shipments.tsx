import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Briefcase, CheckCircle2, Clock, FolderOpen, XCircle } from "lucide-react";
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
import { listCases, type CaseStatus } from "@/lib/operations.functions";
import { TONE_GRADIENT } from "@/lib/theme";

export const Route = createFileRoute("/dashboard/shipments")({
  head: () => ({
    meta: [
      { title: "משלוחים — AFIK Logistics Platform" },
      {
        name: "description",
        content: "תיקים תפעוליים שנפתחו מהצעות מחיר שהועברו — מעקב סטטוס מקצה לקצה.",
      },
      { property: "og:title", content: "משלוחים — AFIK Logistics Platform" },
      { property: "og:description", content: "מעקב תיקים ומשלוחים." },
    ],
  }),
  component: ShipmentsDashboard,
});

const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  new: "חדש",
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "מבוטל",
};

const CASE_STATUS_META: Record<CaseStatus, { className: string; icon: typeof Briefcase }> = {
  new: { className: "bg-primary/10 text-primary", icon: Briefcase },
  in_progress: { className: "bg-accent/15 text-accent", icon: Clock },
  completed: { className: "bg-success/15 text-success", icon: CheckCircle2 },
  cancelled: { className: "bg-destructive/15 text-destructive", icon: XCircle },
};

// Same gradient family used by the commercial + operations hero cards, one
// per case status.
const CASE_STATUS_GRADIENT: Record<CaseStatus, string> = {
  new: TONE_GRADIENT.primary,
  in_progress: TONE_GRADIENT.accent,
  completed: TONE_GRADIENT.success,
  cancelled: TONE_GRADIENT.destructive,
};

const SHIPMENT_MODE_LABEL: Record<string, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};

function ShipmentsDashboard() {
  const listCasesFn = useServerFn(listCases);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });

  const counts: Record<CaseStatus, number> = { new: 0, in_progress: 0, completed: 0, cancelled: 0 };
  for (const c of cases) counts[c.status]++;

  const recentByStatus = useMemo(() => {
    const result = {} as Record<CaseStatus, typeof cases>;
    for (const s of ["new", "in_progress", "completed", "cancelled"] as CaseStatus[]) {
      result[s] = cases
        .filter((c) => c.status === s)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
    }
    return result;
  }, [cases]);

  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    setHighlightId(sessionStorage.getItem("highlight-case"));
  }, []);

  useEffect(() => {
    if (!highlightId || cases.length === 0) return;
    sessionStorage.removeItem("highlight-case");
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [highlightId, cases.length]);

  return (
    <div dir="rtl" className="space-y-6">
      <PageHeader
        title="משלוחים"
        description="תיקים תפעוליים שנפתחו מהצעות מחיר שהועברו — מעקב סטטוס מקצה לקצה."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(["new", "in_progress", "completed", "cancelled"] as CaseStatus[]).map((s) => (
          <StatusHeroCard key={s} status={s} count={counts[s]} items={recentByStatus[s]} />
        ))}
      </div>

      <div id="shipments-table" className="overflow-hidden rounded-lg border bg-card scroll-mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מס' תיק</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">מסלול</TableHead>
              <TableHead className="text-right">סוג משלוח</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
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
            ) : cases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <div className="text-base font-medium">אין תיקים עדיין</div>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    תיק נפתח כאן אוטומטית כשמעדכנים סטטוס הצעת מחיר ל"הועבר".
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              cases.map((c) => {
                const meta = CASE_STATUS_META[c.status];
                const isHighlighted = c.id === highlightId;
                return (
                  <TableRow
                    key={c.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={isHighlighted ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : undefined}
                  >
                    <TableCell className="font-mono text-sm">
                      {c.quote_id ? (
                        <Link
                          to="/dashboard/quotes/$id"
                          params={{ id: c.quote_id }}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {c.case_code}
                        </Link>
                      ) : (
                        c.case_code
                      )}
                    </TableCell>
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
                      {SHIPMENT_MODE_LABEL[c.shipment_mode] ?? c.shipment_mode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={meta.className}>{CASE_STATUS_LABEL[c.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline" className="gap-2">
                        <Link to="/dashboard/shipments/$id" params={{ id: c.id }}>
                          <FolderOpen className="h-3.5 w-3.5" /> פתח תיק
                        </Link>
                      </Button>
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

function StatusHeroCard({
  status,
  count,
  items,
}: {
  status: CaseStatus;
  count: number;
  items: { id: string; case_code: string; customer_name: string | null; created_at: string }[];
}) {
  const meta = CASE_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className={cn("bg-gradient-to-br p-4 text-white", CASE_STATUS_GRADIENT[status])}>
        <div className="flex items-center gap-1.5 text-sm/6 opacity-90">
          <Icon className="h-3.5 w-3.5" /> {CASE_STATUS_LABEL[status]}
        </div>
        <div className="mt-1 text-3xl font-bold">{count}</div>
      </div>
      <div className="min-h-[92px] space-y-1 p-3">
        {items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">אין תיקים</div>
        ) : (
          items.map((it) => (
            <Link
              key={it.id}
              to="/dashboard/shipments/$id"
              params={{ id: it.id }}
              className="flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border hover:bg-muted/50"
            >
              <span className="text-muted-foreground">{new Date(it.created_at).toLocaleDateString("he-IL")}</span>
              <span className="truncate font-medium">
                {it.customer_name ? `${it.customer_name} · ` : ""}#{it.case_code}
              </span>
            </Link>
          ))
        )}
      </div>
      <a href="#shipments-table" className={heroFooterCls}>
        <FolderOpen className="h-3.5 w-3.5" /> לצפייה בטבלה המלאה
      </a>
    </div>
  );
}

// dir="ltr" isn't needed here since these footers use a plain <a>, not a
// mix of <button>/<Link>, so icon/text order is already consistent — see
// dashboard.commercial.tsx for the case where it mattered.
const heroFooterCls =
  "flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-xs font-medium text-primary hover:bg-muted/50";
