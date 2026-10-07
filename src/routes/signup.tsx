import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { completeSignup } from "@/lib/auth.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "הצטרפות עם קוד — AFIK Logistics Platform" },
      {
        name: "description",
        content: "הצטרפות לארגון קיים באמצעות קוד שקיבלתם מהמנהל שלכם.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeSignup);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    organizationCode: "",
    fullName: "",
    email: "",
    password: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard/shipments`,
          data: { full_name: form.fullName },
        },
      });
      if (signUpErr) throw signUpErr;

      // If email confirmation is required, there won't be a session yet.
      if (!authData.session) {
        toast.success("החשבון נוצר. בדקו את תיבת המייל לאישור ואז התחברו.");
        navigate({ to: "/login" });
        return;
      }

      await complete({
        data: {
          organizationCode: form.organizationCode.trim().toUpperCase(),
          fullName: form.fullName.trim(),
        },
      });

      toast.success("הצטרפת לארגון בהצלחה!");
      navigate({ to: "/dashboard/shipments" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההרשמה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="הצטרפות לארגון"
      subtitle="הזינו את הקוד שקיבלתם מהמנהל שלכם בחברה."
      footer={
        <>
          כבר יש לכם חשבון?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            כניסה
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="קוד ארגון" hint="הקוד שקיבלתם מהמנהל שלכם." required>
          <Input
            required
            value={form.organizationCode}
            onChange={(e) => set("organizationCode", e.target.value.toUpperCase())}
            placeholder="ACME"
            className="uppercase tracking-wider"
            minLength={3}
            maxLength={16}
          />
        </Field>
        <Field label="שם מלא" required>
          <Input
            required
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="ישראל ישראלי"
          />
        </Field>
        <Field label="אימייל" required>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </Field>
        <Field label="סיסמה" required>
          <Input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "מצטרף…" : "הצטרפות"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
