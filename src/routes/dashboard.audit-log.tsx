import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  apiRequest,
  type AppUser,
  type AuditLogEntry,
  type Paginated,
} from "@/lib/api";
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
      { title: "Audit Log — Cargo Console" },
      { name: "description", content: "Every change made in your organization." },
    ],
  }),
  component: AuditLogPage,
});

const REDACT_KEYS = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "passwordHash",
]);

function redact(obj: Record<string, unknown> | undefined) {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k) ? "••••••" : v;
  }
  return out;
}

const ACTION_STYLE = {
  CREATE: "bg-success/15 text-success",
  UPDATE: "bg-accent/15 text-accent",
  DELETE: "bg-destructive/15 text-destructive",
} as const;

function AuditLogPage() {
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const [filters, setFilters] = useState({
    entityType: "",
    entityId: "",
    actorUserId: "",
    from: "",
    to: "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest<AppUser[]>("/users"),
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users.data ?? [])
      map.set(u.id, `${u.firstName} ${u.lastName}`.trim() || u.email);
    return map;
  }, [users.data]);

  const logs = useQuery({
    queryKey: ["audit-logs", applied, page],
    queryFn: () =>
      apiRequest<Paginated<AuditLogEntry>>("/audit-logs", {
        query: {
          entityType: applied.entityType || undefined,
          entityId: applied.entityId || undefined,
          actorUserId: applied.actorUserId || undefined,
          from: applied.from ? new Date(applied.from).toISOString() : undefined,
          to: applied.to ? new Date(applied.to).toISOString() : undefined,
          page,
          pageSize,
        },
      }),
  });

  const total = logs.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!meLoading && !isAdmin) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Audit Log" description="Who changed what, and when." />

      <form
        className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(filters);
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Entity type</Label>
          <Input
            value={filters.entityType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, entityType: e.target.value }))
            }
            placeholder="shipment"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Entity ID</Label>
          <Input
            value={filters.entityId}
            onChange={(e) => setFilters((f) => ({ ...f, entityId: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actor user ID</Label>
          <Input
            value={filters.actorUserId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, actorUserId: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="md:col-span-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const empty = {
                entityType: "",
                entityId: "",
                actorUserId: "",
                from: "",
                to: "",
              };
              setFilters(empty);
              setApplied(empty);
              setPage(1);
            }}
          >
            Clear
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      <div className="space-y-3">
        {logs.isLoading ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (logs.data?.data ?? []).length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No entries match your filters.
          </div>
        ) : (
          (logs.data?.data ?? []).map((e) => {
            const before = redact(e.changes?.before);
            const after = redact(e.changes?.after);
            const fieldKeys = Array.from(
              new Set([...Object.keys(before), ...Object.keys(after)]),
            );
            const actor =
              (e.actorUserId && userNameById.get(e.actorUserId)) ??
              e.actorUserId ??
              "system";
            return (
              <div key={e.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className={ACTION_STYLE[e.action]}>{e.action}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {e.entityType}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{e.entityId}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-foreground">
                  by <span className="font-medium">{actor}</span>
                </div>
                {e.action === "UPDATE" && fieldKeys.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2 text-left">Field</th>
                          <th className="p-2 text-left">Before</th>
                          <th className="p-2 text-left">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldKeys.map((k) => (
                          <tr key={k} className="border-t">
                            <td className="p-2 font-mono">{k}</td>
                            <td className="p-2 font-mono text-muted-foreground">
                              {formatValue(before[k])}
                            </td>
                            <td className="p-2 font-mono">{formatValue(after[k])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {total} total · page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatValue(v: unknown) {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
