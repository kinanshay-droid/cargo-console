import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuote } from "@/lib/quotes.functions";
import { ATTR_OPTIONS } from "@/components/new-quote-dialog";
import {
  QuoteDocument,
  FULL_VISIBILITY,
  parsePricingItems,
  parsePackages,
  parsePackSelections,
  palletLabel,
  selectionLabel,
  isRecord,
  str,
  bool,
  type QuoteVisibility,
} from "@/components/quote-document";

export const Route = createFileRoute("/dashboard/quotes/$id/customer-view")({
  head: () => ({
    meta: [
      { title: "הצעה ללקוח — AFIK Logistics Platform" },
      { name: "description", content: "בחירת הסעיפים שיוצגו ללקוח והפקת PDF." },
    ],
  }),
  component: CustomerQuoteView,
});

function SectionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
      />
    </label>
  );
}

function ItemChecklist({
  items,
  selected,
  onChange,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 ml-1 mr-3 space-y-1 border-r pr-3">
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <label key={it.id} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={on}
              onChange={() => onChange(on ? selected.filter((x) => x !== it.id) : [...selected, it.id])}
              className="h-3.5 w-3.5 shrink-0 rounded border-muted-foreground/30 accent-primary"
            />
            <span className="truncate">{it.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function CustomerQuoteView() {
  const { id } = Route.useParams();
  const getQuoteFn = useServerFn(getQuote);
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => getQuoteFn({ data: { id } }),
  });

  const payload = isRecord(quote?.payload) ? quote.payload : {};
  const currency = str(quote?.currency) || "USD";
  const pricingItemsAll = parsePricingItems(payload.pricingItems, currency);
  const packagesAll = parsePackages(payload.packages);
  const packSelectionsAll = parsePackSelections(payload.packSelections);
  const attrs = isRecord(payload.attrs) ? payload.attrs : {};
  const checkedAttrsAll = ATTR_OPTIONS.filter((a) => bool(attrs[a.id]));
  const packagingItems = [
    ...packagesAll.map((p) => ({ id: p.id, label: palletLabel(p) })),
    ...packSelectionsAll.map((s) => ({ id: s.key, label: selectionLabel(s) })),
  ];

  const [visibility, setVisibility] = useState<QuoteVisibility>(FULL_VISIBILITY);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!quote || initialized) return;
    setVisibility({
      ...FULL_VISIBILITY,
      costItemIds: pricingItemsAll.map((r) => r.id),
      attrIds: checkedAttrsAll.map((a) => a.id),
      packageIds: packagingItems.map((p) => p.id),
    });
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  function toggleSection<K extends keyof QuoteVisibility>(key: K, value: QuoteVisibility[K]) {
    setVisibility((v) => ({ ...v, [key]: value }));
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי · הצעה ללקוח</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">בחר מה להציג ללקוח</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            סמן או הסר סעיפים ופריטים — התצוגה מתעדכנת מיד. ניתן לייצא ל-PDF כשסיימת.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" className="gap-2" onClick={() => window.print()}>
            <FileDown className="h-4 w-4" /> ייצוא ל-PDF
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/quotes/$id" params={{ id }}>
              <ArrowRight className="h-4 w-4" /> חזרה להצעה
            </Link>
          </Button>
        </div>
      </div>

      {isLoading || !quote ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          טוען...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] print:block">
          <aside className="space-y-3 print:hidden lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 text-sm font-semibold">סעיפים להצגה</div>
              <div className="space-y-2.5">
                <SectionToggle label="מסלול ולקוח" checked={visibility.route} onChange={(v) => toggleSection("route", v)} />
                <SectionToggle label="סיכום כמות ומשקל" checked={visibility.summary} onChange={(v) => toggleSection("summary", v)} />
                <SectionToggle label="פרטי משלוח (Incoterms וכו')" checked={visibility.info} onChange={(v) => toggleSection("info", v)} />

                <div>
                  <SectionToggle label="עלות שירותים" checked={visibility.costs} onChange={(v) => toggleSection("costs", v)} />
                  {visibility.costs && (
                    <ItemChecklist
                      items={pricingItemsAll.map((r) => ({ id: r.id, label: r.desc }))}
                      selected={visibility.costItemIds ?? []}
                      onChange={(ids) => toggleSection("costItemIds", ids)}
                    />
                  )}
                </div>

                <div>
                  <SectionToggle label="פרטי אריזה" checked={visibility.packaging} onChange={(v) => toggleSection("packaging", v)} />
                  {visibility.packaging && (
                    <ItemChecklist
                      items={packagingItems}
                      selected={visibility.packageIds ?? []}
                      onChange={(ids) => toggleSection("packageIds", ids)}
                    />
                  )}
                </div>

                <SectionToggle label="שולח ונמען" checked={visibility.shipperConsignee} onChange={(v) => toggleSection("shipperConsignee", v)} />
                <SectionToggle label="תנאים והחרגות" checked={visibility.terms} onChange={(v) => toggleSection("terms", v)} />
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <QuoteDocument quote={quote} visibility={visibility} />
          </div>
        </div>
      )}
    </div>
  );
}
