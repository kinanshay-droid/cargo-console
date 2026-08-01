import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAuditLog } from "@/lib/admin.functions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/audit-log")({
  head: () => ({
    meta: [
      { title: "יומן ביקורת — AFIK Logistics Platform" },
      { name: "description", content: "מי שינה מה, ומתי." },
    ],
  }),
  component: AuditLogPage,
});

const ACTION_STYLE: Record<string, string> = {
  create: "bg-success/15 text-success",
  update: "bg-accent/15 text-accent",
  delete: "bg-destructive/15 text-destructive",
};

function AuditLogPage() {
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const listAuditLogFn = useServerFn(listAuditLog);
  const [filters, setFilters] = useState({ entityType: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", applied],
    queryFn: () =>
      listAuditLogFn({
        data: {
          entityType: applied.entityType || undefined,
          from: applied.from ? new Date(applied.from).toISOString() : undefined,
          to: applied.to ? new Date(applied.to).toISOString() : undefined,
        },
      }),
    enabled: isAdmin,
  });

  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;

  return (
    <div className="mx-auto max-w-5xl" dir="rtl">
      <PageHeader title="יומן ביקורת" description="מי שינה מה, ומתי — עד 200 הרשומות האחרונות." />

      <form
        className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">סוג ישות</Label>
          <Input
            value={filters.entityType}
            onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
            placeholder="לדוגמה: customer"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">מתאריך</Label>
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">עד תאריך</Label>
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </div>
        <div className="md:col-span-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const empty = { entityType: "", from: "", to: "" };
              setFilters(empty);
              setApplied(empty);
            }}
          >
            נקה
          </Button>
          <Button type="submit">החל סינון</Button>
        </div>
      </form>

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">טוען…</div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            אין רשומות שתואמות את הסינון שלך.
          </div>
        ) : (
          logs.map((e) => (
            <div key={e.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className={ACTION_STYLE[e.action.toLowerCase()] ?? "bg-muted text-muted-foreground"}>{e.action}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{e.entityType}</span>
                {e.entityId && <span className="font-mono text-xs text-muted-foreground">#{e.entityId}</span>}
                <span className="mr-auto text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("he-IL")}
                </span>
              </div>
              <div className="mt-1 text-sm text-foreground">
                בוצע על ידי <span className="font-medium">{e.actorName ?? "מערכת"}</span>
              </div>
              {e.changes ? (
                <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(e.changes, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
