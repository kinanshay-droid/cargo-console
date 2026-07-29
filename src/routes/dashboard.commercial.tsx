import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { NewQuoteDialog } from "@/components/new-quote-dialog";
import { listMyQuotes } from "@/lib/quotes.functions";
import { listCases, getCaseDisplayCode } from "@/lib/operations.functions";
import { listCustomers } from "@/lib/customers.functions";
import { TONE_BADGE, TONE_GRADIENT, TONE_OUTLINE_BUTTON } from "@/lib/theme";

type SortKey = "newest" | "oldest" | "total_desc" | "total_asc" | "depart_asc" | "depart_desc";

const SHIPMENT_MODE_LABEL: Record<string, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};

export const Route = createFileRoute("/dashboard/commercial")({
  head: () => ({
    meta: [
      { title: "דשבורד מסחרי — AFIK Logistics Platform" },
      { name: "description", content: "הצעות מחיר, Pipeline וסטטוסים מסחריים." },
      { property: "og:title", content: "דשבורד מסחרי — AFIK Logistics Platform" },
      { property: "og:description", content: "הצעות מחיר, Pipeline וסטטוסים מסחריים." },
    ],
  }),
  component: CommercialDashboard,
});

function CommercialDashboard() {
  const [query, setQuery] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const listMyQuotesFn = useServerFn(listMyQuotes);
  const { data: quotes = [], refetch } = useQuery({
    queryKey: ["my-quotes"],
    queryFn: () => listMyQuotesFn(),
  });

  const listCasesFn = useServerFn(listCases);
  const { data: cases = [] } = useQuery({
    queryKey: ["operations-cases"],
    queryFn: () => listCasesFn(),
  });

  const listCustomersFn = useServerFn(listCustomers);
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomersFn(),
  });

  const [customer, setCustomer] = useState<string>("all");
  const [incoterm, setIncoterm] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");
  const [origin, setOrigin] = useState<string>("all");
  const [dest, setDest] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("newest");

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim().length > 0))).sort((a, b) =>
      a.localeCompare(b, "he"),
    );
  const customerOptions = useMemo(() => uniq(quotes.map((q) => q.customer_name)), [quotes]);
  const incotermOptions = useMemo(() => uniq(quotes.map((q) => q.incoterm)), [quotes]);
  const originOptions = useMemo(() => uniq(quotes.map((q) => q.origin_port)), [quotes]);
  const destOptions = useMemo(() => uniq(quotes.map((q) => q.dest_port)), [quotes]);

  const resetFilters = () => {
    setQuery("");
    setCustomer("all");
    setIncoterm("all");
    setMode("all");
    setOrigin("all");
    setDest("all");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const rows = quotes.filter((it) => {
      if (q) {
        const name = (it.customer_name ?? "").toLowerCase();
        const code = (it.quote_code ?? "").toLowerCase();
        const ref = (it.customer_ref ?? "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !ref.includes(q)) return false;
      }
      if (customer !== "all" && it.customer_name !== customer) return false;
      if (incoterm !== "all" && it.incoterm !== incoterm) return false;
      if (mode !== "all" && it.shipment_mode !== mode) return false;
      if (origin !== "all" && it.origin_port !== origin) return false;
      if (dest !== "all" && it.dest_port !== dest) return false;
      if (from != null || to != null) {
        const d = it.depart_date ? new Date(it.depart_date).getTime() : null;
        if (d == null) return false;
        if (from != null && d < from) return false;
        if (to != null && d > to) return false;
      }
      return true;
    });
    const sorted = [...rows].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "total_desc":
          return (Number(b.total ?? 0)) - (Number(a.total ?? 0));
        case "total_asc":
          return (Number(a.total ?? 0)) - (Number(b.total ?? 0));
        case "depart_asc":
          return (
            (a.depart_date ? new Date(a.depart_date).getTime() : Infinity) -
            (b.depart_date ? new Date(b.depart_date).getTime() : Infinity)
          );
        case "depart_desc":
          return (
            (b.depart_date ? new Date(b.depart_date).getTime() : -Infinity) -
            (a.depart_date ? new Date(a.depart_date).getTime() : -Infinity)
          );
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [query, quotes, customer, incoterm, mode, origin, dest, dateFrom, dateTo, sort]);

  const activeFilterCount =
    (query ? 1 : 0) +
    (customer !== "all" ? 1 : 0) +
    (incoterm !== "all" ? 1 : 0) +
    (mode !== "all" ? 1 : 0) +
    (origin !== "all" ? 1 : 0) +
    (dest !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  // Last 30 days, used by the three repurposed hero cards below.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const recentCases = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return [...cases]
      .filter((c) => new Date(c.created_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [cases]);
  const recentLeads = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return [...customers]
      .filter((c) => c.status === "lead" && new Date(c.created_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [customers]);
  const recentNewCustomers = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return [...customers]
      .filter((c) => c.status !== "lead" && new Date(c.created_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [customers]);

  const goNewQuote = () => setQuoteOpen(true);

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">דשבורד מסחרי</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            הצעות מחיר
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            סקירה של הפעילות המסחרית של הארגון.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className={cn("gap-2", TONE_OUTLINE_BUTTON.accent)}>
            <Link to="/dashboard/leads">
              <Sparkles className="h-4 w-4" /> ניהול לקוחות פוטנציאליים
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/quotes">
              <FileText className="h-4 w-4" /> ניהול הצעות מחיר
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/pricelists">
              <FileText className="h-4 w-4" /> ניהול מחירונים
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("gap-2", TONE_OUTLINE_BUTTON.accent)}>
            <Link to="/dashboard/leads/new">
              <Sparkles className="h-4 w-4" /> לקוח פוטנציאלי חדש
            </Link>
          </Button>
          <Button data-testid="open-new-quote" onClick={goNewQuote} className="gap-2">
            <Plus className="h-4 w-4" /> הצעת מחיר חדשה
          </Button>
        </div>
      </div>

      {/* Hero stat cards — based on real data */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HeroCard
          label='סה"כ הצעות'
          value={quotes.length}
          gradient={TONE_GRADIENT.primary}
          items={[...quotes]
            .slice(0, 3)
            .map((q) => ({ code: q.quote_code, client: q.customer_name, date: q.created_at }))}
          footer={
            <button type="button" dir="ltr" onClick={goNewQuote} className={heroFooterCls}>
              <Plus className="h-3.5 w-3.5" /> הצעת מחיר חדשה
            </button>
          }
        />
        <HeroCard
          label="תיקים שנפתחו החודש"
          value={recentCases.length}
          gradient={TONE_GRADIENT.accent}
          items={recentCases
            .slice(0, 3)
            .map((c) => ({ code: getCaseDisplayCode(c.payload, c.case_code), client: c.customer_name, date: c.created_at }))}
          footer={
            <Link to="/dashboard/shipments" dir="ltr" className={heroFooterCls}>
              <Briefcase className="h-3.5 w-3.5" /> לצפייה במשלוחים
            </Link>
          }
        />
        <HeroCard
          label="לקוחות פוטנציאליים החודש"
          value={recentLeads.length}
          gradient={TONE_GRADIENT.warning}
          items={recentLeads
            .slice(0, 3)
            .map((c) => ({ code: c.customer_code, client: c.company_name, date: c.created_at }))}
          footer={
            <Link to="/dashboard/leads/new" dir="ltr" className={heroFooterCls}>
              <Sparkles className="h-3.5 w-3.5" /> לקוח פוטנציאלי חדש
            </Link>
          }
        />
        <HeroCard
          label="לקוחות חדשים החודש"
          value={recentNewCustomers.length}
          gradient={TONE_GRADIENT.success}
          items={recentNewCustomers
            .slice(0, 3)
            .map((c) => ({ code: c.customer_code, client: c.company_name, date: c.created_at }))}
          footer={
            <Link to="/dashboard/customers" dir="ltr" className={heroFooterCls}>
              <Users className="h-3.5 w-3.5" /> לכל הלקוחות
            </Link>
          }
        />
      </div>

      {/* Saved quotes (from backend) */}
      <div
        data-testid="saved-quotes"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 md:px-8">
          <div>
            <h2 className="text-base font-bold text-primary">הצעות שנשמרו לאחרונה</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              8 הצעות אחרונות מתוך {quotes.length}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs text-accent hover:bg-accent/10">
            <Link to="/dashboard/quotes">
              <FileText className="h-3.5 w-3.5" /> לכל ההצעות
            </Link>
          </Button>
        </div>

        {quotes.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
            אין הצעות שמורות עדיין
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2 xl:grid-cols-2">
            {quotes.slice(0, 8).map((q) => {
              const m = q.shipment_mode;
              const badgeCls =
                m === "console"
                  ? TONE_BADGE.accent
                  : m === "direct"
                    ? TONE_BADGE.muted
                    : TONE_BADGE.success;
              const route = [q.origin_port, q.dest_port].filter(Boolean).join(" → ");
              const totalNum = Number(q.total ?? 0);
              const hasTotal = q.total != null && !Number.isNaN(totalNum) && totalNum !== 0;
              const totalStr = hasTotal
                ? new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(totalNum)
                : null;
              return (
                <Link
                  key={q.id}
                  to="/dashboard/quotes/$id"
                  params={{ id: q.id }}
                  data-testid="saved-quote-row"
                  data-quote-code={q.quote_code}
                  data-shipment-mode={q.shipment_mode}
                  className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg"
                >
                  {/* Row 1: code + mode badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {q.quote_code}
                    </span>
                    <span
                      data-testid="saved-quote-mode"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        badgeCls,
                      )}
                    >
                      {SHIPMENT_MODE_LABEL[q.shipment_mode] ?? q.shipment_mode}
                    </span>
                  </div>

                  {/* Row 2: customer */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-primary">
                      {q.customer_name ?? "ללא לקוח"}
                    </span>
                    {q.incoterm && (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {q.incoterm}
                      </span>
                    )}
                  </div>

                  {/* Row 3: route + date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {route || <span className="text-muted-foreground/50">— ללא מסלול —</span>}
                    </span>
                    {q.depart_date && (
                      <span className="shrink-0 tabular-nums">
                        {new Date(q.depart_date).toLocaleDateString("he-IL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  {/* Row 4: total + margin */}
                  {(hasTotal || q.margin_pct != null) && (
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      {hasTotal ? (
                        <span className="text-sm font-bold text-primary tabular-nums">
                          {totalStr}
                          <span className="mr-1 text-[10px] font-normal text-muted-foreground">
                            {q.currency ?? "USD"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                      {q.margin_pct != null && (
                        <span className="text-[11px] font-medium text-success">
                          רווח {Number(q.margin_pct)}%
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Quotes — floating row cards */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Header + filters */}
        <div className="flex flex-col gap-4 border-b border-border bg-card/50 px-6 py-6 backdrop-blur-sm md:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-primary">הצעות מחיר</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered.length} תוצאות
                {activeFilterCount > 0 ? ` · ${activeFilterCount} פילטרים פעילים` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש לפי מס' הצעה או לקוח..."
                  className="w-full rounded-2xl border-none bg-muted py-2.5 pr-10 pl-4 text-sm text-primary placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-1.5 rounded-xl text-muted-foreground hover:text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  נקה
                </Button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground md:col-span-4 xl:col-span-1">
              <Filter className="h-3.5 w-3.5" />
              סינון ומיון
            </div>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="לקוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                {customerOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={incoterm} onValueChange={setIncoterm}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="Incoterm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל ה-Incoterms</SelectItem>
                {incotermOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="אופי משלוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל האופי</SelectItem>
                <SelectItem value="direct">משלוח ישיר</SelectItem>
                <SelectItem value="console">משלוח קונסול</SelectItem>
                <SelectItem value="transship">שטעון</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="מוצא" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המוצא</SelectItem>
                {originOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dest} onValueChange={setDest}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="יעד" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל היעדים</SelectItem>
                {destOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="מיון" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">חדשות ביותר</SelectItem>
                <SelectItem value="oldest">ישנות ביותר</SelectItem>
                <SelectItem value="total_desc">סכום — גבוה לנמוך</SelectItem>
                <SelectItem value="total_asc">סכום — נמוך לגבוה</SelectItem>
                <SelectItem value="depart_asc">יציאה מוקדמת</SelectItem>
                <SelectItem value="depart_desc">יציאה מאוחרת</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold">תאריך יציאה:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-40 rounded-xl border-border bg-card text-xs"
            />
            <span className="text-muted-foreground">עד</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-40 rounded-xl border-border bg-card text-xs"
            />
          </div>
        </div>


        {/* Cards */}
        <div className="space-y-3 p-6">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              {activeFilterCount > 0 ? "לא נמצאו תוצאות התואמות לסינון" : "אין הצעות עדיין"}
            </div>
          ) : (
            filtered.map((q) => {
              const mode = q.shipment_mode;
              const badgeCls =
                mode === "console"
                  ? TONE_BADGE.accent
                  : mode === "direct"
                    ? TONE_BADGE.muted
                    : TONE_BADGE.success;
              const route = [q.origin_port, q.dest_port].filter(Boolean).join(" → ");
              const carrier = q.airline || q.agent;
              const totalDisplay =
                q.total != null
                  ? `${Number(q.total).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ${q.currency ?? ""}`.trim()
                  : null;
              return (
                <div
                  key={q.id}
                  data-testid="saved-quote-row"
                  data-quote-code={q.quote_code}
                  data-shipment-mode={q.shipment_mode}
                  className="group rounded-2xl border border-border bg-card px-6 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Top row: code + customer + mode */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold tracking-tight text-primary">
                          {q.quote_code}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            badgeCls,
                          )}
                        >
                          {SHIPMENT_MODE_LABEL[q.shipment_mode] ?? q.shipment_mode}
                        </span>
                        {q.shipment_kind && (
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px]", TONE_BADGE.muted)}>
                            {q.shipment_kind}
                          </span>
                        )}
                        {q.incoterm && (
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE.warning)}>
                            {q.incoterm}
                          </span>
                        )}
                      </div>
                      {/* Customer */}
                      <div className="text-sm font-semibold text-primary">
                        {q.customer_name ?? "—"}
                        {q.customer_ref && (
                          <span className="mr-2 text-xs font-normal text-muted-foreground">
                            · {q.customer_ref}
                          </span>
                        )}
                      </div>
                      {/* Meta grid */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {route && (
                          <span>
                            <span className="text-muted-foreground">מסלול: </span>
                            <span className="font-medium text-foreground">{route}</span>
                          </span>
                        )}
                        {q.depart_date && (
                          <span>
                            <span className="text-muted-foreground">יציאה: </span>
                            <span className="font-medium text-foreground">
                              {new Date(q.depart_date).toLocaleDateString("he-IL")}
                            </span>
                          </span>
                        )}
                        {q.arrive_date && (
                          <span>
                            <span className="text-muted-foreground">הגעה: </span>
                            <span className="font-medium text-foreground">
                              {new Date(q.arrive_date).toLocaleDateString("he-IL")}
                            </span>
                          </span>
                        )}
                        {carrier && (
                          <span>
                            <span className="text-muted-foreground">מוביל: </span>
                            <span className="font-medium text-foreground">{carrier}</span>
                          </span>
                        )}
                        <span>
                          <span className="text-muted-foreground">נוצרה: </span>
                          <span className="font-medium text-foreground">
                            {new Date(q.created_at).toLocaleDateString("he-IL")}
                          </span>
                        </span>
                      </div>
                    </div>
                    {/* Total + action */}
                    <div className="flex flex-col items-end gap-2">
                      {totalDisplay && (
                        <div className="text-left">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            סה"כ
                          </div>
                          <div className="font-mono text-base font-bold text-primary">
                            {totalDisplay}
                          </div>
                          {q.margin_pct != null && (
                            <div className="text-[11px] text-success">
                              רווח {Number(q.margin_pct).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      )}
                      <Button
                        asChild
                        size="sm"
                        className="rounded-xl bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                      >
                        <Link to="/dashboard/quotes/$id" params={{ id: q.id }}>
                          הצג
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <NewQuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        onSaved={() => refetch()}
      />
    </div>
  );
}

function HeroCard({
  label,
  value,
  gradient,
  items,
  footer,
}: {
  label: string;
  value: number;
  gradient: string;
  items: { code: string; client: string | null; date: string }[];
  footer: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className={cn("bg-gradient-to-br p-4 text-white", gradient)}>
        <div className="text-sm/6 opacity-90">{label}</div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
      </div>
      <div className="min-h-[92px] space-y-1 p-3">
        {items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">אין נתונים</div>
        ) : (
          items.map((it) => (
            <div
              key={it.code}
              className="flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border hover:bg-muted/50"
            >
              <span className="text-muted-foreground">
                {new Date(it.date).toLocaleDateString("he-IL")}
              </span>
              <span className="truncate font-medium">
                {it.client ? `${it.client} · ` : ""}#{it.code}
              </span>
            </div>
          ))
        )}
      </div>
      {footer}
    </div>
  );
}

// dir="ltr" here is deliberate: it only controls flex item ordering (so the
// icon always lands first/leftmost, matching the original button), it does
// not affect how the Hebrew label text itself renders. Without it, <a> and
// <button> resolved the icon/text order differently under the page's
// ambient dir="rtl", which is what made the four footers look inconsistent.
const heroFooterCls =
  "flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-xs font-medium text-primary hover:bg-muted/50";
