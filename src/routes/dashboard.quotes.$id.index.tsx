import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, FileDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QuoteDocument,
  QUOTE_STATUS_BADGE_LIGHT,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_PICKER_OPTIONS,
  isRecord,
  str,
} from "@/components/quote-document";
import { getQuote, updateQuoteOpsStatus, type QuoteOpsStatus } from "@/lib/quotes.functions";
import { createCaseFromQuote, listServiceReps, assignCaseRep, type CaseRep } from "@/lib/operations.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      { title: "הצעת מחיר — AFIK Logistics Platform" },
      { name: "description", content: "צפייה בפרטי הצעת מחיר." },
      { property: "og:title", content: "הצעת מחיר — AFIK Logistics Platform" },
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
  const navigate = useNavigate();
  const getQuoteFn = useServerFn(getQuote);
  const updateQuoteOpsStatusFn = useServerFn(updateQuoteOpsStatus);
  const createCaseFromQuoteFn = useServerFn(createCaseFromQuote);
  const listServiceRepsFn = useServerFn(listServiceReps);
  const assignCaseRepFn = useServerFn(assignCaseRep);
  const queryClient = useQueryClient();

  const { data: serviceReps = [] } = useQuery({
    queryKey: ["service-reps"],
    queryFn: () => listServiceRepsFn(),
  });
  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => getQuoteFn({ data: { id } }),
  });

  const payloadRecord = quote && isRecord(quote.payload) ? quote.payload : {};
  const currentOpsStatus = str(payloadRecord.opsStatus);
  const isArchived = currentOpsStatus === "archived";
  const caseNumber = str(payloadRecord.caseNumber);
  const caseId = str(payloadRecord.caseId);

  const statusMutation = useMutation({
    mutationFn: (opsStatus: QuoteOpsStatus) => updateQuoteOpsStatusFn({ data: { id, opsStatus } }),
    onSuccess: () => {
      toast.success("סטטוס ההצעה עודכן");
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: () => toast.error("עדכון הסטטוס נכשל"),
  });

  // "הועבר" is special: it snapshots a full copy of the quote into a new
  // case in the Operations module (own case number, frozen data), archives
  // this quote, and navigates over to the case for documentation/handoff.
  const transferMutation = useMutation({
    mutationFn: () => createCaseFromQuoteFn({ data: { quoteId: id } }),
    onSuccess: (caseRow) => {
      toast.success(`ההצעה הועברה לארכיון ונפתח תיק ${caseRow.case_code} במשלוחים`);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      sessionStorage.setItem("highlight-case", caseRow.id);
      navigate({ to: "/dashboard/shipments" });
    },
    onError: () => toast.error("העברת ההצעה לתיק נכשלה"),
  });

  // Picking a handling rep directly on the quote is a shortcut for the same
  // transfer: it opens the case (if not already open) and assigns the rep
  // to it in one step, instead of clicking "הועבר" first and assigning the
  // rep afterward on the case page.
  const assignRepMutation = useMutation({
    mutationFn: async (rep: CaseRep) => {
      const caseRow = await createCaseFromQuoteFn({ data: { quoteId: id } });
      await assignCaseRepFn({ data: { id: caseRow.id, rep } });
      return caseRow;
    },
    onSuccess: (caseRow) => {
      toast.success(`ההצעה הועברה לארכיון ונפתח תיק ${caseRow.case_code} במשלוחים`);
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      sessionStorage.setItem("highlight-case", caseRow.id);
      navigate({ to: "/dashboard/shipments" });
    },
    onError: () => toast.error("שיוך הנציג והעברת ההצעה נכשלו"),
  });

  useEffect(() => {
    if (!quote) return;
    if (sessionStorage.getItem("autoprint-quote") !== quote.id) return;
    sessionStorage.removeItem("autoprint-quote");
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [quote]);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי · הצעות מחיר</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            {quote?.quote_code ?? "הצעת מחיר"}
          </h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button asChild className="gap-2">
            <Link to="/dashboard/quotes/$id/edit" params={{ id }}>
              <Pencil className="h-4 w-4" /> ערוך הצעה
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/quotes/$id/customer-view" params={{ id }}>
              <Eye className="h-4 w-4" /> הצעה ללקוח
            </Link>
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => window.print()}>
            <FileDown className="h-4 w-4" /> ייצוא ל-PDF
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] print:block print:space-y-6">
          <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start print:hidden">
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
              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="text-xs text-muted-foreground">סטטוס הצעה</div>
                {isArchived ? (
                  <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${QUOTE_STATUS_BADGE_LIGHT.archived}`}
                      >
                        {QUOTE_STATUS_LABELS.archived}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ההצעה הועברה ונשמרה בארכיון. כל הנתונים הועתקו לתיק {caseNumber || ""} במודול המשלוחים.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        if (caseId) sessionStorage.setItem("highlight-case", caseId);
                        navigate({ to: "/dashboard/shipments" });
                      }}
                    >
                      עבור לתיק במשלוחים
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {QUOTE_STATUS_PICKER_OPTIONS.map((opt) => {
                        const active = currentOpsStatus === opt.value;
                        const isTransferred = opt.value === "transferred";
                        const pending = isTransferred ? transferMutation.isPending : statusMutation.isPending;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              isTransferred
                                ? transferMutation.mutate()
                                : statusMutation.mutate(opt.value as QuoteOpsStatus)
                            }
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                              active
                                ? (QUOTE_STATUS_BADGE_LIGHT[opt.value] ?? "border-primary bg-primary/10 text-primary")
                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      סטטוס נוכחי: {currentOpsStatus ? (QUOTE_STATUS_LABELS[currentOpsStatus] ?? currentOpsStatus) : "טרם הועבר"}
                    </div>
                    <div className="space-y-1.5 border-t pt-3">
                      <div className="text-xs text-muted-foreground">שיוך לנציג שירות מטפל</div>
                      <Select
                        value=""
                        onValueChange={(repId) => {
                          const rep = serviceReps.find((r) => r.id === repId);
                          if (rep) assignRepMutation.mutate({ id: rep.id, name: rep.name, role: rep.role });
                        }}
                        disabled={assignRepMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר נציג שירות..." />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceReps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.id}>
                              {rep.name} — {rep.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        בחירת נציג פותחת תיק במשלוחים ומשייכת אותו אליו.
                      </p>
                    </div>
                  </>
                )}
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
            <QuoteDocument quote={quote} />

            <div className="rounded-2xl border bg-card p-5 shadow-sm print:hidden">
              <div className="mb-4 text-sm font-semibold">מסלול ותאריכים (פנימי)</div>
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
              <div className="print:hidden">
                <PayloadSections payload={quote.payload as Record<string, unknown>} />
              </div>
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

// Keep in sync with ATTR_OPTIONS in new-quote-dialog.tsx.
const ATTR_LABEL: Record<string, string> = {
  coldchain: "שרשרת קירור",
  valuable: "מטען יקר ערך",
  gps: "GPS מטען",
  dangerous: "מטען מסוכן",
  fragile: "מטען שביר",
  timeCritical: "מטען קריטי (Time Critical)",
  dataLogger: "דורש Data Logger",
  shockIndicator: "דורש Shock Indicator",
  tiltIndicator: "דורש Tilt Indicator",
  humidityLogger: "דורש Humidity Logger",
  chainOfCustody: "דורש שרשרת אחזקה (Chain of Custody)",
  dryIce: "Dry Ice",
  cryogenic: "Cryogenic",
  signatureRequired: "דורש חתימה במסירה",
  clinical: "משלוח קליני",
  biological: "חומר ביולוגי",
  bloodProducts: "דם ומוצרי דם",
  cellsAndTissues: "תאים ורקמות",
  dedicatedVehicle: "דורש רכב ייעודי",
  whiteGlove: "White Glove",
  obc: "OBC",
  nfo: "NFO",
  charter: "Charter",
  noFlip: "לא להפוך",
  noStack: "לא לערום",
  keepUpright: "להחזיק זקוף",
  moistureSensitive: "רגיש ללחות",
  lightSensitive: "רגיש לאור",
  shockSensitive: "רגיש לזעזועים",
  dryIceRefill: "נדרש מילוי קרח יבש",
};

// Only the attributes that were actually checked — same "true only" filtering as renderServices.
function renderAttrs(v: unknown): React.ReactNode {
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
          {ATTR_LABEL[k] ?? k}
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
            ["דרישות מיוחדות", specialReq],
            ["הערות נוספות", extraNotes],
          ]}
        />
        <div className="mt-4 space-y-1">
          <div className="text-xs text-muted-foreground">מאפיינים</div>
          {renderAttrs(attrs)}
        </div>
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
