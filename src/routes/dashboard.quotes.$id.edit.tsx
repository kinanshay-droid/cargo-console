import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getQuote, reviseQuote } from "@/lib/quotes.functions";
import { toast } from "sonner";
import { AirportCombobox } from "@/components/airport-combobox";
import { StopsEditor } from "@/components/new-quote-dialog";
import {
  DROP_TYPE_SPECS,
  isDropTypeId,
  seedStopsForDropType,
  normalizeStopsForPersist,
  type DropTypeId,
  type Stop,
  type StopKind,
} from "@/lib/drop-stops";

export const Route = createFileRoute("/dashboard/quotes/$id/edit")({
  head: () => ({
    meta: [
      { title: "עריכת הצעה — Cargo Console" },
      { name: "description", content: "עריכת הצעת מחיר ושמירה כגרסה עוקבת." },
    ],
  }),
  component: EditQuote,
});

type Form = {
  customerName: string;
  customerRef: string;
  shipmentKind: string;
  incoterm: string;
  originPort: string;
  destPort: string;
  departDate: string;
  arriveDate: string;
  agent: string;
  airline: string;
  currency: string;
  marginPct: string;
  total: string;
  pricingItems: PricingItemForm[];
  pricingNotes: string;
  dropType: DropTypeId | null;
  stops: Stop[];
};

type PricingItemForm = {
  id: string;
  desc: string;
  qty: string;
  unit: string;
  unitPrice: string;
  currency: string;
  total: string;
  note: string;
};

type PricingKey = keyof Omit<PricingItemForm, "id">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function firstText(...values: unknown[]): string {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v);
    if (s !== "" && s !== "null" && s !== "undefined") return s;
  }
  return "";
}

function makePricingRow(index: number, item?: Record<string, unknown>): PricingItemForm {
  // Support both edit-shape ({desc, qty, unitPrice, total, note}) and
  // dialog-shape ({label/group, price, sourceLabel}) when loading a quote.
  return {
    id: toText(item?.id) || `pricing-${Date.now()}-${index}`,
    desc: firstText(item?.desc, item?.label, item?.group),
    qty: firstText(item?.qty),
    unit: firstText(item?.unit),
    unitPrice: firstText(item?.unitPrice, item?.price),
    currency: firstText(item?.currency),
    total: firstText(item?.total, item?.price),
    note: firstText(item?.note, item?.sourceLabel),
  };
}

function numericOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function EditQuote() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const getQuoteFn = useServerFn(getQuote);
  const reviseFn = useServerFn(reviseQuote);
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => getQuoteFn({ data: { id } }),
  });

  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quote) return;
    const payload = isRecord(quote.payload) ? quote.payload : {};
    const pricingItems = Array.isArray(payload.pricingItems)
      ? payload.pricingItems
          .map((item, index) => (isRecord(item) ? makePricingRow(index, item) : null))
          .filter((item): item is PricingItemForm => item !== null)
      : [];

    const rawDropType = payload.dropType;
    const dropType: DropTypeId | null = isDropTypeId(rawDropType) ? rawDropType : null;
    let stops: Stop[] = [];
    if (dropType) {
      if (Array.isArray(payload.stops)) {
        stops = payload.stops
          .map((s, i) => {
            if (!isRecord(s)) return null;
            const kind = String(s.kind);
            const allowed = DROP_TYPE_SPECS[dropType].allowedKinds as string[];
            if (!allowed.includes(kind)) return null;
            const out: Stop = {
              id: toText(s.id) || `stop-${Date.now()}-${i}`,
              kind: kind as StopKind,
            };
            for (const f of DROP_TYPE_SPECS[dropType].allowedKinds.flatMap(() => [])) void f;
            const copyFields = [
              "company","address","contact","phone","plannedTime","etaAt","ataAt",
              "temperature","signature","photo","status","notes",
            ] as const;
            for (const f of copyFields) {
              const v = s[f];
              if (typeof v === "string" && v) (out as Record<string, string>)[f] = v;
            }
            return out;
          })
          .filter((s): s is Stop => s !== null);
      }
      if (stops.length === 0) stops = seedStopsForDropType(dropType);
    }

    setForm({
      customerName: quote.customer_name ?? "",
      customerRef: quote.customer_ref ?? "",
      shipmentKind: quote.shipment_kind ?? "",
      incoterm: quote.incoterm ?? "",
      originPort: quote.origin_port ?? "",
      destPort: quote.dest_port ?? "",
      departDate: quote.depart_date ?? "",
      arriveDate: quote.arrive_date ?? "",
      agent: quote.agent ?? "",
      airline: quote.airline ?? "",
      currency: quote.currency ?? "",
      marginPct: quote.margin_pct != null ? String(quote.margin_pct) : "",
      total: quote.total != null ? String(quote.total) : "",
      pricingItems,
      pricingNotes: toText(payload.pricingNotes),
      dropType,
      stops,
    });
  }, [quote]);

  function upd<K extends keyof Form>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  function updatePricingItem(id: string, key: PricingKey, value: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            pricingItems: f.pricingItems.map((item) =>
              item.id === id ? { ...item, [key]: value } : item
            ),
          }
        : f
    );
  }

  function addPricingItem() {
    setForm((f) =>
      f
        ? {
            ...f,
            pricingItems: [...f.pricingItems, makePricingRow(f.pricingItems.length)],
          }
        : f
    );
  }

  function removePricingItem(id: string) {
    setForm((f) =>
      f ? { ...f, pricingItems: f.pricingItems.filter((item) => item.id !== id) } : f
    );
  }

  function normalizedPricingItems() {
    if (!form) return [];
    return form.pricingItems
      .map((item) => ({
        id: item.id,
        desc: cleanText(item.desc),
        qty: numericOrNull(item.qty),
        unit: cleanText(item.unit),
        unitPrice: numericOrNull(item.unitPrice),
        currency: cleanText(item.currency),
        total: numericOrNull(item.total),
        note: cleanText(item.note),
      }))
      .filter((item) =>
        Boolean(
          item.desc ||
            item.qty != null ||
            item.unit ||
            item.unitPrice != null ||
            item.currency ||
            item.total != null ||
            item.note
        )
      );
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await reviseFn({
        data: {
          id,
          edits: {
            customerName: form.customerName || null,
            customerRef: form.customerRef || null,
            shipmentKind: form.shipmentKind || null,
            incoterm: form.incoterm || null,
            originPort: form.originPort || null,
            destPort: form.destPort || null,
            departDate: form.departDate || null,
            arriveDate: form.arriveDate || null,
            agent: form.agent || null,
            airline: form.airline || null,
            currency: form.currency || null,
            marginPct: form.marginPct ? Number(form.marginPct) : null,
            total: form.total ? Number(form.total) : null,
            payload: {
              pricingItems: normalizedPricingItems(),
              pricingNotes: form.pricingNotes.trim() || null,
              dropType: form.dropType,
              stops: form.dropType ? normalizeStopsForPersist(form.stops) : [],
            },
          },
        },
      });
      toast.success(`נשמרה גרסה חדשה: ${res.quote_code}`);
      navigate({ to: "/dashboard/quotes/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מסחרי · עריכת הצעה</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            עריכת {quote?.quote_code ?? "הצעה"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            השמירה תיצור הצעה חדשה עם מספר עוקב (למשל <span className="font-mono">-R2</span>).
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/dashboard/quotes/$id" params={{ id }}>
            <ArrowRight className="h-4 w-4" /> חזרה להצעה
          </Link>
        </Button>
      </div>

      {isLoading || !form ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          טוען...
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="פרטי לקוח ומשלוח">
            <Field label="שם לקוח"><Input value={form.customerName} onChange={(e) => upd("customerName", e.target.value)} /></Field>
            <Field label="Ref לקוח"><Input value={form.customerRef} onChange={(e) => upd("customerRef", e.target.value)} /></Field>
            <Field label="סוג משלוח"><Input value={form.shipmentKind} onChange={(e) => upd("shipmentKind", e.target.value)} /></Field>
            <Field label="Incoterm"><Input value={form.incoterm} onChange={(e) => upd("incoterm", e.target.value)} /></Field>
          </Section>

          <Section title="מסלול ותאריכים">
            <Field label="נמל מוצא"><AirportCombobox value={form.originPort} onChange={(v) => upd("originPort", v)} /></Field>
            <Field label="נמל יעד"><AirportCombobox value={form.destPort} onChange={(v) => upd("destPort", v)} /></Field>
            <Field label="תאריך יציאה"><Input type="date" value={form.departDate} onChange={(e) => upd("departDate", e.target.value)} /></Field>
            <Field label="תאריך הגעה"><Input type="date" value={form.arriveDate} onChange={(e) => upd("arriveDate", e.target.value)} /></Field>
            <Field label="סוכן"><Input value={form.agent} onChange={(e) => upd("agent", e.target.value)} /></Field>
            <Field label="חברת תעופה"><Input value={form.airline} onChange={(e) => upd("airline", e.target.value)} /></Field>
          </Section>

          <Section title="פיננסי">
            <Field label="מטבע"><Input value={form.currency} onChange={(e) => upd("currency", e.target.value)} /></Field>
            <Field label="אחוז רווח"><Input type="number" value={form.marginPct} onChange={(e) => upd("marginPct", e.target.value)} /></Field>
            <Field label='סה"כ'><Input type="number" value={form.total} onChange={(e) => upd("total", e.target.value)} /></Field>
          </Section>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">משלוחי דרופ (Drop Type)</div>
              <select
                value={form.dropType ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = isDropTypeId(v) ? v : null;
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          dropType: next,
                          stops: next ? seedStopsForDropType(next) : [],
                        }
                      : f
                  );
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— ללא —</option>
                {Object.keys(DROP_TYPE_SPECS).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {form.dropType ? (
              <>
                <div className="mb-3 text-xs text-muted-foreground">
                  {DROP_TYPE_SPECS[form.dropType].desc}
                </div>
                <StopsEditor
                  dropType={form.dropType}
                  stops={form.stops}
                  onChange={(stops) => setForm((f) => (f ? { ...f, stops } : f))}
                />
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                בחר סוג דרופ כדי להגדיר תחנות.
              </div>
            )}
          </div>


          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">תמחור</div>
              <Button type="button" variant="outline" size="sm" onClick={addPricingItem} className="gap-2">
                <Plus className="h-4 w-4" /> הוסף שורת תמחור
              </Button>
            </div>

            {form.pricingItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">תיאור</th>
                      <th className="px-3 py-2 text-right font-medium">כמות</th>
                      <th className="px-3 py-2 text-right font-medium">יחידה</th>
                      <th className="px-3 py-2 text-right font-medium">מחיר יח'</th>
                      <th className="px-3 py-2 text-right font-medium">מטבע</th>
                      <th className="px-3 py-2 text-right font-medium">סה"כ</th>
                      <th className="px-3 py-2 text-right font-medium">הערה</th>
                      <th className="w-12 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.pricingItems.map((item) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-2 py-2">
                          <Input value={item.desc} onChange={(e) => updatePricingItem(item.id, "desc", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" value={item.qty} onChange={(e) => updatePricingItem(item.id, "qty", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input value={item.unit} onChange={(e) => updatePricingItem(item.id, "unit", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" value={item.unitPrice} onChange={(e) => updatePricingItem(item.id, "unitPrice", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input value={item.currency} onChange={(e) => updatePricingItem(item.id, "currency", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input type="number" value={item.total} onChange={(e) => updatePricingItem(item.id, "total", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Input value={item.note} onChange={(e) => updatePricingItem(item.id, "note", e.target.value)} />
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePricingItem(item.id)}
                            aria-label="מחק שורת תמחור"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                אין עדיין שורות תמחור להצעה הזו.
              </div>
            )}

            <div className="mt-4 max-w-2xl space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות תמחור</Label>
              <Input value={form.pricingNotes} onChange={(e) => upd("pricingNotes", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/quotes/$id" params={{ id }}>ביטול</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "שומר..." : "שמור כגרסה עוקבת"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
