import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listMyQuotes } from "@/lib/quotes.functions";
import { TONE_BADGE, TONE_GRADIENT } from "@/lib/theme";

type SortKey = "activity" | "name" | "recent" | "total_desc";

const SHIPMENT_MODE_LABEL: Record<string, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};

const MODE_BADGE: Record<string, string> = {
  direct: TONE_BADGE.muted,
  console: TONE_BADGE.accent,
  transship: TONE_BADGE.success,
};

// Same four shipment-kind categories used across the New Quote wizard,
// Operations dashboard and Pickup/Distribution page.
const SHIP_KIND_LABEL: Record<string, string> = {
  import: "ייבוא",
  export: "ייצוא",
  distribution: "דרופ",
  domestic: "פנים ארצי",
};

export const Route = createFileRoute("/dashboard/quotes/")({
  head: () => ({
    meta: [
      { title: "ניהול הצעות מחיר — AFIK Logistics Platform" },
      { name: "description", content: "רשימת כל הצעות המחיר של הארגון, מקובצת לפי לקוח." },
      { property: "og:title", content: "ניהול הצעות מחיר — AFIK Logistics Platform" },
      { property: "og:description", content: "רשימת כל הצעות המחיר של הארגון, מקובצת לפי לקוח." },
    ],
  }),
  component: QuotesManagement,
});

type QuoteRow = {
  id: string;
  quote_code: string;
  shipment_mode: string;
  customer_name: string | null;
  customer_ref: string | null;
  shipment_kind: string | null;
  incoterm: string | null;
  origin_port: string | null;
  dest_port: string | null;
  depart_date: string | null;
  arrive_date: string | null;
  agent: string | null;
  airline: string | null;
  currency: string | null;
  total: number | null;
  margin_pct: number | null;
  created_at: string;
};

function QuotesManagement() {
  const listFn = useServerFn(listMyQuotes);
  const { data: quotes = [], isLoading } = useQuery<QuoteRow[]>({
    queryKey: ["my-quotes"],
    queryFn: () => listFn() as Promise<QuoteRow[]>,
  });

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [incoterm, setIncoterm] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("activity");

  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v && v.trim().length > 0))).sort((a, b) =>
      a.localeCompare(b, "he"),
    );
  const incotermOptions = useMemo(() => uniq(quotes.map((q) => q.incoterm)), [quotes]);

  const resetFilters = () => {
    setSearch("");
    setKind("all");
    setIncoterm("all");
    setSort("activity");
  };

  const activeFilterCount =
    (search ? 1 : 0) + (kind !== "all" ? 1 : 0) + (incoterm !== "all" ? 1 : 0);

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((row) => {
      if (kind !== "all" && row.shipment_kind !== kind) return false;
      if (incoterm !== "all" && row.incoterm !== incoterm) return false;
      if (!q) return true;
      const name = (row.customer_name ?? "").toLowerCase();
      const code = (row.quote_code ?? "").toLowerCase();
      const route = `${row.origin_port ?? ""} ${row.dest_port ?? ""}`.toLowerCase();
      const modeLbl = (SHIPMENT_MODE_LABEL[row.shipment_mode] ?? row.shipment_mode ?? "").toLowerCase();
      const kindLbl = (row.shipment_kind ? SHIP_KIND_LABEL[row.shipment_kind] ?? row.shipment_kind : "").toLowerCase();
      return name.includes(q) || code.includes(q) || route.includes(q) || modeLbl.includes(q) || kindLbl.includes(q);
    });
  }, [quotes, search, kind, incoterm]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: QuoteRow[]; total: number; currency: string | null }>();
    for (const q of filteredQuotes) {
      const name = q.customer_name?.trim() || "ללא לקוח";
      if (!map.has(name)) map.set(name, { name, items: [], total: 0, currency: null });
      const g = map.get(name)!;
      g.items.push(q);
      const t = Number(q.total ?? 0);
      if (!Number.isNaN(t)) g.total += t;
      if (!g.currency && q.currency) g.currency = q.currency;
    }
    const arr = Array.from(map.values());
    for (const g of arr) {
      g.items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    arr.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name, "he");
        case "recent": {
          const at = a.items[0] ? new Date(a.items[0].created_at).getTime() : 0;
          const bt = b.items[0] ? new Date(b.items[0].created_at).getTime() : 0;
          return bt - at;
        }
        case "total_desc":
          return b.total - a.total;
        case "activity":
        default:
          return b.items.length - a.items.length || a.name.localeCompare(b.name, "he");
      }
    });
    return arr;
  }, [filteredQuotes, sort]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const isSearching = search.trim().length > 0 || kind !== "all" || incoterm !== "all";
  const effectiveOpen = isSearching ? "__all__" : (openKey ?? groups[0]?.name ?? null);

  const fmt = (n: number, cur?: string | null) =>
    `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }).format(n)} ${cur ?? "USD"}`;

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">ניהול הצעות מחיר</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הצעות מקובצות לפי לקוח, ממויינות לפי היקף פעילות.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2 rounded-xl">
          <Link to="/dashboard/commercial">
            <ArrowRight className="h-4 w-4" /> חזרה לדשבורד המסחרי
          </Link>
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label="לקוחות" value={groups.length} tone={TONE_GRADIENT.primary} />
        <SummaryTile label='סה"כ הצעות' value={filteredQuotes.length} tone={TONE_GRADIENT.accent} />
        <SummaryTile
          label="משלוח ישיר"
          value={filteredQuotes.filter((q) => q.shipment_mode === "direct").length}
          tone={TONE_GRADIENT.muted}
        />
        <SummaryTile
          label="קונסול / שטעון"
          value={filteredQuotes.filter((q) => q.shipment_mode !== "direct").length}
          tone={TONE_GRADIENT.success}
        />
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {/* Filter bar */}
        <div className="flex flex-col gap-4 border-b border-border bg-card/50 px-6 py-6 md:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-extrabold text-primary">לקוחות והצעות</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {groups.length} לקוחות · {filteredQuotes.length} הצעות
                {activeFilterCount > 0 ? ` · ${activeFilterCount} פילטרים פעילים` : ""}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1.5 self-start rounded-xl text-muted-foreground hover:text-primary md:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" /> נקה
              </Button>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי לקוח, מס' הצעה, מסלול..."
              className="w-full rounded-2xl border-none bg-muted py-2.5 pr-10 pl-9 text-sm text-primary placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="נקה חיפוש"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground md:col-span-1">
              <Filter className="h-3.5 w-3.5" /> סינון ומיון
            </div>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="סוג משלוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל סוגי המשלוח</SelectItem>
                <SelectItem value="import">ייבוא</SelectItem>
                <SelectItem value="export">ייצוא</SelectItem>
                <SelectItem value="distribution">דרופ</SelectItem>
                <SelectItem value="domestic">פנים ארצי</SelectItem>
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
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 rounded-xl border-border bg-card text-xs">
                <SelectValue placeholder="מיון" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">לפי היקף פעילות</SelectItem>
                <SelectItem value="recent">לפי הצעה אחרונה</SelectItem>
                <SelectItem value="total_desc">לפי סכום כולל</SelectItem>
                <SelectItem value="name">לפי שם לקוח</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Groups */}
        {isLoading ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">טוען...</div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
            אין הצעות שתואמות את הסינון
          </div>
        ) : (
          <ul className="space-y-3 p-6 md:p-8">
            {groups.map((g, idx) => {
              const isOpen = isSearching || effectiveOpen === g.name;
              const lastDate = g.items[0]?.created_at;
              return (
                <li
                  key={g.name}
                  className="overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-accent/30 hover:shadow-lg"
                >
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? "__none__" : g.name)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                        {idx + 1}
                      </span>
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-base font-semibold text-primary">
                        {g.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                        {g.items.length} הצעות
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      {g.total > 0 && (
                        <span className="hidden text-muted-foreground md:inline">
                          <span className="text-muted-foreground">היקף: </span>
                          <span className="font-bold text-primary tabular-nums">
                            {fmt(g.total, g.currency)}
                          </span>
                        </span>
                      )}
                      {lastDate && (
                        <span className="hidden text-muted-foreground md:inline">
                          עודכן {new Date(lastDate).toLocaleDateString("he-IL")}
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-1 gap-3 border-t border-border bg-muted/30 p-4 md:grid-cols-2">
                      {g.items.map((q) => {
                        const route = [q.origin_port, q.dest_port].filter(Boolean).join(" → ");
                        const totalNum = Number(q.total ?? 0);
                        const hasTotal = q.total != null && !Number.isNaN(totalNum) && totalNum !== 0;
                        return (
                          <Link
                            key={q.id}
                            to="/dashboard/quotes/$id"
                            params={{ id: q.id }}
                            className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-primary">
                                {q.quote_code}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                  MODE_BADGE[q.shipment_mode] ?? TONE_BADGE.muted,
                                )}
                              >
                                {SHIPMENT_MODE_LABEL[q.shipment_mode] ?? q.shipment_mode}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="truncate">
                                {route || <span className="text-muted-foreground/50">— ללא מסלול —</span>}
                              </span>
                              {q.incoterm && (
                                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {q.incoterm}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span>
                                {q.depart_date
                                  ? `יציאה ${new Date(q.depart_date).toLocaleDateString("he-IL")}`
                                  : "—"}
                              </span>
                              <span>
                                נוצרה {new Date(q.created_at).toLocaleDateString("he-IL")}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                              <div className="flex items-baseline gap-2">
                                {hasTotal ? (
                                  <span className="text-sm font-bold tabular-nums text-primary">
                                    {fmt(totalNum, q.currency)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/50">ללא סכום</span>
                                )}
                                {q.margin_pct != null && (
                                  <span className="text-[11px] font-medium text-success">
                                    רווח {Number(q.margin_pct)}%
                                  </span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground opacity-90 transition-opacity group-hover:opacity-100">
                                <Eye className="h-3 w-3" /> הצג
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm", tone)}>
      <div className="text-xs opacity-90">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
