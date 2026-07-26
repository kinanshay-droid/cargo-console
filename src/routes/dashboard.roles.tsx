import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { apiRequest, type Role } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toastApiError } from "@/lib/toast-error";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/dashboard/roles")({
  head: () => ({
    meta: [
      { title: "Roles — AFIK Logistics Platform" },
      { name: "description", content: "Define roles and what they can do." },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiRequest<Role[]>("/roles"),
  });
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => apiRequest<Role>("/roles", { method: "POST", body: { name } }),
    onSuccess: () => {
      toast.success("Role created");
      setName("");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e) => toastApiError(e),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e) => toastApiError(e),
  });

  if (!meLoading && !isAdmin) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Roles"
        description="Group permissions together and assign them to users."
      />

      <form
        className="mb-6 flex items-end gap-3 rounded-lg border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label>New role name</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dispatcher"
          />
        </div>
        <Button type="submit" disabled={create.isPending}>
          <Plus className="h-4 w-4" /> Create role
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  No roles yet.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/dashboard/roles/$id"
                          params={{ id: r.id }}
                        >
                          <Settings2 className="h-3.5 w-3.5" /> Manage
                        </Link>
                      </Button>
                      <ConfirmDialog
                        title={`Delete role "${r.name}"?`}
                        description="Members assigned to this role will lose the permissions it grants. This can't be undone."
                        confirmLabel="Delete role"
                        destructive
                        onConfirm={() => remove.mutate(r.id)}
                        trigger={
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        }
                      />
                    </div>
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
