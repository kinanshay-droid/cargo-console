import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuote } from "@/lib/quotes.functions";
import {
  DROP_TYPE_SPECS,
  FIELDS_BY_KIND,
  STOP_FIELD_LABEL,
  isDropTypeId,
  type StopField,
  type StopKind,
} from "@/lib/drop-stops";

const SHIPMENT_MODE_LABEL: Record<string, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};

export const Route = createFileRoute("/dashboard/quotes/$id/")({
  head: () => ({
    meta: [
      { title: "הצעת מחיר — Cargo Console" },
      { name: "description", content: "צפייה בפרטי הצעת מחיר." },
      { property: "og:title", content: "הצעת מחיר — Cargo Console" },
      { property: "og:description", content: "צפייה בפרטי הצעת מחיר." },
    ],
  }),
  component: QuoteDetail,
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

function QuoteDetail() {
  const { id } = Route.useParams();
  const getQuoteFn = useServerFn(getQuote);
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => getQuoteFn({ data: { id } }),
  });

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי · הצעות מחיר</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {quote?.quote_code ?? "הצעת מחיר"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild className="gap-2">
            <Link to="/dashboard/quotes/$id/edit" params={{ id }}>
              <Pencil className="h-4 w-4" /> ערוך הצעה
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/quotes">
              <ArrowRight className="h-4 w-4" /> חזרה לרשימה
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          טוען...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm text-destructive shadow-sm">
          שגיאה בטעינת ההצעה
        </div>
      ) : quote ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold">לקוח</div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {SHIPMENT_MODE_LABEL[quote.shipment_mode] ?? quote.shipment_mode ?? "—"}
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground">שם לקוח</div>
                  <div className="text-base font-semibold">{quote.customer_name ?? "—"}</div>
                </div>
                <Field label="Ref לקוח" value={quote.customer_ref} />
                <Field label="מס' הצעה" value={<span className="font-mono">{quote.quote_code}</span>} />
                <Field label="מטבע" value={quote.currency} />
                <Field label="נוצרה" value={new Date(quote.created_at).toLocaleString("he-IL")} />
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold">סיכום פיננסי</div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground">סה"כ</div>
                  <div className="text-2xl font-bold tracking-tight">
                    {quote.total != null ? `${quote.total} ${quote.currency ?? ""}` : "—"}
                  </div>
                </div>
                <Field label="אחוז רווח" value={quote.margin_pct != null ? `${quote.margin_pct}%` : null} />
              </div>
            </div>
          </aside>

          <div className="space-y-6 min-w-0">
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold">פרטי משלוח</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="סוג משלוח" value={quote.shipment_kind} />
                <Field label="Incoterm" value={quote.incoterm} />
                <Field
                  label="אופי משלוח"
                  value={SHIPMENT_MODE_LABEL[quote.shipment_mode] ?? quote.shipment_mode}
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="mb-4 text-sm font-semibold">מסלול ותאריכים</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="נמל מוצא" value={quote.origin_port} />
                <Field label="נמל יעד" value={quote.dest_port} />
                <Field
                  label="נמלי מעבר"
                  value={
                    Array.isArray(quote.transit_ports) && quote.transit_ports.length > 0
                      ? quote.transit_ports.join(", ")
                      : "—"
                  }
                />
                <Field label="סוכן" value={quote.agent} />
                <Field label="חברת תעופה" value={quote.airline} />
                <Field label="תאריך יציאה" value={quote.depart_date} />
                <Field label="תאריך הגעה" value={quote.arrive_date} />
              </div>
            </div>

            {quote.payload && Object.keys(quote.payload as object).length > 0 && (
              <PayloadSections payload={quote.payload as Record<string, unknown>} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const CARGO_TYPE_LABEL: Record<string, string> = {
  general: "כללי",
  temp: "בקרת טמפרטורה",
  danger: "מסוכן",
  fragile: "שביר",
  oversize: "חריג",
};

const SERVICE_LABEL: Record<string, string> = {
  air: "אווירי",
  sea: "ימי",
  land: "יבשתי",
  pickup: "איסוף",
  delivery: "מסירה",
  clearance: "עמילות מכס",
  insurance: "ביטוח",
  exportCustoms: "מכס יצוא",
  importCustoms: "מכס יבוא",
  warehousing: "אחסנה",
  packing: "אריזה",
  labeling: "סימון",
};

function renderServices(v: unknown): React.ReactNode {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fmt(v);
  const entries = Object.entries(v as Record<string, unknown>).filter(
    ([, val]) => val === true || val === "true"
  );
  if (entries.length === 0) return "—";
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k]) => (
        <span
          key={k}
          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
        >
          {SERVICE_LABEL[k] ?? k}
        </span>
      ))}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(
      ([, val]) => val != null && val !== ""
    );
    if (entries.length === 0) return "—";
    return entries
      .map(([k, val]) => `${k}: ${typeof val === "boolean" ? (val ? "כן" : "לא") : String(val)}`)
      .join(" · ");
  }
  return String(v);
}

function PayloadCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function KVGrid({ items }: { items: Array<[string, unknown]> }) {
  const visible = items.filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  if (visible.length === 0) {
    return <div className="text-sm text-muted-foreground">אין נתונים</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {visible.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-sm font-medium break-words">{fmt(value)}</div>
        </div>
      ))}
    </div>
  );
}

type PricingItem = {
  id?: string;
  group?: string;
  label?: string;
  desc?: string;
  qty?: number | string;
  unit?: string;
  unitPrice?: number | string;
  price?: number | string;
  currency?: string;
  total?: number | string;
  note?: string;
  sourceLabel?: string;
  sourceDate?: string;
};

function firstValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (value == null || value === "") continue;
    return value;
  }
  return null;
}

function PayloadSections({ payload }: { payload: Record<string, unknown> }) {
  const {
    cargoType,
    attrs,
    tempSeries,
    selectedPackModel,
    pallet,
    unitWeight,
    unitQty,
    specialReq,
    extraNotes,
    services,
    compare,
    logisticsNotes,
    routeApproved,
    pricingItems,
    pricingNotes,
    dropType,
    stops,
  } = payload as Record<string, unknown>;

  const pricing = Array.isArray(pricingItems) ? (pricingItems as PricingItem[]) : [];
  const compareRows = Array.isArray(compare) ? (compare as Array<Record<string, unknown>>) : [];
  const dropTypeId = isDropTypeId(dropType) ? dropType : null;
  const stopsList = Array.isArray(stops)
    ? (stops as Array<Record<string, unknown>>).filter((s) => s && typeof s === "object")
    : [];

  return (
    <div className="space-y-6">
      <PayloadCard title="אופי מטען">
        <KVGrid
          items={[
            ["סוג מטען", cargoType ? CARGO_TYPE_LABEL[String(cargoType)] ?? cargoType : null],
            ["טמפרטורה", tempSeries],
            ["דגם אריזה", selectedPackModel],
            ["משטח", pallet],
            ["משקל יחידה", unitWeight],
            ["כמות יחידות", unitQty],
            ["מאפיינים", attrs],
            ["דרישות מיוחדות", specialReq],
            ["הערות נוספות", extraNotes],
          ]}
        />
      </PayloadCard>

      <PayloadCard title="לוגיסטיקה">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted-foreground">שירותים</div>
            <div className="text-sm font-medium">{renderServices(services)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">מסלול מאושר</div>
            <div className="text-sm font-medium">{fmt(routeApproved)}</div>
          </div>
          {logisticsNotes ? (
            <div className="space-y-1 md:col-span-3">
              <div className="text-xs text-muted-foreground">הערות לוגיסטיות</div>
              <div className="text-sm">{fmt(logisticsNotes)}</div>
            </div>
          ) : null}
        </div>
        {compareRows.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">השוואת ספקים</div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {Object.keys(compareRows[0]).map((k) => (
                      <th key={k} className="px-3 py-2 text-right font-medium">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.keys(compareRows[0]).map((k) => (
                        <td key={k} className="px-3 py-2">{fmt(row[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PayloadCard>

      {dropTypeId && (
        <PayloadCard title={`משלוחי דרופ · ${dropTypeId}`}>
          <div className="mb-3 text-xs text-muted-foreground">
            {DROP_TYPE_SPECS[dropTypeId].desc}
          </div>
          {stopsList.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              לא הוגדרו תחנות.
            </div>
          ) : (
            <div className="space-y-3">
              {stopsList.map((s, i) => {
                const kindRaw = String(s.kind ?? "");
                const kind = (["Pickup", "Drop", "Hub"] as StopKind[]).includes(kindRaw as StopKind)
                  ? (kindRaw as StopKind)
                  : null;
                const fields: StopField[] = kind ? FIELDS_BY_KIND[kind] : [];
                return (
                  <div key={String(s.id ?? i)} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {kind ?? kindRaw}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {fields.map((f) => {
                        const v = s[f];
                        if (typeof v !== "string" || !v) return null;
                        return (
                          <div key={f} className="space-y-0.5">
                            <div className="text-xs text-muted-foreground">{STOP_FIELD_LABEL[f]}</div>
                            <div className="text-sm">{v}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PayloadCard>
      )}


      <PayloadCard title="תמחור">
        {pricing.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">תיאור</th>
                  <th className="px-3 py-2 text-right font-medium">כמות</th>
                  <th className="px-3 py-2 text-right font-medium">יחידה</th>
                  <th className="px-3 py-2 text-right font-medium">מחיר יח'</th>
                  <th className="px-3 py-2 text-right font-medium">מטבע</th>
                  <th className="px-3 py-2 text-right font-medium">סה"כ</th>
                  <th className="px-3 py-2 text-right font-medium">הערה</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((it, i) => (
                  <tr key={it.id ?? i} className="border-t">
                    <td className="px-3 py-2">{fmt(firstValue(it.desc, it.label, it.group))}</td>
                    <td className="px-3 py-2">{fmt(it.qty)}</td>
                    <td className="px-3 py-2">{fmt(it.unit)}</td>
                    <td className="px-3 py-2">{fmt(firstValue(it.unitPrice, it.price))}</td>
                    <td className="px-3 py-2">{fmt(it.currency)}</td>
                    <td className="px-3 py-2 font-medium">{fmt(firstValue(it.total, it.price))}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {fmt(firstValue(it.note, it.sourceLabel, it.sourceDate))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">אין פריטי תמחור</div>
        )}
        {pricingNotes ? (
          <div className="mt-4 space-y-1">
            <div className="text-xs text-muted-foreground">הערות תמחור</div>
            <div className="text-sm">{fmt(pricingNotes)}</div>
          </div>
        ) : null}
      </PayloadCard>
    </div>
  );
}
