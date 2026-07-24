import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  apiRequest,
  type AppUser,
  type Permission,
  type Role,
} from "@/lib/api";
import { toastApiError } from "@/lib/toast-error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/roles/$id")({
  head: () => ({
    meta: [
      { title: "Role — Cargo Console" },
      { name: "description", content: "Manage a role's permissions and members." },
    ],
  }),
  component: RoleDetailPage,
});

function RoleDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin, isLoading: meLoading } = useCurrentUser();

  const role = useQuery({
    queryKey: ["role", id],
    queryFn: () => apiRequest<Role>(`/roles/${id}`),
  });
  const allPerms = useQuery({
    queryKey: ["permissions"],
    queryFn: () => apiRequest<Permission[]>("/permissions"),
  });
  const rolePerms = useQuery({
    queryKey: ["role", id, "permissions"],
    queryFn: () => apiRequest<Permission[]>(`/roles/${id}/permissions`),
  });
  const allUsers = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest<AppUser[]>("/users"),
  });
  const roleUsers = useQuery({
    queryKey: ["role", id, "users"],
    queryFn: () => apiRequest<AppUser[]>(`/roles/${id}/users`),
  });

  const grantedIds = useMemo(
    () => new Set((rolePerms.data ?? []).map((p) => p.id)),
    [rolePerms.data],
  );
  const memberIds = useMemo(
    () => new Set((roleUsers.data ?? []).map((u) => u.id)),
    [roleUsers.data],
  );
  const unassigned = (allUsers.data ?? []).filter((u) => !memberIds.has(u.id));

  const togglePerm = useMutation({
    mutationFn: ({ pid, grant }: { pid: string; grant: boolean }) =>
      grant
        ? apiRequest(`/roles/${id}/permissions`, {
            method: "POST",
            body: { permissionId: pid },
          })
        : apiRequest(`/roles/${id}/permissions/${pid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role", id, "permissions"] }),
    onError: (e) => toastApiError(e),
  });

  const assign = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/roles/${id}/users`, { method: "POST", body: { userId } }),
    onSuccess: () => {
      toast.success("User assigned");
      qc.invalidateQueries({ queryKey: ["role", id, "users"] });
    },
    onError: (e) => toastApiError(e),
  });
  const unassign = useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/roles/${id}/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role", id, "users"] });
    },
    onError: (e) => toastApiError(e),
  });

  const [pickUser, setPickUser] = useState<string>("");

  if (!meLoading && !isAdmin) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/dashboard/roles">
            <ArrowLeft className="h-4 w-4" /> Back to roles
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {role.data?.name ?? "Role"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Toggle permissions and manage which users hold this role.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Permissions
          </h2>
          <div className="mt-4 space-y-2">
            {(allPerms.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions defined yet.</p>
            ) : (
              (allPerms.data ?? []).map((p) => {
                const granted = grantedIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={granted}
                      disabled={togglePerm.isPending}
                      onCheckedChange={(v) =>
                        togglePerm.mutate({ pid: p.id, grant: Boolean(v) })
                      }
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Assigned users
          </h2>
          <div className="mt-4 flex gap-2">
            <Select value={pickUser} onValueChange={setPickUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pick a user…" />
              </SelectTrigger>
              <SelectContent>
                {unassigned.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Everyone is already assigned.
                  </div>
                ) : (
                  unassigned.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {u.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              disabled={!pickUser || assign.isPending}
              onClick={() => {
                assign.mutate(pickUser);
                setPickUser("");
              }}
            >
              Assign
            </Button>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(roleUsers.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (roleUsers.data ?? []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unassign.mutate(u.id)}
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
