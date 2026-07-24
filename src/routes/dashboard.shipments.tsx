import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Truck, Package, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/dashboard/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments — Cargo Console" },
      { name: "description", content: "Track and manage every shipment." },
    ],
  }),
  component: ShipmentsPage,
});

type DbStatus = "pending" | "in_transit" | "delivered" | "cancelled";
type UiStatus = "DRAFT" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";

interface ShipmentRow {
  id: string;
  reference_code: string;
  origin: string;
  destination: string;
  notes: string | null;
  status: DbStatus;
}

const DB_TO_UI: Record<DbStatus, UiStatus> = {
  pending: "DRAFT",
  in_transit: "IN_TRANSIT",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};
const UI_TO_DB: Record<UiStatus, DbStatus> = {
  DRAFT: "pending",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

const NEXT_STATUSES: Record<UiStatus, { status: UiStatus; label: string }[]> = {
  DRAFT: [
    { status: "IN_TRANSIT", label: "Mark in transit" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  IN_TRANSIT: [
    { status: "DELIVERED", label: "Mark delivered" },
    { status: "CANCELLED", label: "Cancel" },
  ],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_META: Record<
  UiStatus,
  { label: string; className: string; icon: typeof Truck }
> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground", icon: Package },
  IN_TRANSIT: { label: "In transit", className: "bg-accent/15 text-accent", icon: Truck },
  DELIVERED: { label: "Delivered", className: "bg-success/15 text-success", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", className: "bg-destructive/15 text-destructive", icon: XCircle },
};

function ShipmentsPage() {
  const qc = useQueryClient();
  const { user } = useCurrentUser();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments"],
    queryFn: async (): Promise<ShipmentRow[]> => {
      const { data, error } = await supabase
        .from("shipments")
        .select("id, reference_code, origin, destination, notes, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ShipmentRow[];
    },
    enabled: !!user,
  });

  const counts: Record<UiStatus, number> = { DRAFT: 0, IN_TRANSIT: 0, DELIVERED: 0, CANCELLED: 0 };
  for (const s of shipments) counts[DB_TO_UI[s.status]]++;

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UiStatus }) => {
      const { error } = await supabase
        .from("shipments")
        .update({ status: UI_TO_DB[status] })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["shipments"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update status"),
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Shipments"
        description="Every shipment your organization is tracking."
        action={<NewShipmentDialog onCreated={() => qc.invalidateQueries({ queryKey: ["shipments"] })} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["DRAFT", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as UiStatus[]).map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <div key={s} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{meta.label}</span>
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${meta.className}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{counts[s]}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No shipments yet. Create your first one to get started.
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((s) => {
                const ui = DB_TO_UI[s.status];
                const meta = STATUS_META[ui];
                const next = NEXT_STATUSES[ui];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.reference_code}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                      {s.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.origin} <span className="text-muted-foreground">→</span> {s.destination}
                    </TableCell>
                    <TableCell>
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {next.map((n) => {
                          const isCancel = n.status === "CANCELLED";
                          const btn = (
                            <Button
                              key={n.status}
                              size="sm"
                              variant={isCancel ? "outline" : "default"}
                              disabled={advance.isPending}
                              onClick={isCancel ? undefined : () => advance.mutate({ id: s.id, status: n.status })}
                            >
                              {n.label}
                            </Button>
                          );
                          return isCancel ? (
                            <ConfirmDialog
                              key={n.status}
                              title={`Cancel ${s.reference_code}?`}
                              description="This shipment will be moved to Cancelled and can't be reactivated."
                              confirmLabel="Cancel shipment"
                              cancelLabel="Keep it"
                              destructive
                              onConfirm={() => advance.mutate({ id: s.id, status: n.status })}
                              trigger={btn}
                            />
                          ) : (
                            btn
                          );
                        })}
                      </div>
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

function NewShipmentDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    referenceCode: "",
    origin: "",
    destination: "",
    description: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.organizationId) throw new Error("No organization on your profile yet.");
      const { error } = await supabase.from("shipments").insert({
        organization_id: user.organizationId,
        created_by: user.id,
        reference_code: form.referenceCode.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        notes: form.description.trim() || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shipment created");
      setOpen(false);
      setForm({ referenceCode: "", origin: "", destination: "", description: "" });
      onCreated();
    },
    onError: (e: Error) => {
      const msg = e.message?.includes("duplicate")
        ? "That reference code is already used."
        : e.message || "Couldn't create shipment";
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New shipment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New shipment</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Reference code</Label>
            <Input
              required
              value={form.referenceCode}
              onChange={(e) => setForm((f) => ({ ...f, referenceCode: e.target.value }))}
              placeholder="SHP-000123"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origin</Label>
              <Input
                required
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Input
                required
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create shipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
