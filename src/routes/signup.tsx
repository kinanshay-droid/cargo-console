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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — AFIK Logistics Platform" },
      {
        name: "description",
        content: "Create a new organization or join an existing one with a code.",
      },
      { property: "og:title", content: "Sign up — AFIK Logistics Platform" },
      {
        property: "og:description",
        content: "Create a new organization or join an existing one with a code.",
      },
    ],
  }),
  component: SignupPage,
});

type Mode = "create" | "join";

function SignupPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeSignup);
  const [mode, setMode] = useState<Mode>("create");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
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
        toast.success(
          "Account created. Please check your email to confirm, then sign in.",
        );
        navigate({ to: "/login" });
        return;
      }

      // Session available → complete org setup.
      const payload =
        mode === "create"
          ? {
              mode: "create" as const,
              organizationName: form.organizationName.trim(),
              organizationCode: form.organizationCode.trim().toUpperCase(),
              fullName: form.fullName.trim(),
            }
          : {
              mode: "join" as const,
              organizationCode: form.organizationCode.trim().toUpperCase(),
              fullName: form.fullName.trim(),
            };
      await complete({ data: payload });

      toast.success(
        mode === "create" ? "Organization created — welcome!" : "Joined organization — welcome!",
      );
      navigate({ to: "/dashboard/shipments" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete signup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={mode === "create" ? "Create your organization" : "Join an organization"}
      subtitle={
        mode === "create"
          ? "You'll become the first admin with full permissions."
          : "Enter the code your admin shared with you."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-5 flex rounded-md border bg-muted p-1 text-sm">
        <ModeTab active={mode === "create"} onClick={() => setMode("create")}>
          Create new
        </ModeTab>
        <ModeTab active={mode === "join"} onClick={() => setMode("join")}>
          Join existing
        </ModeTab>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "create" && (
          <Field label="Organization name" required>
            <Input
              required
              value={form.organizationName}
              onChange={(e) => set("organizationName", e.target.value)}
              placeholder="Acme Logistics"
            />
          </Field>
        )}
        <Field
          label="Organization code"
          hint={
            mode === "create"
              ? "Short, uppercase handle for your team (e.g. ACME)."
              : "The code your admin gave you."
          }
          required
        >
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
        <Field label="Full name" required>
          <Input
            required
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Email" required>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required>
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
          {loading
            ? "Creating…"
            : mode === "create"
              ? "Create organization"
              : "Join organization"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-3 py-1.5 font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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
