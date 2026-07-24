import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, KeyRound, Trash2 } from "lucide-react";
import { apiRequest, getSessionEmail, type AppUser, type UserStatus } from "@/lib/api";
import { toastApiError } from "@/lib/toast-error";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({
    meta: [
      { title: "Users — Cargo Console" },
      { name: "description", content: "Manage members of your organization." },
    ],
  }),
  component: UsersPage,
});

const STATUS_STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  INACTIVE: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-destructive/15 text-destructive",
};

function UsersPage() {
  const qc = useQueryClient();
  const currentEmail = getSessionEmail();
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const [resetForId, setResetForId] = useState<string | null>(null);

  if (!meLoading && !isAdmin) return <AccessDenied />;

  return <UsersPageInner qc={qc} currentEmail={currentEmail} resetForId={resetForId} setResetForId={setResetForId} />;
}

function UsersPageInner({
  qc,
  currentEmail,
  resetForId,
  setResetForId,
}: {
  qc: ReturnType<typeof useQueryClient>;
  currentEmail: string | null;
  resetForId: string | null;
  setResetForId: (v: string | null) => void;
}) {

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiRequest<AppUser[]>("/users"),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiRequest<AppUser>(`/users/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toastApiError(e),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toastApiError(e),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Users"
        description="Everyone with access to your organization."
        action={<NewUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />}
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = currentEmail && u.email === currentEmail;
                return (
                  <>
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.firstName} {u.lastName}
                        {isSelf ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLE[u.status]}>{u.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">
                            manage your own account in Account
                          </span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <ConfirmDialog
                              title={u.status === "ACTIVE" ? "Deactivate user?" : "Reactivate user?"}
                              description={
                                u.status === "ACTIVE"
                                  ? `${u.email} will lose access until reactivated.`
                                  : `${u.email} will regain access to the organization.`
                              }
                              confirmLabel={u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                              destructive={u.status === "ACTIVE"}
                              onConfirm={() =>
                                toggleStatus.mutate({
                                  id: u.id,
                                  status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                                })
                              }
                              trigger={
                                <Button size="sm" variant="outline" disabled={toggleStatus.isPending}>
                                  {u.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                                </Button>
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setResetForId(resetForId === u.id ? null : u.id)
                              }
                            >
                              <KeyRound className="h-3.5 w-3.5" /> Reset password
                            </Button>
                            <ConfirmDialog
                              title={`Remove ${u.email}?`}
                              description="This user will lose access immediately. This can't be undone."
                              confirmLabel="Remove user"
                              destructive
                              onConfirm={() => remove.mutate(u.id)}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  disabled={remove.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Remove
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {resetForId === u.id && !isSelf ? (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/40">
                          <ResetPasswordInline
                            userId={u.id}
                            onDone={() => setResetForId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ResetPasswordInline({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/users/${userId}/password`, {
        method: "PATCH",
        body: { newPassword: pwd },
      }),
    onSuccess: () => {
      toast.success("Password reset. The user has been signed out of every device.");
      onDone();
    },
    onError: (e) => toastApiError(e),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pwd !== confirmPwd) return toast.error("Passwords don't match");
        mutation.mutate();
      }}
    >
      <div className="space-y-1">
        <Label className="text-xs">New password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Confirm password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
        />
      </div>
      <Button size="sm" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Reset password"}
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest<AppUser>("/users", { method: "POST", body: form }),
    onSuccess: () => {
      toast.success("User created");
      setOpen(false);
      setForm({ firstName: "", lastName: "", email: "", password: "" });
      onCreated();
    },
    onError: (e) => toastApiError(e),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password</Label>
            <Input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
