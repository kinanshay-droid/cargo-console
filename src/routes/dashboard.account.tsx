import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, clearToken } from "@/lib/api";
import { toastApiError } from "@/lib/toast-error";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/account")({
  head: () => ({
    meta: [
      { title: "Account — AFIK Logistics Platform" },
      { name: "description", content: "Update your password and email." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Account"
        description="Manage your own login credentials."
      />
      <div className="space-y-6">
        <ChangePasswordCard />
        <ChangeEmailCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("/users/me/password", {
        method: "PATCH",
        body: {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        },
      }),
    onSuccess: () => {
      toast.success("Password updated");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (e) => toastApiError(e),
  });

  return (
    <form
      className="rounded-lg border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.newPassword !== form.confirm)
          return toast.error("New passwords don't match");
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">Change password</h2>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input
            required
            type="password"
            value={form.currentPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentPassword: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Confirm new password</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}

function ChangeEmailCard() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newEmail: "" });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("/users/me/email", {
        method: "PATCH",
        body: {
          currentPassword: form.currentPassword,
          newEmail: form.newEmail,
        },
      }),
    onSuccess: () => {
      toast.success("Email updated. Please sign in again.");
      clearToken();
      navigate({ to: "/login", replace: true });
    },
    onError: (e) => toastApiError(e),
  });

  return (
    <form
      className="rounded-lg border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">Change email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You'll be signed out and asked to sign in with your new email.
      </p>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input
            required
            type="password"
            value={form.currentPassword}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentPassword: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>New email</Label>
          <Input
            required
            type="email"
            value={form.newEmail}
            onChange={(e) => setForm((f) => ({ ...f, newEmail: e.target.value }))}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Update email"}
        </Button>
      </div>
    </form>
  );
}
