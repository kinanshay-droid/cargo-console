import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { Users, UserPlus, Settings2, FileText, Sparkles } from "lucide-react";
import { listCustomers } from "@/lib/customers.functions";
import { listMyQuotes } from "@/lib/quotes.functions";
import { useI18n } from "@/lib/i18n";

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

type StatusKey = "active" | "inactive" | "frozen";

const STATUS_COLOR: Record<StatusKey, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  frozen: "bg-sky-500",
};

function CustomersDashboard() {
  const { t, locale, dir } = useI18n();
  const listCustomersFn = useServerFn(listCustomers);
  const listQuotesFn = useServerFn(listMyQuotes);

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn(),
  });
  const { data: quotes = [] } = useQuery({
    queryKey: ["my-quotes"],
    queryFn: () => listQuotesFn(),
  });

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === "active").length;
    const inactive = customers.filter((c) => c.status === "inactive").length;
    const frozen = customers.filter((c) => c.status === "frozen").length;
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const newThisMonth = customers.filter(
      (c) => new Date(c.created_at).getTime() >= monthAgo,
    ).length;
    return { total, active, inactive, frozen, newThisMonth };
  }, [customers]);

  const recentCustomers = useMemo(
    () =>
      [...customers]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 5),
    [customers],
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

  const statusSegments = useMemo(() => {
    const total = stats.total || 1;
    const segs: { key: StatusKey; value: number; pct: number; color: string }[] = [
      { key: "active", value: stats.active, pct: (stats.active / total) * 100, color: "#10b981" },
      { key: "inactive", value: stats.inactive, pct: (stats.inactive / total) * 100, color: "#94a3b8" },
      { key: "frozen", value: stats.frozen, pct: (stats.frozen / total) * 100, color: "#38bdf8" },
    ];
    return segs.filter((s) => s.value > 0);
  }, [stats]);

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
          <Button asChild variant="outline" className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50">
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          title={t("overview.statTotalCustomers")}
          value={stats.total}
          gradient="bg-gradient-to-l from-fuchsia-500 to-pink-500"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statActiveCustomers")}
          value={stats.active}
          gradient="bg-gradient-to-l from-emerald-500 to-teal-500"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statNew30Days")}
          value={stats.newThisMonth}
          gradient="bg-gradient-to-l from-sky-500 to-cyan-500"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <MetricTile
          title={t("overview.statTotalQuotes")}
          value={quotes.length}
          gradient="bg-gradient-to-l from-violet-500 to-purple-600"
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
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

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/dashboard/leads/new" className="text-xs text-sky-600 hover:underline">
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
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    {c.company_name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>


        <Card className="p-5">
          <h3 className="mb-4 text-right font-semibold">{t("overview.statusBreakdown")}</h3>
          {stats.total === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("overview.noDataYet")}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-6">
              <DonutChart segments={statusSegments} />
              <div className="flex-1 space-y-2">
                {statusSegments.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {s.value} ({Math.round(s.pct)}%)
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{t(`status.${s.key}` as const)}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[s.key]}`} />
                    </div>
                  </div>
                ))}
              </div>
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
  gradient,
  icon,
}: {
  title: string;
  value: number;
  gradient: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className={`flex items-center justify-between px-5 py-4 text-white ${gradient}`}>
        <div className="text-right">
          <div className="text-sm font-medium opacity-95">{title}</div>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
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
