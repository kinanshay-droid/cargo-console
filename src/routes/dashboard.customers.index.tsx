import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Search, UserPlus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewCustomerDialog } from "@/components/new-customer-dialog";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/customers.functions";
import { customerInitials, customerPalette } from "@/lib/customers-demo";
import { TONE_OUTLINE_BUTTON } from "@/lib/theme";
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

export const Route = createFileRoute("/dashboard/customers/")({
  head: () => ({
    meta: [
      { title: "ניהול תיקי לקוחות — AFIK Logistics Platform" },
      { name: "description", content: "רשימת כל תיקי הלקוחות של הארגון." },
      { property: "og:title", content: "ניהול תיקי לקוחות" },
      { property: "og:description", content: "רשימת כל תיקי הלקוחות של הארגון." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"customers" | "leads">("customers");
  const listCustomersFn = useServerFn(listCustomers);
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn(),
  });

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
    const byTab = customers.filter((c) =>
      tab === "leads" ? c.status === "lead" : c.status !== "lead",
    );
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
            <h1 className="text-2xl font-bold tracking-tight">
              {tab === "leads" ? "ניהול לקוחות פוטנציאליים" : "ניהול תיקי לקוחות"}
            </h1>
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
          <NewCustomerDialog
            onCreated={() => refetch()}
            trigger={
              <Button className="gap-2 bg-gradient-to-l from-primary to-primary/80">
                <UserPlus className="h-4 w-4" />
                לקוח חדש
              </Button>
            }
          />
          <Button asChild variant="outline" className={cn("gap-2", TONE_OUTLINE_BUTTON.accent)}>
            <Link to="/dashboard/leads/new">
              <Sparkles className="h-4 w-4" />
              לקוח פוטנציאלי
            </Link>
          </Button>
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
    </div>
  );
}
