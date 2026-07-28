import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Headphones,
  User,
  Users,
  TrendingUp,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Radar,
  MapPin,
  FileCheck2,
  Sparkles,
  ArrowLeftRight,
  ScrollText,
  Thermometer,
  Cloud,
  BarChart3,
  BadgeCheck,
  PlaneTakeoff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoUser } from "@/lib/demo.functions";
import { toast } from "sonner";

const FEATURES: { label: string; icon: typeof Eye }[] = [
  { label: "ניהול לידים ולקוחות", icon: Users },
  { label: "הצעות מחיר עם מנוע תמחור חכם", icon: Sparkles },
  { label: "מעקב משלוחים בזמן אמת על המפה", icon: MapPin },
  { label: "תפעול לפי נציג ועדיפות", icon: Radar },
  { label: "איסוף והפצה", icon: ArrowLeftRight },
  { label: "מחירונים וחוקי תמחור ללקוח", icon: ScrollText },
  { label: "מטענים רגישי טמפרטורה (שרשרת קור)", icon: Thermometer },
  { label: "ייצוא הצעת מחיר ל-PDF", icon: FileCheck2 },
];

const TRUST_BADGES: { label: string; icon: typeof ShieldCheck }[] = [
  { label: "מאובטח ותואם רגולציה", icon: ShieldCheck },
  { label: "מבוסס ענן", icon: Cloud },
  { label: "החלטות מונחות נתונים", icon: BarChart3 },
  { label: "אמין וניתן להרחבה", icon: BadgeCheck },
];

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-primary px-4 py-10 lg:p-10">
      {/* Decorative background: navy gradient + dotted-globe motif, on-brand with the AFIK mark */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 650px at 15% 0%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 60%)," +
            "radial-gradient(900px 600px at 100% 100%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 55%)," +
            "var(--primary)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--accent) 80%, white) 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Air-freight motif: a great-circle flight route with airport nodes and a plane in transit */}
      <svg
        viewBox="0 0 1200 500"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-40 lg:block"
      >
        <path
          d="M 90 380 Q 480 60 1110 130"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
        <g>
          <circle cx="90" cy="380" r="4" fill="var(--accent)" />
          <text x="90" y="402" textAnchor="middle" fontSize="12" fill="white" fillOpacity="0.6" fontFamily="monospace">TLV</text>
        </g>
        <g>
          <circle cx="620" cy="150" r="4" fill="var(--accent)" />
          <text x="620" y="172" textAnchor="middle" fontSize="12" fill="white" fillOpacity="0.6" fontFamily="monospace">FRA</text>
        </g>
        <g>
          <circle cx="1110" cy="130" r="4" fill="var(--accent)" />
          <text x="1110" y="112" textAnchor="middle" fontSize="12" fill="white" fillOpacity="0.6" fontFamily="monospace">JFK</text>
        </g>
        <g transform="translate(420, 100) rotate(140) scale(0.9) translate(-12, -12)">
          <path
            d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Floating status card: ties the route above to a live product moment */}
      <div className="pointer-events-none absolute left-[6%] top-[18%] hidden w-56 rounded-xl border border-white/15 bg-white/10 p-3 shadow-lg backdrop-blur-md lg:block">
        <div className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/25 text-accent">
            <PlaneTakeoff className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">TLV → JFK</div>
            <div className="text-[10px] text-white/60">Q-2607-9592 · באוויר</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-2/3 rounded-full bg-accent" />
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-10 flex justify-center">
          <img
            src="/afik-logo-white.png"
            alt="AFIK Logistics Platform — The Intelligence Behind Every Shipment."
            className="h-auto w-full max-w-xs"
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          <div className="hidden rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm lg:block">
            {FEATURES.map(({ label, icon: Icon }, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 py-3 ${i < FEATURES.length - 1 ? "border-b border-white/10" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-accent">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-medium text-white">{label}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
            <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">
              כניסה
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              הזן אימייל וסיסמה
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">אימייל</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    required
                    type="email"
                    placeholder="הזן את האימייל שלך"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                    className="pr-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-medium text-foreground">סיסמה</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    שכחת סיסמה?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="הזן את הסיסמה שלך"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                    className="pr-9 pl-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || demoLoading !== null}>
                {loading ? "מתחבר…" : "כניסה"}
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

            <p className="mt-6 text-center text-sm text-muted-foreground">
              חדש כאן?{" "}
              <Link to="/signup" className="font-medium text-accent hover:underline">
                הרשמה
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_BADGES.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 text-white/80">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

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
    </div>
  );
}

