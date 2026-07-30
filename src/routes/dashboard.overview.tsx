import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import {
  Users,
  UserPlus,
  Settings2,
  Sparkles,
  Target,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  FileText,
  Presentation,
  Award,
  RotateCw,
  StickyNote,
  ClipboardList,
} from "lucide-react";
import { listCustomers } from "@/lib/customers.functions";
import { listRecentActivity, type RecentActivityRow } from "@/lib/customer-activities.functions";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n-dictionary";
import { TONE_OUTLINE_BUTTON, TONE_GRADIENT, TONE_BADGE, type Tone } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/overview")({
  head: () => ({
    meta: [
      { title: "הלקוחות שלנו — Freight Console" },
      { name: "description", content: "ריכוז כל הלקוחות שלכם במקום אחד." },
      { property: "og:title", content: "הלקוחות שלנו" },
      { property: "og:description", content: "ניהול תיקי לקוחות ומדדים מסחריים." },
    ],
  }),
  component: CustomersDashboard,
});

const DONUT_PALETTE = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--muted-foreground)",
];

const ACTIVITY_ICON: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  visit: MapPin,
  quote: FileText,
  demo: Presentation,
  tender: Award,
  follow_up: RotateCw,
  note: StickyNote,
  task: ClipboardList,
};

const ACTIVITY_TONE: Record<string, Tone> = {
  call: "accent",
  email: "primary",
  meeting: "success",
  visit: "warning",
  quote: "primary",
  demo: "accent",
  tender: "warning",
  follow_up: "muted",
  note: "muted",
  task: "accent",
};

function CustomersDashboard() {
  const { t, locale, dir } = useI18n();
  const listCustomersFn = useServerFn(listCustomers);
  const listActivityFn = useServerFn(listRecentActivity);

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn(),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["customer-activities-recent"],
    queryFn: () => listActivityFn(),
  });

  const nonLeadCustomers = useMemo(() => customers.filter((c) => c.status !== "lead"), [customers]);

  const stats = useMemo(() => {
    const total = nonLeadCustomers.length;
    const active = nonLeadCustomers.filter((c) => c.status === "active").length;
    const inactive = nonLeadCustomers.filter((c) => c.status === "inactive").length;
    const frozen = nonLeadCustomers.filter((c) => c.status === "frozen").length;
    const potential = customers.filter((c) => c.status === "lead").length;
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const newThisMonth = nonLeadCustomers.filter(
      (c) => new Date(c.created_at).getTime() >= monthAgo,
    ).length;
    return { total, active, inactive, frozen, potential, newThisMonth };
  }, [nonLeadCustomers, customers]);

  const recentCustomers = useMemo(
    () =>
      [...nonLeadCustomers]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5),
    [nonLeadCustomers],
  );

  const recentLeads = useMemo(
    () =>
      [...customers]
        .filter((c) => c.status === "lead")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5),
    [customers],
  );

  const industryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of nonLeadCustomers) {
      const key = (c.industry ?? "").trim() || t("overview.unspecifiedIndustry");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = nonLeadCustomers.length || 1;
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const restCount = sorted.slice(5).reduce((s, [, c]) => s + c, 0);
    const rows = top.map(([name, count], i) => ({
      name,
      count,
      pct: (count / total) * 100,
      color: DONUT_PALETTE[i % DONUT_PALETTE.length],
    }));
    if (restCount > 0) {
      rows.push({
        name: t("overview.otherIndustry"),
        count: restCount,
        pct: (restCount / total) * 100,
        color: DONUT_PALETTE[rows.length % DONUT_PALETTE.length],
      });
    }
    return rows.filter((r) => r.count > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonLeadCustomers, locale]);

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
      const time = new Date(a.due_at).getTime();
      if (time < todayStart.getTime()) overdue++;
      else if (time <= todayEnd.getTime()) dueToday++;
      else if (time <= weekEnd.getTime()) dueThisWeek++;
    }
    return { overdue, dueToday, dueThisWeek, total };
  }, [activities]);

  const recentFeed = useMemo<RecentActivityRow[]>(() => activities.slice(0, 8), [activities]);

  function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 60) return locale === "he" ? `לפני ${minutes} דק'` : `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return locale === "he" ? `לפני ${hours} שעות` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return locale === "he" ? `לפני ${days} ימים` : `${days}d ago`;
    return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US");
  }

  return (
    <div dir={dir} className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("overview.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("overview.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewCustomerDialog
            onCreated={() => refetch()}
            trigger={
              <Button className="gap-2 bg-gradient-to-l from-primary to-primary/80 shadow-sm">
                <UserPlus className="h-4 w-4" />
                {t("overview.newCustomer")}
              </Button>
            }
          />
          <Button asChild variant="outline" className={cn("gap-2", TONE_OUTLINE_BUTTON.accent)}>
            <Link to="/dashboard/leads/new">
              <Sparkles className="h-4 w-4" />
              {t("overview.newLead")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/customers">
              <Settings2 className="h-4 w-4" />
              {t("overview.manageCustomers")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          title={t("overview.statTotalCustomers")}
          value={stats.total}
          gradient={cn("bg-gradient-to-l", TONE_GRADIENT.primary)}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statActiveCustomers")}
          value={stats.active}
          sublabel={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% ${t("overview.ofCustomers")}` : undefined}
          gradient={cn("bg-gradient-to-l", TONE_GRADIENT.success)}
          icon={<Users className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statNew30Days")}
          value={stats.newThisMonth}
          gradient={cn("bg-gradient-to-l", TONE_GRADIENT.accent)}
          icon={<UserPlus className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statPotentialCustomers")}
          value={stats.potential}
          gradient={cn("bg-gradient-to-l", TONE_GRADIENT.muted)}
          icon={<Target className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statFrozenCustomers")}
          value={stats.frozen}
          sublabel={t("overview.statFrozenSub")}
          gradient={cn("bg-gradient-to-l", TONE_GRADIENT.destructive)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Middle row: industry breakdown, leads, new customers */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-4 text-right font-semibold">{t("overview.industryBreakdown")}</h3>
          {industryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("overview.noDataYet")}</div>
          ) : (
            <div className="flex items-center justify-between gap-6">
              <DonutChart segments={industryBreakdown} />
              <div className="flex-1 space-y-2">
                {industryBreakdown.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{Math.round(s.pct)}%</span>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{s.name}</span>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/dashboard/leads/new" className="text-xs text-accent hover:underline">
              {t("common.addShort")}
            </Link>
            <h3 className="text-right font-semibold">
              {t("overview.recentLeads")}
            </h3>
          </div>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : recentLeads.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("overview.noLeadsYet")}
            </div>
          ) : (
            <div className="divide-y">
              {recentLeads.map((c) => (
                <Link
                  key={c.id}
                  to="/dashboard/customers/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-muted/30"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                  </span>
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    {c.company_name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-right font-semibold">
            {t("overview.recentCustomers")}
          </h3>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : recentCustomers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("overview.noCustomersYet")}
            </div>
          ) : (
            <div className="divide-y">
              {recentCustomers.map((c) => (
                <Link
                  key={c.id}
                  to="/dashboard/customers/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between py-2.5 text-sm hover:bg-muted/30"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                  </span>
                  <span className="font-medium">{c.company_name}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom row: open tasks + recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-right font-semibold">{t("overview.openTasks")}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.destructive)}>
              <div className="text-xl font-bold">{taskStats.overdue}</div>
              <div className="text-[11px]">{t("overview.tasksOverdue")}</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.warning)}>
              <div className="text-xl font-bold">{taskStats.dueToday}</div>
              <div className="text-[11px]">{t("overview.tasksDueToday")}</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.accent)}>
              <div className="text-xl font-bold">{taskStats.dueThisWeek}</div>
              <div className="text-[11px]">{t("overview.tasksDueThisWeek")}</div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", TONE_BADGE.muted)}>
              <div className="text-xl font-bold">{taskStats.total}</div>
              <div className="text-[11px]">{t("overview.tasksTotalOpen")}</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-right font-semibold">{t("overview.recentActivity")}</h3>
          {recentFeed.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("overview.noActivityYet")}</div>
          ) : (
            <div className="space-y-2">
              {recentFeed.map((a) => {
                const Icon = ACTIVITY_ICON[a.activity_type] ?? StickyNote;
                const tone = ACTIVITY_TONE[a.activity_type] ?? "muted";
                const label = t((`activity.${a.activity_type}` as TranslationKey));
                return (
                  <div key={a.id} className="flex items-center gap-2.5">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", TONE_BADGE[tone])}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground"> · {a.company_name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(a.occurred_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricTile({
  title,
  value,
  sublabel,
  gradient,
  icon,
}: {
  title: string;
  value: number;
  sublabel?: string;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className={`flex items-center justify-between px-5 py-4 text-white ${gradient}`}>
        <div className="text-right">
          <div className="text-sm font-medium opacity-95">{title}</div>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {sublabel ? <div className="text-xs opacity-90">{sublabel}</div> : null}
        </div>
        {icon}
      </div>
    </Card>
  );
}

function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  const size = 140;
  const radius = 55;
  const stroke = 22;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={stroke}
      />
      {segments.map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}
