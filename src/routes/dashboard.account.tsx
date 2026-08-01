import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/account")({
  head: () => ({
    meta: [
      { title: "החשבון שלי — AFIK Logistics Platform" },
      { name: "description", content: "עדכון סיסמה וכתובת מייל." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl" dir="rtl">
      <PageHeader title="החשבון שלי" description="ניהול פרטי ההתחברות שלך." />
      <div className="space-y-6">
        <ChangePasswordCard />
        <ChangeEmailCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const { user } = useCurrentUser();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("לא ניתן לזהות את המשתמש המחובר");
      // Verify the current password by re-authenticating with it before
      // accepting a new one — supabase.auth.updateUser() alone doesn't ask
      // for the current password, so this is the only real check we have.
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: form.currentPassword,
      });
      if (verifyErr) throw new Error("הסיסמה הנוכחית שגויה");
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("הסיסמה עודכנה");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון הסיסמה נכשל"),
  });

  return (
    <form
      className="rounded-lg border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.newPassword !== form.confirm) return toast.error("הסיסמאות החדשות אינן תואמות");
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">שינוי סיסמה</h2>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>סיסמה נוכחית</Label>
          <Input
            required
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>סיסמה חדשה</Label>
          <Input
            required
            type="password"
            minLength={8}
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>אימות סיסמה חדשה</Label>
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
          {mutation.isPending ? "שומר…" : "עדכן סיסמה"}
        </Button>
      </div>
    </form>
  );
}

function ChangeEmailCard() {
  const { user } = useCurrentUser();
  const [form, setForm] = useState({ currentPassword: "", newEmail: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("לא ניתן לזהות את המשתמש המחובר");
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: form.currentPassword,
      });
      if (verifyErr) throw new Error("הסיסמה הנוכחית שגויה");
      const { error } = await supabase.auth.updateUser({ email: form.newEmail.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("נשלח אישור לכתובת המייל החדשה — יש לאשר כדי להשלים את השינוי");
      setForm({ currentPassword: "", newEmail: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון המייל נכשל"),
  });

  return (
    <form
      className="rounded-lg border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold">שינוי כתובת מייל</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        יישלח מייל אישור לכתובת החדשה. השינוי ייכנס לתוקף רק לאחר האישור.
      </p>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>סיסמה נוכחית</Label>
          <Input
            required
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>כתובת מייל חדשה</Label>
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
          {mutation.isPending ? "שומר…" : "עדכן מייל"}
        </Button>
      </div>
    </form>
  );
}
