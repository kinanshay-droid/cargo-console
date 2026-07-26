import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, FileText, Search, Download, Eye, Plus, Pencil, Trash2, CheckCircle2, Archive, ScrollText, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { listPriceLists, type PriceListRow } from "@/lib/customers.functions";
import {
  listPricingRules,
  upsertPricingRule,
  publishPricingRule,
  archivePricingRule,
  deletePricingRule,
  listCalculationLog,
  type PricingRule,
  type PricingRuleInput,
  type PricingLogRow,
} from "@/lib/pricing-engine.functions";
import { PricingRuleForm } from "@/components/pricing-rule-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TONE_BADGE } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/pricelists")({
  head: () => ({
    meta: [
      { title: "ניהול מחירונים — AFIK Logistics Platform" },
      { name: "description", content: "מחירונים, חוקיות תמחור ולוג חישוב עבור מנוע התמחור." },
      { property: "og:title", content: "ניהול מחירונים — AFIK Logistics Platform" },
      { property: "og:description", content: "מחירונים, חוקיות תמחור ולוג חישוב עבור מנוע התמחור." },
    ],
  }),
  component: PriceListsPage,
});

function PriceListsPage() {
  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">ניהול מחירונים</h1>
          <p className="mt-1 text-sm text-muted-foreground">מחירונים ללקוחות, חוקיות התמחור המרכזיות ולוג חישוב.</p>
        </div>
        <Button asChild variant="outline" className="gap-2 rounded-xl">
          <Link to="/dashboard/commercial">
            <ArrowRight className="h-4 w-4" /> חזרה לדשבורד המסחרי
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="lists" dir="rtl" className="w-full">
        <TabsList>
          <TabsTrigger value="lists" className="gap-1.5"><FileText className="h-4 w-4" /> מחירוני לקוחות</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Sparkles className="h-4 w-4" /> חוקיות תמחור</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><ScrollText className="h-4 w-4" /> לוג חישוב</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="mt-4">
          <CustomerPriceListsTab />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <PricingRulesTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <CalculationLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================= Customer price lists (existing) =================

function CustomerPriceListsTab() {
  const listFn = useServerFn(listPriceLists);
  const { data: rows = [], isLoading } = useQuery<PriceListRow[]>({
    queryKey: ["price-lists"],
    queryFn: () => listFn() as Promise<PriceListRow[]>,
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.companyName, r.customerCode, r.priceList, r.priceListName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("price-lists").createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) { toast.error("לא ניתן לפתוח את הקובץ"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const withFile = rows.filter((r) => r.priceListFile).length;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-border px-6 py-6 md:flex-row md:items-center md:px-8">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">מחירונים ללקוחות</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} תוצאות · {rows.length} סה"כ · {withFile} עם קובץ
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי לקוח או מחירון..."
            className="w-full rounded-2xl border-none bg-muted py-2.5 pr-10 text-sm text-primary placeholder:text-muted-foreground" />
        </div>
      </div>
      {isLoading ? <div className="px-6 py-16 text-center text-sm text-muted-foreground">טוען...</div>
        : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" /> אין מחירונים משויכים עדיין
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2 md:p-8">
            {filtered.map((r) => (
              <li key={r.customerId} className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-primary">{r.companyName}</div>
                    {r.customerCode && <div className="font-mono text-[11px] text-muted-foreground">{r.customerCode}</div>}
                  </div>
                  {r.discount && <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE_BADGE.success)}>הנחה {r.discount}%</span>}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{r.priceListName || r.priceList || "מחירון ללא שם"}</span>
                  {r.currency && <span className="mr-auto shrink-0 rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{r.currency.split(",")[0]}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="text-[11px] text-muted-foreground">{r.updatedAt ? `עודכן ${new Date(r.updatedAt).toLocaleDateString("he-IL")}` : "—"}</span>
                  <div className="flex items-center gap-1.5">
                    {r.priceListFile && (
                      <Button size="sm" variant="outline" onClick={() => openFile(r.priceListFile!)} className="h-7 gap-1 rounded-lg text-[11px]">
                        <Download className="h-3 w-3" /> קובץ
                      </Button>
                    )}
                    <Button asChild size="sm" className="h-7 gap-1 rounded-lg bg-primary text-[11px] text-primary-foreground hover:bg-primary/90">
                      <Link to="/dashboard/customers/$id" params={{ id: r.customerId }} search={{ tab: "commercial" } as never}>
                        <Eye className="h-3 w-3" /> תיק לקוח
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

// ================= Pricing rules =================

function PricingRulesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPricingRules);
  const upsertFn = useServerFn(upsertPricingRule);
  const publishFn = useServerFn(publishPricingRule);
  const archiveFn = useServerFn(archivePricingRule);
  const deleteFn = useServerFn(deletePricingRule);

  const { data: rules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ["pricing-rules"],
    queryFn: () => listFn() as Promise<PricingRule[]>,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.service_type, r.origin_country, r.destination_country, r.origin_airport, r.destination_airport]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rules, search, statusFilter]);

  const upsert = useMutation({
    mutationFn: (input: PricingRuleInput) => upsertFn({ data: input }),
    onSuccess: () => { toast.success("נשמר"); setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
    onError: (e: Error) => toast.error(e.message ?? "שגיאה בשמירה"),
  });
  const publish = useMutation({
    mutationFn: (id: string) => publishFn({ data: { id } }),
    onSuccess: () => { toast.success("פורסם"); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-rules"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("נמחק"); qc.invalidateQueries({ queryKey: ["pricing-rules"] }); },
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: PricingRule) => { setEditing(r); setOpen(true); };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-border px-6 py-6 md:flex-row md:items-center md:px-8">
        <div>
          <h2 className="text-2xl font-extrabold text-primary">חוקיות תמחור (Pricing Rules)</h2>
          <p className="mt-1 text-sm text-muted-foreground">{filtered.length} מתוך {rules.length} חוקים · העדיפות הגבוהה ביותר מנצחת</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "published" | "archived")}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm">
            <option value="all">כל הסטטוסים</option>
            <option value="draft">טיוטה</option>
            <option value="published">מפורסם</option>
            <option value="archived">בארכיון</option>
          </select>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש..." className="rounded-2xl border-none bg-muted pr-9 text-sm" />
          </div>
          <Button onClick={openNew} className="gap-1.5 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> חוק חדש
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-40" /> אין חוקיות תמחור עדיין. הוסף חוק חדש כדי להתחיל.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">שם</th>
                <th className="px-4 py-3">סטטוס</th>
                <th className="px-4 py-3">עדיפות</th>
                <th className="px-4 py-3">גרסה</th>
                <th className="px-4 py-3">בסיס</th>
                <th className="px-4 py-3">תעריף</th>
                <th className="px-4 py-3">מטבע</th>
                <th className="px-4 py-3">תחולה</th>
                <th className="px-4 py-3 text-left">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-3 font-semibold text-primary">{r.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === "published" ? "default" : r.status === "draft" ? "secondary" : "outline"}>
                      {r.status === "published" ? "מפורסם" : r.status === "draft" ? "טיוטה" : "ארכיון"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{r.priority}</td>
                  <td className="px-4 py-3 font-mono text-xs">v{r.version}</td>
                  <td className="px-4 py-3">{Number(r.base_price).toFixed(2)}</td>
                  <td className="px-4 py-3">{Number(r.rate).toFixed(2)} / {r.unit}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.currency}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {[r.origin_country && `מ:${r.origin_country}`, r.destination_country && `אל:${r.destination_country}`, r.service_type, r.temperature_range]
                      .filter(Boolean).join(" · ") || "כללי"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="ערוך"><Pencil className="h-3.5 w-3.5" /></Button>
                      {r.status !== "published" && (
                        <Button size="sm" variant="ghost" onClick={() => publish.mutate(r.id)} title="פרסם"><CheckCircle2 className="h-3.5 w-3.5 text-success" /></Button>
                      )}
                      {r.status !== "archived" && (
                        <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)} title="ארכיון"><Archive className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("למחוק את החוק?")) del.mutate(r.id); }} title="מחק">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <PricingRuleForm
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
          initial={editing}
          saving={upsert.isPending}
          onSubmit={(input) => upsert.mutate(editing ? { ...input, id: editing.id } : input)}
        />
      )}
    </div>
  );
}

// ================= Calculation log =================

function CalculationLogTab() {
  const listFn = useServerFn(listCalculationLog);
  const { data: rows = [], isLoading } = useQuery<PricingLogRow[]>({
    queryKey: ["pricing-log"],
    queryFn: () => listFn() as Promise<PricingLogRow[]>,
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-6 md:px-8">
        <h2 className="text-2xl font-extrabold text-primary">לוג חישוב תמחור</h2>
        <p className="mt-1 text-sm text-muted-foreground">100 החישובים האחרונים של מנוע התמחור</p>
      </div>
      {isLoading ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">טוען...</div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" /> אין רשומות עדיין. חישוב תמחור ראשון ייצור רשומה כאן.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">מועד</th>
                <th className="px-4 py-3">חוק</th>
                <th className="px-4 py-3">גרסה</th>
                <th className="px-4 py-3">מחיר</th>
                <th className="px-4 py-3">מטבע</th>
                <th className="px-4 py-3">זמן (ms)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("he-IL")}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{r.rule_used ?? <span className="text-destructive">No Rule</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.pricing_version ? `v${r.pricing_version}` : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{r.calculated_price != null ? Number(r.calculated_price).toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.currency ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.execution_time_ms ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
