import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  UserPlus,
  Sparkles,
  Loader2,
  Users,
  UserCheck,
  UserPlus2,
  Target,
  AlertTriangle,
  FileText,
  PieChart as PieChartIcon,
  Phone,
  Mail,
  UsersRound,
  MapPin,
  Presentation,
  Award,
  RotateCw,
  StickyNote,
  ClipboardList,
  Activity,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { NewQuoteDialog } from "@/components/new-quote-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/customers.functions";
import { listRecentActivity, type RecentActivityRow } from "@/lib/customer-activities.functions";
import { customerInitials, customerPalette } from "@/lib/customers-demo";
import { TONE_BADGE, TONE_OUTLINE_BUTTON, type Tone } from "@/lib/theme";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  frozen: "בהקפאה",
  lead: "פוטנציאלי",
};
const STATUS_DOT: Record<string, string> = {
  active: "bg-success",
  inactive: "bg-muted-foreground",
  frozen: "bg-warning",
  lead: "bg-accent",
};

const DONUT_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

const ACTIVITY_META: Record<string, { label: string; icon: typeof Phone; tone: Tone }> = {
  call: { label: "שיחת טלפון", icon: Phone, tone: "accent" },
  email: { label: "אימייל", icon: Mail, tone: "primary" },
  meeting: { label: "פגישה", icon: UsersRound, tone: "success" },
  visit: { label: "ביקור", icon: MapPin, tone: "warning" },
  quote: { label: "הצעת מחיר", icon: FileText, tone: "primary" },
  demo: { label: "הדגמה", icon: Presentation, tone: "accent" },
  tender: { label: "מכרז", icon: Award, tone: "warning" },
  follow_up: { label: "מעקב", icon: RotateCw, tone: "muted" },
  note: { label: "הערה", icon: StickyNote, tone: "muted" },
  task: { label: "משימה", icon: ClipboardList, tone: "accent" },
};

function activityMeta(type: string) {
  return ACTIVITY_META[type] ?? { label: type, icon: Activity, tone: "muted" as Tone };
}

function relativeTimeHe(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}

export const Route = createFileRoute("/dashboard/customers/")({
  head: () => ({
    meta: [
      { title: "לקוחות שלנו — AFIK Logistics Platform" },
      { name: "description", content: "ריכוז כל הלקוחות במקום אחד." },
      { property: "og:title", content: "לקוחות שלנו" },
      { property: "og:description", content: "ריכוז כל הלקוחות במקום אחד." },
    ],
  }),
  component: CustomersPage,
});

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  sublabel?: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE_BADGE[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
          {sublabel ? <div className="truncate text-[11px] text-muted-foreground/80">{sublabel}</div> : null}
        </div>
      </div>
    </div>
  );
}

function CustomersPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"customers" | "leads">("customers");
  const [quoteOpen, setQuoteOpen] = useState(false);

  const listCustomersFn = useServerFn(listCustomers);
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn(),
  });

  const listActivityFn = useServerFn(listRecentActivity);
  const { data: activities = [] } = useQuery({
    queryKey: ["customer-activities-recent"],
    queryFn: () => listActivityFn(),
  });

  const nonLeadCustomers = useMemo(() => customers.filter((c) => c.status !== "lead"), [customers]);
  const leadCustomers = useMemo(() => customers.filter((c) => c.status === "lead"), [customers]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const total = nonLeadCustomers.length;
    const active = nonLeadCustomers.filter((c) => c.status === "active").length;
    const newThisMonth = nonLeadCustomers.filter((c) => new Date(c.created_at).getTime() >= startOfMonth).length;
    const potential = leadCustomers.length;
    const frozen = nonLeadCustomers.filter((c) => c.status === "frozen").length;
    return { total, active, newThisMonth, potential, frozen };
  }, [nonLeadCustomers, leadCustomers]);

  const industryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of nonLeadCustomers) {
      const key = (c.industry ?? "").trim() || "לא צוין";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = nonLeadCustomers.length || 1;
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const restCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    const rows = top.map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
    if (restCount > 0) rows.push({ name: "אחר", count: restCount, pct: Math.round((restCount / total) * 100) });
    return rows;
  }, [nonLeadCustomers]);

  const recentNewCustomers = useMemo(
    () =>
      [...nonLeadCustomers]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [nonLeadCustomers],
  );

  const recentLeads = useMemo(
    () =>
      [...leadCustomers]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [leadCustomers],
  );

  const taskStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    let overdue = 0;
    let dueToday = 0;
    let dueThisWeek = 0;
    let total = 0;
    for (const a of activities) {
      if (!a.next_task || a.task_done_at) continue;
      total++;
      if (!a.due_at) continue;
      const t = new Date(a.due_at).getTime();
      if (t < todayStart.getTime()) overdue++;
      else if (t <= todayEnd.getTime()) dueToday++;
      else if (t <= weekEnd.getTime()) dueThisWeek++;
    }
    return { overdue, dueToday, dueThisWeek, total };
  }, [activities]);

  const recentFeed = useMemo<RecentActivityRow[]>(() => activities.slice(0, 8), [activities]);

  const counts = useMemo(() => {
    let leads = 0;
    let regular = 0;
    for (const c of customers) {
      if (c.status === "lead") leads++;
      else regular++;
    }
    return { leads, regular };
  }, [customers]);

  const filtered = useMemo(() => {
    const byTab = customers.filter((c) => (tab === "leads" ? c.status === "lead" : c.status !== "lead"));
    const term = q.trim();
    if (!term) return byTab;
    return byTab.filter(
      (c) =>
        c.company_name.includes(term) ||
        (c.trade_name ?? "").includes(term) ||
        c.customer_code.toLowerCase().includes(term.toLowerCase()),
    );
  }, [q, customers, tab]);

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="לקוחות שלנו"
        description="ריכוז כל הלקוחות במקום אחד"
        action={
          <div className="flex items-center gap-2">
            <NewCustomerDialog
              onCreated={() => refetch()}
              trigger={
                <Button className="gap-2 bg-gradient-to-l from-primary to-primary/80">
                  <UserPlus className="h-4 w-4" />
                  לקוח חדש
                </Button>
              }
            />
            <Button variant="outline" className="gap-2" onClick={() => setQuoteOpen(true)}>
              <FileText className="h-4 w-4" />
              הצעת מחיר
            </Button>
            <Button asChild variant="outline" className={cn("gap-2", TONE_OUTLINE_BUTTON.accent)}>
              <Link to="/dashboard/leads/new">
                <Sparkles className="h-4 w-4" />
                Lead חדש
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} label="סה״כ לקוחות" value={isLoading ? "—" : stats.total} tone="primary" />
        <StatCard
          icon={UserCheck}
          label="לקוחות פעילים"
          value={isLoading ? "—" : stats.active}
          sublabel={!isLoading && stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% מהלקוחות` : undefined}
          tone="success"
        />
        <StatCard
          icon={UserPlus2}
          label="לקוחות חדשים"
          value={isLoading ? "—" : stats.newThisMonth}
          sublabel="החודש"
          tone="accent"
        />
        <StatCard icon={Target} label="לקוחות פוטנציאליים" value={isLoading ? "—" : stats.potential} tone="muted" />
        <StatCard
          icon={AlertTriangle}
          label="לקוחות בהקפאה"
          value={isLoading ? "—" : stats.frozen}
          sublabel="דורשים מעקב"
          tone="destructive"
        />
      </div>

      {/* Industry breakdown, new customers, leads */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" /> פילוח לקוחות לפי תחום
          </div>
          {industryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">אין נתונים עדיין</div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                {industryBreakdown.map((row, i) => (
                  <div key={row.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.name}</span>
                    <span className="font-semibold">{row.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="h-32 w-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={industryBreakdown}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {industryBreakdown.map((row, i) => (
                        <Cell key={row.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">לקוחות חדשים (5 האחרונים)</div>
            <button type="button" onClick={() => setTab("customers")} className="text-xs font-medium text-primary hover:underline">
              הצג הכל
            </button>
          </div>
          {recentNewCustomers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">אין לקוחות חדשים עדיין</div>
          ) : (
            <div className="space-y-1">
              {recentNewCustomers.map((c) => {
                const p = customerPalette(c.company_name);
                return (
                  <Link
                    key={c.id}
                    to="/dashboard/customers/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", p.bg, p.text)}>
                      {customerInitials(c.company_name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.company_name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("he-IL")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">לקוחות פוטנציאליים (5 האחרונים)</div>
            <button type="button" onClick={() => setTab("leads")} className="text-xs font-medium text-primary hover:underline">
              הצג הכל
            </button>
          </div>
          {recentLeads.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">אין לידים חדשים עדיין</div>
          ) : (
            <div className="space-y-1">
              {recentLeads.map((c) => {
                const p = customerPalette(c.company_name);
                return (
                  <Link
                    key={c.id}
                    to="/dashboard/customers/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", p.bg, p.text)}>
                      {customerInitials(c.company_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{c.company_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{c.industry ?? "—"}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("he-IL")}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Open tasks + recent activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">משימות פתוחות</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.destructive)}>
              <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
              <div className="text-xl font-bold">{taskStats.overdue}</div>
              <div className="text-[11px]">באיחור</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.warning)}>
              <ClipboardList className="mx-auto mb-1 h-4 w-4" />
              <div className="text-xl font-bold">{taskStats.dueToday}</div>
              <div className="text-[11px]">להיום</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.accent)}>
              <ClipboardList className="mx-auto mb-1 h-4 w-4" />
              <div className="text-xl font-bold">{taskStats.dueThisWeek}</div>
              <div className="text-[11px]">לשבוע זה</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.muted)}>
              <ClipboardList className="mx-auto mb-1 h-4 w-4" />
              <div className="text-xl font-bold">{taskStats.total}</div>
              <div className="text-[11px]">סה״כ פתוחות</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">פעילות אחרונה</div>
          </div>
          {recentFeed.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">אין פעילות עדיין</div>
          ) : (
            <div className="space-y-2">
              {recentFeed.map((a) => {
                const meta = activityMeta(a.activity_type);
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-center gap-2.5">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_BADGE[meta.tone])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span className="text-xs text-muted-foreground"> · {a.company_name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTimeHe(a.occurred_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full list */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/overview"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
            aria-label="חזרה"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {tab === "leads" ? "כל הלקוחות הפוטנציאליים" : "כל תיקי הלקוחות"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "טוען..." : `${filtered.length} ${tab === "leads" ? "לידים" : "לקוחות"} במערכת`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-card p-1">
            <button
              type="button"
              onClick={() => setTab("customers")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === "customers"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              לקוחות ({counts.regular})
            </button>
            <button
              type="button"
              onClick={() => setTab("leads")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === "leads"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              פוטנציאליים ({counts.leads})
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש לקוח..."
              className="w-64 pr-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center rounded-2xl border bg-card p-12 text-sm text-muted-foreground">
            <Loader2 className="ml-2 h-4 w-4 animate-spin" /> טוען לקוחות...
          </div>
        )}

        {!isLoading && filtered.map((c) => {
          const p = customerPalette(c.company_name);
          return (
            <div
              key={c.id}
              className="grid grid-cols-1 items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-sm transition hover:shadow-md md:grid-cols-[auto_2fr_1fr_1fr_1fr_auto]"
            >
              <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl text-base font-bold ${p.bg} ${p.text}`}>
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.company_name} className="h-full w-full object-cover" />
                ) : (
                  customerInitials(c.company_name)
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">{c.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.trade_name ? `${c.trade_name} · ` : ""}
                  <span className="font-mono">{c.customer_code}</span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{c.industry ?? "—"}</span>
                <span className="text-xs text-muted-foreground">תחום פעילות</span>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{c.company_type ?? "—"}</span>
                <span className="text-xs text-muted-foreground">סוג חברה</span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[c.status] ?? "bg-muted-foreground"}`} />
                  <span className="text-sm font-medium">{STATUS_LABEL[c.status] ?? c.status}</span>
                </div>
                {c.website && (
                  <a href={c.website} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline" dir="ltr">
                    {c.website}
                  </a>
                )}
              </div>

              <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/dashboard/customers/$id" params={{ id: c.id }}>
                  פתח תיק לקוח
                </Link>
              </Button>
            </div>
          );
        })}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground">
            {q ? "לא נמצאו לקוחות התואמים לחיפוש" : "אין לקוחות עדיין — לחצו על 'לקוח חדש' כדי להתחיל"}
          </div>
        )}
      </div>

      <NewQuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} onSaved={() => refetch()} />
    </div>
  );
}
