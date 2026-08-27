import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, FileDown, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getQuote, reviseQuote } from "@/lib/quotes.functions";
import { toast } from "sonner";
import { AirportCombobox } from "@/components/airport-combobox";
import { Lookup } from "@/components/lookup";
import {
  StopsEditor,
  PackQtyStepper,
  LoggerPicker,
  TEMP_SERIES,
  COOLGUARD_MODELS,
  BIOTHERM_MODELS,
  CARGO_TYPES,
  ATTR_OPTIONS,
  SERVICE_LIST,
  makePackageRow,
  getPackageCalc,
  getPackModelCalc,
  type CargoType,
  type TempSeriesKey,
  type PackSelection,
  type PackageRow,
  type AttrKey,
  type PricingItem,
  type PriceSource,
} from "@/components/new-quote-dialog";
import { SHIPMENT_TYPE_TAGS } from "@/lib/shipment-type-tags";
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
      { title: "עריכת הצעה — AFIK Logistics Platform" },
      { name: "description", content: "עריכת הצעת מחיר ושמירה כגרסה עוקבת." },
    ],
  }),
  component: EditQuote,
});

// Keep in sync with SHIPMENT_KIND_LABEL in quote-document.tsx — this is the
// wizard's top-level shipment kind (export/import/domestic/distribution),
// a fixed enum. It is NOT a "shipment_types" lookup code; the edit page used
// to bind this field to the shipment_types Lookup by mistake, which meant it
// always rendered empty since a value like "export" never matches a lookup
// code in that table.
const SHIPMENT_KIND_LABEL: Record<string, string> = {
  export: "ייצוא",
  import: "יבוא",
  domestic: "מקומי",
  distribution: "דיסטריביושן",
};

type ContactForm = { name: string; phone: string; email: string };

function emptyContact(): ContactForm {
  return { name: "", phone: "", email: "" };
}

function parseContacts(raw: unknown): ContactForm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => (isRecord(c) ? c : null))
    .filter((c): c is Record<string, unknown> => c !== null)
    .map((c) => ({ name: toText(c.name), phone: toText(c.phone), email: toText(c.email) }));
}

type Form = {
  customerName: string;
  customerRef: string;
  shipmentKind: string;
  shipmentTypeTags: string[];
  incoterm: string;
  originPort: string;
  destPort: string;
  transitPorts: string[];
  pickupAddress: string;
  deliveryAddress: string;
  pickupContacts: ContactForm[];
  deliveryContacts: ContactForm[];
  departDate: string;
  arriveDate: string;
  agent: string;
  airline: string;
  currency: string;
  marginPct: string;
  total: string;
  pricingItems: PricingItem[];
  pricingNotes: string;
  dropType: DropTypeId | null;
  stops: Stop[];
  cargoType: CargoType | null;
  attrs: Record<AttrKey, boolean>;
  tempSeriesList: TempSeriesKey[];
  tempSeriesNone: boolean;
  packages: PackageRow[];
  packSelections: PackSelection[];
  services: Record<string, boolean>;
  routeApproved: boolean;
  logisticsNotes: string;
  specialReq: string;
  extraNotes: string;
};

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

// Real pricing-item shape (see PricingItem in new-quote-dialog.tsx): group,
// label, source, sourceLabel, sourceDate, currency, price. The edit page used
// to remap this into an unrelated {desc, qty, unit, unitPrice, note} shape
// left over from an older design — that lost the group/source/sourceLabel
// fields on every save (silently overwriting payload.pricingItems with the
// wrong shape) and showed empty "כמות"/"יחידה" columns that don't exist in
// the real model. This reads both the current shape and that older shape
// defensively, but always writes back the real one.
const VALID_PRICE_SOURCES: PriceSource[] = ["pricelist", "rfq", "manual", "missing"];
function parsePriceSource(raw: unknown): PriceSource {
  return typeof raw === "string" && (VALID_PRICE_SOURCES as string[]).includes(raw)
    ? (raw as PriceSource)
    : "manual";
}

const VALID_ITEM_CURRENCIES = ["USD", "EUR", "ILS"] as const;
type ItemCurrency = (typeof VALID_ITEM_CURRENCIES)[number];
function parseItemCurrency(raw: unknown, fallback: ItemCurrency): ItemCurrency {
  return typeof raw === "string" && (VALID_ITEM_CURRENCIES as readonly string[]).includes(raw)
    ? (raw as ItemCurrency)
    : fallback;
}

function makePricingRow(
  index: number,
  item: Record<string, unknown> | undefined,
  fallbackCurrency: ItemCurrency,
): PricingItem {
  const label = firstText(item?.label, item?.group, item?.desc) || "פריט";
  return {
    id: toText(item?.id) || `pricing-${Date.now()}-${index}`,
    group: firstText(item?.group, item?.label, item?.desc) || label,
    label,
    source: parsePriceSource(item?.source),
    sourceLabel: firstText(item?.sourceLabel, item?.note),
    sourceDate: firstText(item?.sourceDate),
    currency: parseItemCurrency(item?.currency, fallbackCurrency),
    price: Number(firstText(item?.price, item?.unitPrice, item?.total)) || 0,
  };
}

const VALID_CARGO_TYPES: CargoType[] = [
  "general",
  "temperature",
  "nfo",
  "live",
  "dangerous",
  "other",
];
function parseCargoType(raw: unknown): CargoType | null {
  return typeof raw === "string" && (VALID_CARGO_TYPES as string[]).includes(raw)
    ? (raw as CargoType)
    : null;
}

const VALID_TEMP_KEYS: TempSeriesKey[] = TEMP_SERIES.map((t) => t.key);
function parseTempSeriesList(raw: unknown): TempSeriesKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (k): k is TempSeriesKey => typeof k === "string" && (VALID_TEMP_KEYS as string[]).includes(k),
  );
}

function parsePackSelections(raw: unknown): PackSelection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (isRecord(s) ? s : null))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s): PackSelection => ({
      key: toText(s.key),
      qty: Number(s.qty) || 0,
      // These three used to be dropped on load (and so effectively wiped
      // on the next save): product weight, an attached logger, and the
      // Deep Frozen dry-ice replenishment qty for that specific model.
      productWeight: s.productWeight != null ? Number(s.productWeight) || 0 : undefined,
      loggerId: typeof s.loggerId === "string" ? s.loggerId : null,
      dryIceQty: s.dryIceQty != null ? Number(s.dryIceQty) || 0 : undefined,
    }))
    .filter((s) => s.key && s.qty > 0);
}

function emptyAttrs(): Record<AttrKey, boolean> {
  return Object.fromEntries(ATTR_OPTIONS.map((a) => [a.id, false])) as Record<AttrKey, boolean>;
}

function parseAttrs(raw: unknown): Record<AttrKey, boolean> {
  const base = emptyAttrs();
  if (!isRecord(raw)) return base;
  for (const a of ATTR_OPTIONS) {
    const v = raw[a.id];
    if (v === true || v === "true") base[a.id] = true;
  }
  return base;
}

function parseServices(raw: unknown): Record<string, boolean> {
  const base: Record<string, boolean> = Object.fromEntries(SERVICE_LIST.map((s) => [s.id, false]));
  if (!isRecord(raw)) return base;
  for (const s of SERVICE_LIST) {
    const v = raw[s.id];
    if (v === true || v === "true") base[s.id] = true;
  }
  return base;
}

function parsePackages(raw: unknown): PackageRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [makePackageRow()];
  const rows = raw
    .map((p) => (isRecord(p) ? p : null))
    .filter((p): p is Record<string, unknown> => p !== null)
    .map((p): PackageRow => {
      const customDims = isRecord(p.customDims) ? p.customDims : null;
      const tempSeries =
        typeof p.tempSeries === "string" && (VALID_TEMP_KEYS as string[]).includes(p.tempSeries)
          ? (p.tempSeries as TempSeriesKey)
          : null;
      return {
        ...makePackageRow(),
        pallet: typeof p.pallet === "string" ? p.pallet : null,
        customLength: toText(customDims?.length),
        customWidth: toText(customDims?.width),
        customHeight: toText(customDims?.height),
        unitWeight: toText(p.unitWeight) || "1",
        unitQty: toText(p.unitQty),
        // These two used to be dropped both on load (always defaulting to
        // null/none here) and on save (stripped from the payload before
        // insert) — editing and saving any quote silently erased whichever
        // per-package temperature/logger the rep had picked in the wizard.
        tempSeries,
        loggerId: typeof p.loggerId === "string" ? p.loggerId : null,
      };
    });
  return rows.length > 0 ? rows : [makePackageRow()];
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => toText(v)).filter(Boolean);
}

const VALID_SHIPMENT_TAGS = SHIPMENT_TYPE_TAGS.map((t) => t.value);
function parseShipmentTypeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && VALID_SHIPMENT_TAGS.includes(v));
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
  const [originalPayload, setOriginalPayload] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!quote) return;
    const payload = isRecord(quote.payload) ? quote.payload : {};
    const fallbackCurrency = parseItemCurrency(quote.currency, "USD");
    const pricingItems = Array.isArray(payload.pricingItems)
      ? payload.pricingItems
          .map((item, index) =>
            isRecord(item) ? makePricingRow(index, item, fallbackCurrency) : null,
          )
          .filter((item): item is PricingItem => item !== null)
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
              "company",
              "address",
              "contact",
              "phone",
              "plannedTime",
              "etaAt",
              "ataAt",
              "temperature",
              "signature",
              "photo",
              "status",
              "notes",
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

    setOriginalPayload(payload);
    setForm({
      customerName: quote.customer_name ?? "",
      customerRef: quote.customer_ref ?? "",
      shipmentKind: quote.shipment_kind ?? "",
      shipmentTypeTags: parseShipmentTypeTags(payload.shipmentTypeTags),
      incoterm: quote.incoterm ?? "",
      originPort: quote.origin_port ?? "",
      destPort: quote.dest_port ?? "",
      transitPorts: parseStringList(quote.transit_ports),
      pickupAddress: toText(payload.pickupAddress),
      deliveryAddress: toText(payload.deliveryAddress),
      pickupContacts: parseContacts(payload.pickupContacts),
      deliveryContacts: parseContacts(payload.deliveryContacts),
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
      cargoType: parseCargoType(payload.cargoType),
      attrs: parseAttrs(payload.attrs),
      tempSeriesList: parseTempSeriesList(payload.tempSeriesList),
      tempSeriesNone: payload.tempSeriesNone === true,
      packages: parsePackages(payload.packages),
      packSelections: parsePackSelections(payload.packSelections),
      services:
        quote.shipment_kind === "domestic"
          ? {
              ...parseServices(payload.services),
              pickup: true,
              land: true,
              delivery: true,
              insurance: false,
            }
          : parseServices(payload.services),
      routeApproved: payload.routeApproved === true,
      logisticsNotes: toText(payload.logisticsNotes),
      specialReq: toText(payload.specialReq),
      extraNotes: toText(payload.extraNotes),
    });
  }, [quote]);

  function upd<K extends keyof Form>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  function updatePricingItem<K extends keyof PricingItem>(
    id: string,
    key: K,
    value: PricingItem[K],
  ) {
    setForm((f) =>
      f
        ? {
            ...f,
            pricingItems: f.pricingItems.map((item) =>
              item.id === id ? { ...item, [key]: value } : item,
            ),
          }
        : f,
    );
  }

  function addPricingItem() {
    setForm((f) =>
      f
        ? {
            ...f,
            pricingItems: [
              ...f.pricingItems,
              makePricingRow(
                f.pricingItems.length,
                undefined,
                parseItemCurrency(f.currency, "USD"),
              ),
            ],
          }
        : f,
    );
  }

  function removePricingItem(id: string) {
    setForm((f) =>
      f ? { ...f, pricingItems: f.pricingItems.filter((item) => item.id !== id) } : f,
    );
  }

  function toggleShipmentTag(value: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            shipmentTypeTags: f.shipmentTypeTags.includes(value)
              ? f.shipmentTypeTags.filter((t) => t !== value)
              : [...f.shipmentTypeTags, value],
          }
        : f,
    );
  }

  function updateTransitPort(index: number, value: string) {
    setForm((f) =>
      f ? { ...f, transitPorts: f.transitPorts.map((p, i) => (i === index ? value : p)) } : f,
    );
  }

  function addTransitPort() {
    setForm((f) => (f ? { ...f, transitPorts: [...f.transitPorts, ""] } : f));
  }

  function removeTransitPort(index: number) {
    setForm((f) => (f ? { ...f, transitPorts: f.transitPorts.filter((_, i) => i !== index) } : f));
  }

  function updateContact(
    list: "pickupContacts" | "deliveryContacts",
    index: number,
    patch: Partial<ContactForm>,
  ) {
    setForm((f) =>
      f ? { ...f, [list]: f[list].map((c, i) => (i === index ? { ...c, ...patch } : c)) } : f,
    );
  }

  function addContact(list: "pickupContacts" | "deliveryContacts") {
    setForm((f) => (f ? { ...f, [list]: [...f[list], emptyContact()] } : f));
  }

  function removeContact(list: "pickupContacts" | "deliveryContacts", index: number) {
    setForm((f) => (f ? { ...f, [list]: f[list].filter((_, i) => i !== index) } : f));
  }

  function updatePackage(id: string, patch: Partial<PackageRow>) {
    setForm((f) =>
      f ? { ...f, packages: f.packages.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : f,
    );
  }

  function addPackage() {
    setForm((f) => (f ? { ...f, packages: [...f.packages, makePackageRow()] } : f));
  }

  function removePackage(id: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            packages: f.packages.length > 1 ? f.packages.filter((r) => r.id !== id) : f.packages,
          }
        : f,
    );
  }

  function getPackQty(key: string) {
    return form?.packSelections.find((s) => s.key === key)?.qty ?? 0;
  }

  function setPackQty(key: string, qty: number) {
    setForm((f) => {
      if (!f) return f;
      if (qty <= 0) return { ...f, packSelections: f.packSelections.filter((s) => s.key !== key) };
      const exists = f.packSelections.some((s) => s.key === key);
      return {
        ...f,
        packSelections: exists
          ? f.packSelections.map((s) => (s.key === key ? { ...s, qty } : s))
          : [...f.packSelections, { key, qty }],
      };
    });
  }

  // The catalog packaging table (CoolGuard/BioTherm) carries three more
  // per-model fields beyond quantity — product weight, an attached
  // temperature logger, and (Deep Frozen only) dry-ice replenishment qty.
  // The edit page only ever read/wrote qty, so opening a quote for edit and
  // saving it silently dropped whichever logger/product weight/dry-ice the
  // rep had entered in the wizard, and the table looked stripped-down next
  // to what was actually defined on the quote.
  function getPackProductWeight(key: string) {
    return form?.packSelections.find((s) => s.key === key)?.productWeight ?? "";
  }
  function setPackProductWeight(key: string, productWeight: number) {
    setForm((f) =>
      f
        ? {
            ...f,
            packSelections: f.packSelections.map((s) =>
              s.key === key ? { ...s, productWeight } : s,
            ),
          }
        : f,
    );
  }
  function getPackLogger(key: string) {
    return form?.packSelections.find((s) => s.key === key)?.loggerId ?? null;
  }
  function setPackLogger(key: string, loggerId: string | null) {
    setForm((f) =>
      f
        ? {
            ...f,
            packSelections: f.packSelections.map((s) => (s.key === key ? { ...s, loggerId } : s)),
          }
        : f,
    );
  }
  function getPackDryIceQty(key: string) {
    return form?.packSelections.find((s) => s.key === key)?.dryIceQty ?? "";
  }
  function setPackDryIceQty(key: string, dryIceQty: number) {
    setForm((f) =>
      f
        ? {
            ...f,
            packSelections: f.packSelections.map((s) => (s.key === key ? { ...s, dryIceQty } : s)),
          }
        : f,
    );
  }

  function toggleTempSeriesNone() {
    setForm((f) =>
      f ? { ...f, tempSeriesNone: true, tempSeriesList: [], packSelections: [] } : f,
    );
  }

  function toggleTempSeries(key: TempSeriesKey) {
    setForm((f) => {
      if (!f) return f;
      const next = f.tempSeriesList.includes(key)
        ? f.tempSeriesList.filter((k) => k !== key)
        : [...f.tempSeriesList, key];
      return {
        ...f,
        tempSeriesNone: false,
        tempSeriesList: next,
        packSelections: f.packSelections.filter((s) => next.some((k) => s.key.startsWith(`${k}:`))),
      };
    });
  }

  function toggleAttr(id: AttrKey) {
    setForm((f) => (f ? { ...f, attrs: { ...f.attrs, [id]: !f.attrs[id] } } : f));
  }

  function toggleService(id: string) {
    setForm((f) => (f ? { ...f, services: { ...f.services, [id]: !f.services[id] } } : f));
  }

  // Always keep group === label (same convention used everywhere else this
  // shape appears — DEFAULT_PRICING_ITEMS, the wizard's addRow) and drop
  // fully-blank manual rows that were added and then never filled in.
  function normalizedPricingItems(): PricingItem[] {
    if (!form) return [];
    return form.pricingItems
      .map((item) => {
        const label = item.label.trim() || "פריט";
        return { ...item, label, group: label };
      })
      .filter(
        (item) => item.label !== "פריט" || item.price !== 0 || item.sourceLabel.trim() !== "",
      );
  }

  const packageCalcs = useMemo(
    () => (form ? form.packages.map((pkg) => getPackageCalc(pkg)) : []),
    [form?.packages],
  );
  const packModelCalcs = useMemo(
    () =>
      form
        ? form.packSelections.map((sel) => getPackModelCalc(sel, form.shipmentKind === "import"))
        : [],
    [form?.packSelections, form?.shipmentKind],
  );
  const packageTotals = useMemo(() => {
    const grossWeight =
      packageCalcs.reduce((s, c) => s + c.grossWeight, 0) +
      packModelCalcs.reduce((s, c) => s + c.grossWeight, 0);
    const volumetricWeight =
      packageCalcs.reduce((s, c) => s + c.volumetricWeight, 0) +
      packModelCalcs.reduce((s, c) => s + c.volumetricWeight, 0);
    return {
      grossWeight,
      volumetricWeight,
      chargeableWeight: Math.max(grossWeight, volumetricWeight),
    };
  }, [packageCalcs, packModelCalcs]);

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
            transitPorts: form.transitPorts.map((p) => p.trim()).filter(Boolean),
            departDate: form.departDate || null,
            arriveDate: form.arriveDate || null,
            agent: form.agent || null,
            airline: form.airline || null,
            currency: form.currency || null,
            marginPct: form.marginPct ? Number(form.marginPct) : null,
            total: form.total ? Number(form.total) : null,
            payload: {
              ...originalPayload,
              shipmentTypeTags: form.shipmentTypeTags,
              pickupAddress: form.pickupAddress.trim() || null,
              deliveryAddress: form.deliveryAddress.trim() || null,
              pickupContacts: form.pickupContacts.filter((c) => c.name || c.phone || c.email),
              deliveryContacts: form.deliveryContacts.filter((c) => c.name || c.phone || c.email),
              pricingItems: normalizedPricingItems(),
              pricingNotes: form.pricingNotes.trim() || null,
              dropType: form.dropType,
              stops: form.dropType ? normalizeStopsForPersist(form.stops) : [],
              cargoType: form.cargoType,
              attrs: form.attrs,
              tempSeriesList: form.tempSeriesList,
              tempSeriesNone: form.tempSeriesNone,
              packSelections: form.packSelections,
              services:
                form.shipmentKind === "domestic"
                  ? { ...form.services, pickup: true, land: true, delivery: true, insurance: false }
                  : form.services,
              routeApproved: form.routeApproved,
              logisticsNotes: form.logisticsNotes.trim() || null,
              specialReq: form.specialReq.trim() || null,
              extraNotes: form.extraNotes.trim() || null,
              packages: form.packages.map((pkg) => ({
                pallet: pkg.pallet,
                customDims:
                  pkg.pallet === "custom"
                    ? { length: pkg.customLength, width: pkg.customWidth, height: pkg.customHeight }
                    : null,
                unitWeight: pkg.unitWeight,
                unitQty: pkg.unitQty,
                tempSeries: pkg.tempSeries,
                loggerId: pkg.loggerId,
              })),
              weightSummary: {
                grossWeight: packageTotals.grossWeight,
                volumetricWeight: packageTotals.volumetricWeight,
                chargeableWeight: packageTotals.chargeableWeight,
              },
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
            <Field label="שם לקוח">
              <Input
                value={form.customerName}
                onChange={(e) => upd("customerName", e.target.value)}
              />
            </Field>
            <Field label="Ref לקוח">
              <Input
                value={form.customerRef}
                onChange={(e) => upd("customerRef", e.target.value)}
              />
            </Field>
            <Field label="סוג משלוח">
              {/* This is the wizard's top-level export/import/domestic/distribution
                  choice — a fixed enum, not a shipment_types lookup code. Binding it
                  to the Lookup component (as before) meant it always rendered empty,
                  since a value like "export" never matches a code in that table. */}
              <select
                value={form.shipmentKind}
                onChange={(e) => upd("shipmentKind", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— בחר —</option>
                {Object.entries(SHIPMENT_KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Incoterm">
              <Lookup
                type="incoterms"
                matchBy="code"
                value={form.incoterm || null}
                onChange={(item) => upd("incoterm", item?.code ?? "")}
                placeholder="בחר Incoterm..."
              />
            </Field>
          </Section>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold">תגית סוג משלוח</div>
            <div className="flex flex-wrap gap-2">
              {SHIPMENT_TYPE_TAGS.map((t) => {
                const active = form.shipmentTypeTags.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleShipmentTag(t.value)}
                    dir="ltr"
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active ? "border-primary ring-2 ring-primary/20" : "hover:bg-muted",
                    )}
                    style={
                      active ? { backgroundColor: t.bg, color: t.fg, borderColor: t.bg } : undefined
                    }
                  >
                    {t.value}
                  </button>
                );
              })}
            </div>
          </div>

          {form.shipmentKind !== "domestic" && (
            <Section title="מסלול ותאריכים">
              <Field label="נמל מוצא">
                <AirportCombobox value={form.originPort} onChange={(v) => upd("originPort", v)} />
              </Field>
              <Field label="נמל יעד">
                <AirportCombobox value={form.destPort} onChange={(v) => upd("destPort", v)} />
              </Field>
              <Field label="תאריך יציאה">
                <Input
                  type="date"
                  value={form.departDate}
                  onChange={(e) => upd("departDate", e.target.value)}
                />
              </Field>
              <Field label="תאריך הגעה">
                <Input
                  type="date"
                  value={form.arriveDate}
                  onChange={(e) => upd("arriveDate", e.target.value)}
                />
              </Field>
              <Field label="סוכן">
                <Lookup
                  type="agents"
                  matchBy="code"
                  value={form.agent || null}
                  onChange={(item) => upd("agent", item?.code ?? "")}
                  placeholder="בחר סוכן..."
                />
              </Field>
              <Field label="חברת תעופה">
                {/* Free text, not a Lookup: the wizard only lets the rep pick an
                    airline via lookup code for import shipments — everywhere else
                    it stores whatever string was in the field (e.g. the default
                    "Lufthansa Cargo"), which isn't a lookup code and would never
                    match here, always rendering as an empty placeholder. */}
                <Input
                  value={form.airline}
                  onChange={(e) => upd("airline", e.target.value)}
                  placeholder="שם חברת התעופה"
                />
              </Field>
            </Section>
          )}

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">נמלי מעבר (Transit)</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTransitPort}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> הוסף נמל מעבר
              </Button>
            </div>
            {form.transitPorts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                משלוח ישיר — ללא נמלי מעבר.
              </div>
            ) : (
              <div className="space-y-2">
                {form.transitPorts.map((port, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <AirportCombobox value={port} onChange={(v) => updateTransitPort(i, v)} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTransitPort(i)}
                      aria-label="הסר נמל מעבר"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold">כתובות ואנשי קשר</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ContactBlock
                title="איסוף"
                address={form.pickupAddress}
                onAddressChange={(v) => upd("pickupAddress", v)}
                contacts={form.pickupContacts}
                onAdd={() => addContact("pickupContacts")}
                onUpdate={(i, patch) => updateContact("pickupContacts", i, patch)}
                onRemove={(i) => removeContact("pickupContacts", i)}
              />
              <ContactBlock
                title="מסירה"
                address={form.deliveryAddress}
                onAddressChange={(v) => upd("deliveryAddress", v)}
                contacts={form.deliveryContacts}
                onAdd={() => addContact("deliveryContacts")}
                onUpdate={(i, patch) => updateContact("deliveryContacts", i, patch)}
                onRemove={(i) => removeContact("deliveryContacts", i)}
              />
            </div>
          </div>

          <Section title="פיננסי">
            <Field label="מטבע">
              <Lookup
                type="currencies"
                matchBy="code"
                value={form.currency || null}
                onChange={(item) => upd("currency", item?.code ?? "")}
                placeholder="בחר מטבע..."
              />
            </Field>
            <Field label="אחוז רווח">
              <Input
                type="number"
                value={form.marginPct}
                onChange={(e) => upd("marginPct", e.target.value)}
              />
            </Field>
            <Field label='סה"כ'>
              <Input
                type="number"
                value={form.total}
                onChange={(e) => upd("total", e.target.value)}
              />
            </Field>
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
                      : f,
                  );
                }}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— ללא —</option>
                {Object.keys(DROP_TYPE_SPECS).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
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
              <div className="text-sm font-semibold">מארזים ומשטחים</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPackage}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> הוסף חבילה
              </Button>
            </div>

            <div className="space-y-3">
              {form.packages.map((pkg) => {
                const calc = getPackageCalc(pkg);
                return (
                  <div key={pkg.id} className="rounded-lg border p-3">
                    {/* The wizard only offers manual L/W/H entry per package
                        now (no preset pallet sizes) — pkg.pallet is always
                        "custom" in real data, so there's no dropdown here. */}
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Field label="אורך (ס״מ)">
                        <Input
                          type="number"
                          value={pkg.customLength}
                          onChange={(e) => updatePackage(pkg.id, { customLength: e.target.value })}
                        />
                      </Field>
                      <Field label="רוחב (ס״מ)">
                        <Input
                          type="number"
                          value={pkg.customWidth}
                          onChange={(e) => updatePackage(pkg.id, { customWidth: e.target.value })}
                        />
                      </Field>
                      <Field label="גובה (ס״מ)">
                        <Input
                          type="number"
                          value={pkg.customHeight}
                          onChange={(e) => updatePackage(pkg.id, { customHeight: e.target.value })}
                        />
                      </Field>
                      <Field label="משקל יח' (ק״ג)">
                        <Input
                          type="number"
                          value={pkg.unitWeight}
                          onChange={(e) => updatePackage(pkg.id, { unitWeight: e.target.value })}
                        />
                      </Field>
                      <Field label="כמות">
                        <Input
                          type="number"
                          value={pkg.unitQty}
                          onChange={(e) => updatePackage(pkg.id, { unitQty: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">
                        טמפרטורת משלוח לחבילה זו
                      </Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {TEMP_SERIES.map((s) => {
                          const active = pkg.tempSeries === s.key;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() =>
                                updatePackage(pkg.id, { tempSeries: active ? null : s.key })
                              }
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-muted/40",
                              )}
                            >
                              {s.icon} {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {pkg.tempSeries === "deepFrozen" && (
                      <div className="mt-3 max-w-xs">
                        <Field label="קרח יבש ליחידה (ק״ג)">
                          <Input
                            type="number"
                            value={pkg.dryIceQty}
                            onChange={(e) => updatePackage(pkg.id, { dryIceQty: e.target.value })}
                          />
                        </Field>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          רשם טמפרטורה לחבילה זו
                        </Label>
                        <div className="mt-1.5">
                          <LoggerPicker
                            value={pkg.loggerId}
                            onChange={(loggerId) => updatePackage(pkg.id, { loggerId })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {calc.grossWeight > 0 && (
                            <div>משקל: {calc.grossWeight.toFixed(1)} ק״ג</div>
                          )}
                          {calc.volumetricWeight > 0 && (
                            <div>נפחי: {calc.volumetricWeight.toFixed(1)} ק״ג</div>
                          )}
                        </div>
                        {form.packages.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removePackage(pkg.id)}
                            aria-label="מחק חבילה"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="mb-3 text-sm font-semibold">סדרת טמפרטורה ואריזה</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleTempSeriesNone}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                    (form.tempSeriesNone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted")
                  }
                >
                  ללא בקרת טמפרטורה
                </button>
                {TEMP_SERIES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTempSeries(t.key)}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                      (form.tempSeriesList.includes(t.key)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted")
                    }
                  >
                    {t.icon} {t.label} <span className="opacity-70">({t.range})</span>
                  </button>
                ))}
              </div>

              {form.tempSeriesList.map((series) => {
                const seriesMeta = TEMP_SERIES.find((t) => t.key === series);
                const isBio = series === "deepFrozen";
                return (
                  <div key={series} className="mt-4">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      {seriesMeta?.icon} {seriesMeta?.label} — קטלוג{" "}
                      {isBio ? "BioTherm" : "CoolGuard"}
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="w-28 px-2 py-2 text-center font-medium">כמות</th>
                            <th className="px-3 py-2 text-right font-medium">דגם</th>
                            <th className="px-3 py-2 text-right font-medium">
                              {isBio ? "קטגוריה / משך" : "משקל נפחי ליח'"}
                            </th>
                            <th className="w-28 px-3 py-2 text-right font-medium">
                              משקל מוצר (ק״ג)
                            </th>
                            {isBio && (
                              <th className="w-24 px-3 py-2 text-right font-medium">
                                קרח יבש (ק״ג)
                              </th>
                            )}
                            <th className="w-44 px-3 py-2 text-right font-medium">רשם טמפרטורה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isBio ? BIOTHERM_MODELS : COOLGUARD_MODELS).map((m) => {
                            const key = `${series}:${m.model}`;
                            const qty = getPackQty(key);
                            const productWeight = getPackProductWeight(key);
                            const dryIceQty = getPackDryIceQty(key);
                            const unitCalc = getPackModelCalc({ key, qty: 1 });
                            return (
                              <tr key={key} className={cn("border-t", qty > 0 && "bg-primary/5")}>
                                <td className="px-2 py-2">
                                  <PackQtyStepper
                                    value={qty}
                                    onChange={(v) => setPackQty(key, v)}
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium">{m.model}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {isBio
                                    ? `${(m as { category: string }).category} · ${(m as { duration: string }).duration}`
                                    : unitCalc.volumetricWeight
                                      ? `${unitCalc.volumetricWeight.toFixed(1)} ק״ג`
                                      : ""}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    disabled={qty === 0}
                                    value={productWeight}
                                    onChange={(e) =>
                                      setPackProductWeight(key, Number(e.target.value) || 0)
                                    }
                                    className="w-20 rounded border bg-background px-2 py-1 text-sm disabled:opacity-40"
                                  />
                                </td>
                                {isBio && (
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      disabled={qty === 0}
                                      value={dryIceQty}
                                      onChange={(e) =>
                                        setPackDryIceQty(key, Number(e.target.value) || 0)
                                      }
                                      className="w-20 rounded border bg-background px-2 py-1 text-sm disabled:opacity-40"
                                    />
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  {qty > 0 && (
                                    <LoggerPicker
                                      value={getPackLogger(key)}
                                      onChange={(id) => setPackLogger(key, id)}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-4 rounded-lg border bg-muted/30 p-3 text-sm">
              <div>
                משקל ברוטו:{" "}
                <span className="font-semibold">
                  {packageTotals.grossWeight > 0 ? packageTotals.grossWeight.toFixed(1) : "—"} ק״ג
                </span>
              </div>
              <div>
                משקל נפחי:{" "}
                <span className="font-semibold">
                  {packageTotals.volumetricWeight > 0
                    ? packageTotals.volumetricWeight.toFixed(1)
                    : "—"}{" "}
                  ק״ג
                </span>
              </div>
              <div>
                משקל לחיוב:{" "}
                <span className="font-semibold">
                  {packageTotals.chargeableWeight > 0
                    ? packageTotals.chargeableWeight.toFixed(1)
                    : "—"}{" "}
                  ק״ג
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold">לוגיסטיקה</div>

            <div className="mb-4">
              <div className="mb-2 text-xs text-muted-foreground">שירותים כלולים</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SERVICE_LIST.filter(
                  (s) =>
                    form.shipmentKind !== "domestic" ||
                    !["air", "exportCustoms", "importCustoms", "clearance"].includes(s.id),
                ).map((s) => {
                  const on = !!form.services[s.id];
                  const locked = form.shipmentKind === "domestic";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleService(s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-xs transition",
                        on
                          ? "border-primary bg-primary/5"
                          : "text-muted-foreground hover:bg-muted/30",
                        locked && "cursor-default opacity-90 hover:bg-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          on ? "border-primary bg-primary" : "border-muted-foreground/30",
                        )}
                      >
                        {on && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="flex-1">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={form.routeApproved}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, routeApproved: e.target.checked } : f))
                }
                className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
              />
              <span>אישרתי את המסלול המוצע</span>
            </label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות תכנון לוגיסטי</Label>
              <Textarea
                value={form.logisticsNotes}
                onChange={(e) => setForm((f) => (f ? { ...f, logisticsNotes: e.target.value } : f))}
                rows={3}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">תמחור</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPricingItem}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> הוסף שורת תמחור
              </Button>
            </div>

            {form.pricingItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">תיאור</th>
                      <th className="px-3 py-2 text-right font-medium">מקור</th>
                      <th className="px-3 py-2 text-right font-medium">פרטי מקור</th>
                      <th className="px-3 py-2 text-right font-medium">תאריך</th>
                      <th className="px-3 py-2 text-right font-medium">סכום</th>
                      <th className="px-3 py-2 text-right font-medium">מטבע</th>
                      <th className="w-12 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.pricingItems.map((item) => (
                      <tr key={item.id} className="border-t align-top">
                        <td className="px-2 py-2">
                          <Input
                            value={item.label}
                            onChange={(e) => updatePricingItem(item.id, "label", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={item.source}
                            onChange={(e) =>
                              updatePricingItem(item.id, "source", e.target.value as PriceSource)
                            }
                            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                          >
                            <option value="pricelist">Price List</option>
                            <option value="rfq">RFQ</option>
                            <option value="manual">ידני</option>
                            <option value="missing">חסר מקור</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.sourceLabel}
                            onChange={(e) =>
                              updatePricingItem(item.id, "sourceLabel", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="date"
                            value={item.sourceDate}
                            onChange={(e) =>
                              updatePricingItem(item.id, "sourceDate", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.price === 0 ? "" : item.price}
                            onChange={(e) =>
                              updatePricingItem(item.id, "price", Number(e.target.value) || 0)
                            }
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={item.currency}
                            onChange={(e) =>
                              updatePricingItem(
                                item.id,
                                "currency",
                                e.target.value as "USD" | "EUR" | "ILS",
                              )
                            }
                            className="h-9 rounded-md border bg-background px-2 text-xs"
                          >
                            <option>USD</option>
                            <option>EUR</option>
                            <option>ILS</option>
                          </select>
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
                  <tfoot>
                    {Object.entries(
                      form.pricingItems.reduce<Record<string, number>>((acc, it) => {
                        acc[it.currency] = (acc[it.currency] || 0) + (Number(it.price) || 0);
                        return acc;
                      }, {}),
                    ).map(([cur, sum]) => (
                      <tr key={cur} className="border-t bg-muted/30 font-semibold">
                        <td className="px-3 py-2" colSpan={4}>{`סה"כ (${cur})`}</td>
                        <td className="px-3 py-2" colSpan={2} dir="ltr">
                          {sum.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                אין עדיין שורות תמחור להצעה הזו.
              </div>
            )}

            <div className="mt-4 max-w-2xl space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות תמחור</Label>
              <Input
                value={form.pricingNotes}
                onChange={(e) => upd("pricingNotes", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/quotes/$id" params={{ id }}>
                ביטול
              </Link>
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

// Pickup/delivery address + repeatable contacts — mirrors the wizard's "ו.
// אנשי קשר" section (step 2) and feeds the same payload keys that
// quote-document.tsx reads for its route/shipper/consignee display. These
// were entirely absent from the edit page before, so once a quote was
// created there was no way to correct an address or contact on a revision.
function ContactBlock({
  title,
  address,
  onAddressChange,
  contacts,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string;
  address: string;
  onAddressChange: (v: string) => void;
  contacts: { name: string; phone: string; email: string }[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<{ name: string; phone: string; email: string }>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <Field label={`כתובת ${title}`}>
        <Input
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="רחוב, עיר, מדינה"
        />
      </Field>
      <div className="mt-3 space-y-2">
        {contacts.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-3"
          >
            <Input
              placeholder="שם"
              value={c.name}
              onChange={(e) => onUpdate(i, { name: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              placeholder="טלפון"
              value={c.phone}
              onChange={(e) => onUpdate(i, { phone: e.target.value })}
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-1">
              <Input
                placeholder="אימייל"
                value={c.email}
                onChange={(e) => onUpdate(i, { email: e.target.value })}
                className="h-8 flex-1 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(i)}
                aria-label="הסר איש קשר"
                className="h-8 w-8 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="mt-2 gap-1.5">
        <Plus className="h-3.5 w-3.5" /> הוסף איש קשר
      </Button>
    </div>
  );
}
