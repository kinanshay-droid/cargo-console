import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Headphones,
  Users,
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
  Bell,
  Globe2,
  Package,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const STATS: { label: string; value: string; icon: typeof Globe2 }[] = [
  { label: "משלוחים בשנה", value: "10,000+", icon: Package },
  { label: "מדינות יעד", value: "50+", icon: Globe2 },
  { label: "לקוחות פעילים", value: "300+", icon: Building2 },
  { label: "זמינות תמיכה", value: "24/7", icon: Headphones },
];

const DASHBOARD_KPIS = [
  { label: "משלוחים פעילים", value: "128" },
  { label: "הצעות פתוחות", value: "34" },
  { label: "תיקים דחופים", value: "6" },
  { label: "לקוחות פעילים", value: "342" },
];

const DASHBOARD_ROWS: { name: string; code: string; tone: "success" | "warning" | "accent" }[] = [
  { name: "גל גבוה", code: "Q-2607-9592", tone: "success" },
  { name: "רוני לוי", code: "Q-2607-9588", tone: "accent" },
  { name: "עדן כהן", code: "Q-2607-9571", tone: "success" },
  { name: "מיכל אזולאי", code: "Q-2607-9560", tone: "warning" },
  { name: "דוד פרץ", code: "Q-2607-9554", tone: "success" },
];

const DASHBOARD_ROW_TONE: Record<"success" | "warning" | "accent", string> = {
  success: "bg-success",
  warning: "bg-warning",
  accent: "bg-accent",
};

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

      <div className="relative z-10 mx-auto w-full max-w-[1400px]">
        <div className="mb-8 flex justify-center">
          <Link
            to="/presentation"
            target="_blank"
            title="פתח את מצגת המערכת"
            className="max-w-xs transition-opacity hover:opacity-90"
          >
            <img
              src="/afik-logo-white.png"
              alt="AFIK Logistics Platform — The Intelligence Behind Every Shipment."
              className="h-auto w-full"
            />
          </Link>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_400px_minmax(0,1fr)]">
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
            <p className="mt-1 text-center text-sm text-muted-foreground">הזן אימייל וסיסמה</p>

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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "מתחבר…" : "כניסה"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              חדש כאן?{" "}
              <Link to="/signup" className="font-medium text-accent hover:underline">
                הרשמה
              </Link>
            </p>
          </div>

          {/* Live product glimpse: a real, detailed peek at the operations dashboard —
              shows the software instead of hinting at it. */}
          <div
            dir="rtl"
            className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] shadow-2xl backdrop-blur-md lg:block"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              </div>
              <div className="text-xs font-semibold text-white/70">AFIK · דשבורד תפעולי</div>
              <div className="relative text-white/60">
                <Bell className="h-4 w-4" />
                <span className="absolute -left-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                  3
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DASHBOARD_KPIS.map((m) => (
                  <div key={m.label} className="rounded-lg bg-white/10 p-3">
                    <div className="text-xl font-bold text-white">{m.value}</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-white/50">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                <div className="flex h-28 items-end gap-1.5 rounded-lg bg-white/5 p-3">
                  {[40, 65, 50, 80, 55, 90, 70, 60, 85, 45, 75, 95, 65, 55].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-accent/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="mb-1.5 text-[10px] text-white/50">מסלול פעיל</div>
                  <svg viewBox="0 0 160 64" className="h-16 w-full">
                    <path
                      d="M 10 50 Q 80 5 150 20"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1.5"
                      strokeDasharray="1 6"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="50" r="3" fill="var(--accent)" />
                    <circle cx="150" cy="20" r="3" fill="var(--accent)" />
                    <text
                      x="10"
                      y="62"
                      fontSize="9"
                      fill="white"
                      fillOpacity="0.5"
                      fontFamily="monospace"
                    >
                      TLV
                    </text>
                    <text
                      x="132"
                      y="14"
                      fontSize="9"
                      fill="white"
                      fillOpacity="0.5"
                      fontFamily="monospace"
                    >
                      JFK
                    </text>
                  </svg>
                </div>
              </div>

              <div className="space-y-1.5">
                {DASHBOARD_ROWS.map((row) => (
                  <div
                    key={row.code}
                    className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-[11px] text-white/70"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${DASHBOARD_ROW_TONE[row.tone]}`}
                      />
                      {row.name}
                    </span>
                    <span className="font-mono text-white/40">{row.code}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="truncate text-[10px] text-white/50">{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_BADGES.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 text-white/80">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
