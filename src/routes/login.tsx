import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Headphones, User, TrendingUp, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/demo.functions";
import { toast } from "sonner";

type DemoRole = "service" | "customer" | "commercial" | "admin";

const DEMO_ROLES: {
  id: DemoRole;
  title: string;
  description: string;
  icon: typeof Headphones;
  route:
    | "/dashboard/operations"
    | "/dashboard/overview"
    | "/dashboard/commercial"
    | "/dashboard/users";
}[] = [
  {
    id: "service",
    title: "תפעול",
    description: "התראות תפעול — משימות, תיקים דחופים ופעולות מהירות.",
    icon: Headphones,
    route: "/dashboard/operations",
  },
  {
    id: "customer",
    title: "לקוח",
    description: "מסך הלקוחות שלנו — ניהול תיקים ומדדים מסחריים.",
    icon: User,
    route: "/dashboard/overview",
  },
  {
    id: "commercial",
    title: "מסחרי",
    description: "הצעות מחיר, Pipeline ומעקב אחרי הפעילות המסחרית.",
    icon: TrendingUp,
    route: "/dashboard/commercial",
  },
  {
    id: "admin",
    title: "אדמין",
    description: "ניהול משתמשים, הרשאות והגדרות הארגון.",
    icon: ShieldCheck,
    route: "/dashboard/users",
  },
];


export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — AFIK Logistics Platform" },
      { name: "description", content: "Sign in to your organization's console." },
      { property: "og:title", content: "Sign in — AFIK Logistics Platform" },
      {
        property: "og:description",
        content: "Sign in to your organization's console.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<DemoRole | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw error;
      navigate({ to: "/dashboard/shipments" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign you in");
    } finally {
      setLoading(false);
    }
  }

  async function onDemoRoleSelect(role: (typeof DEMO_ROLES)[number]) {
    setDemoLoading(role.id);
    try {
      // const creds = await ensureDemoUser();

const creds = {
  email: "demo@demo.local",
  password: "demo-user-1234",
};
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) throw error;
      try {
        localStorage.setItem("demo_role", role.id);
      } catch {
        /* ignore storage errors */
      }
      toast.success(`ברוך הבא לדמו — ${role.title}`);
      setRoleDialogOpen(false);
      navigate({ to: role.route });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "כניסה לדמו נכשלה");
    } finally {
      setDemoLoading(null);
    }
  }


  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your email and password."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label>Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            required
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || demoLoading !== null}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">או</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setRoleDialogOpen(true)}
          disabled={loading || demoLoading !== null}
        >
          כניסה לדמו
        </Button>
      </form>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => {
        if (demoLoading !== null) return;
        setRoleDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>בחר תפקיד לדמו</DialogTitle>
            <DialogDescription>
              כל תפקיד נכנס לחוויה שונה במערכת. אפשר להחליף בכל עת.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {DEMO_ROLES.map((role) => {
              const Icon = role.icon;
              const isBusy = demoLoading === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onDemoRoleSelect(role)}
                  disabled={demoLoading !== null}
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-right transition hover:border-accent hover:bg-accent/5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{role.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {isBusy ? "טוען…" : role.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}

