import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ArrowRight, Check, Plus, Save, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AirportCombobox } from "@/components/airport-combobox";
import { Lookup } from "@/components/lookup";
import {
  getCase,
  updateCase,
  updateCasePipelineStatus,
  listServiceReps,
  assignCaseRep,
  CASE_PIPELINE_STATUS_META,
  CASE_PIPELINE_STATUS_ORDER,
  type CasePipelineStatus,
  type CaseRep,
} from "@/lib/operations.functions";
import {
  StopsEditor,
  PackQtyStepper,
  TEMP_SERIES,
  COOLGUARD_MODELS,
  BIOTHERM_MODELS,
  PALLETS,
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
} from "@/components/new-quote-dialog";
import {
  DROP_TYPE_SPECS,
  isDropTypeId,
  seedStopsForDropType,
  normalizeStopsForPersist,
  type DropTypeId,
  type Stop,
  type StopKind,
} from "@/lib/drop-stops";

export const Route = createFileRoute("/dashboard/shipments_/$id")({
  head: () => ({
    meta: [
      { title: "תיק משלוח — AFIK Logistics Platform" },
      { name: "description", content: "פרטי תיק שנפתח מהצעת מחיר, ניתן לעריכה מלאה." },
    ],
  }),
  component: CaseDetail,
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
  total: string;
  blNumber: string;
  houseBlNumber: string;
  unifreightNumber: string;
  invoiceNumber: string;
  reference: string;
  notes: string;
  pricingItems: PricingItemForm[];
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

const VALID_CARGO_TYPES: CargoType[] = ["general", "temperature", "nfo", "live", "dangerous", "other"];
function parseCargoType(raw: unknown): CargoType | null {
  return typeof raw === "string" && (VALID_CARGO_TYPES as string[]).includes(raw) ? (raw as CargoType) : null;
}
const VALID_TEMP_KEYS: TempSeriesKey[] = TEMP_SERIES.map((t) => t.key);
function parseTempSeriesList(raw: unknown): TempSeriesKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is TempSeriesKey => typeof k === "string" && (VALID_TEMP_KEYS as string[]).includes(k));
}
function parsePackSelections(raw: unknown): PackSelection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (isRecord(s) ? s : null))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s) => ({ key: toText(s.key), qty: Number(s.qty) || 0 }))
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
      return {
        ...makePackageRow(),
        pallet: typeof p.pallet === "string" ? p.pallet : null,
        customLength: toText(customDims?.length),
        customWidth: toText(customDims?.width),
        customHeight: toText(customDims?.height),
        unitWeight: toText(p.unitWeight) || "1",
        unitQty: toText(p.unitQty),
      };
    });
  return rows.length > 0 ? rows : [makePackageRow()];
}

function CaseDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const updateCaseFn = useServerFn(updateCase);
  const updateCasePipelineStatusFn = useServerFn(updateCasePipelineStatus);
  const listServiceRepsFn = useServerFn(listServiceReps);
  const assignCaseRepFn = useServerFn(assignCaseRep);

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["operations-case", id],
    queryFn: () => getCaseFn({ data: { id } }),
  });

  const { data: serviceReps = [] } = useQuery({
    queryKey: ["service-reps"],
    queryFn: () => listServiceRepsFn(),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { status: CasePipelineStatus; extra?: Record<string, unknown> }) =>
      updateCasePipelineStatusFn({ data: { id, status: input.status, extra: input.extra } }),
    onSuccess: () => {
      toast.success("סטטוס התיק עודכן");
      queryClient.invalidateQueries({ queryKey: ["operations-case", id] });
      queryClient.invalidateQueries({ queryKey: ["operations-cases"] });
    },
    onError: () => toast.error("עדכון הסטטוס נכשל"),
  });

  const assignRepMutation = useMutation({
    mutationFn: (rep: CaseRep) => assignCaseRepFn({ data: { id, rep } }),
    onSuccess: () => {
      toast.success("נציג השירות המטפל עודכן");
      queryClient.invalidateQueries({ queryKey: ["operations-case", id] });
    },
    onError: () => toast.error("שיוך הנציג נכשל"),
  });

  const casePayload = caseRow && isRecord(caseRow.payload) ? caseRow.payload : {};
  const assignedRep: CaseRep = isRecord(casePayload.assignedRep)
    ? {
        id: toText(casePayload.assignedRep.id),
        name: toText(casePayload.assignedRep.name),
        role: toText(casePayload.assignedRep.role),
      }
    : null;
  const commercialRep = isRecord(casePayload.accountManager)
    ? { name: toText(casePayload.accountManager.name), email: toText(casePayload.accountManager.email) }
    : null;
  const pipelineStatusRaw = toText(casePayload.pipelineStatus);
  const currentPipelineStatus: CasePipelineStatus = CASE_PIPELINE_STATUS_ORDER.includes(
    pipelineStatusRaw as CasePipelineStatus,
  )
    ? (pipelineStatusRaw as CasePipelineStatus)
    : "new";

  const [form, setForm] = useState<Form | null>(null);
  const [originalPayload, setOriginalPayload] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const [pickupDueDate, setPickupDueDate] = useState("");
  useEffect(() => {
    if (!caseRow) return;
    const raw = casePayload.pickupDueDate;
    setPickupDueDate(typeof raw === "string" ? raw : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseRow]);

  function handleTransferToPickup() {
    statusMutation.mutate(
      { status: "ready_for_pickup", extra: { pickupDueDate: pickupDueDate || null } },
      { onSuccess: () => navigate({ to: "/dashboard/pickup-distribution" }) },
    );
  }

  useEffect(() => {
    if (!caseRow) return;
    const payload = isRecord(caseRow.payload) ? caseRow.payload : {};
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
            const copyFields = [
              "company", "address", "contact", "phone", "plannedTime", "etaAt", "ataAt",
              "temperature", "signature", "photo", "status", "notes",
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
      customerName: caseRow.customer_name ?? "",
      customerRef: caseRow.customer_ref ?? "",
      shipmentKind: caseRow.shipment_kind ?? "",
      incoterm: caseRow.incoterm ?? "",
      originPort: caseRow.origin_port ?? "",
      destPort: caseRow.dest_port ?? "",
      departDate: caseRow.depart_date ?? "",
      arriveDate: caseRow.arrive_date ?? "",
      agent: caseRow.agent ?? "",
      airline: caseRow.airline ?? "",
      currency: caseRow.currency ?? "",
      total: caseRow.total != null ? String(caseRow.total) : "",
      blNumber: toText(payload.blNumber),
      houseBlNumber: toText(payload.houseBlNumber),
      unifreightNumber: toText(payload.unifreightNumber),
      invoiceNumber: toText(payload.invoiceNumber),
      reference: toText(payload.reference),
      notes: toText(payload.notes),
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
      services: parseServices(payload.services),
      routeApproved: payload.routeApproved === true,
      logisticsNotes: toText(payload.logisticsNotes),
      specialReq: toText(payload.specialReq),
      extraNotes: toText(payload.extraNotes),
    });
  }, [caseRow]);

  function upd<K extends keyof Form>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function updatePricingItem(id: string, key: PricingKey, value: string) {
    setForm((f) =>
      f
        ? { ...f, pricingItems: f.pricingItems.map((item) => (item.id === id ? { ...item, [key]: value } : item)) }
        : f,
    );
  }
  function addPricingItem() {
    setForm((f) => (f ? { ...f, pricingItems: [...f.pricingItems, makePricingRow(f.pricingItems.length)] } : f));
  }
  function removePricingItem(id: string) {
    setForm((f) => (f ? { ...f, pricingItems: f.pricingItems.filter((item) => item.id !== id) } : f));
  }
  function updatePackage(id: string, patch: Partial<PackageRow>) {
    setForm((f) => (f ? { ...f, packages: f.packages.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : f));
  }
  function addPackage() {
    setForm((f) => (f ? { ...f, packages: [...f.packages, makePackageRow()] } : f));
  }
  function removePackage(id: string) {
    setForm((f) =>
      f ? { ...f, packages: f.packages.length > 1 ? f.packages.filter((r) => r.id !== id) : f.packages } : f,
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
  function toggleTempSeriesNone() {
    setForm((f) => (f ? { ...f, tempSeriesNone: true, tempSeriesList: [], packSelections: [] } : f));
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
          item.desc || item.qty != null || item.unit || item.unitPrice != null || item.currency || item.total != null || item.note,
        ),
      );
  }

  const packageCalcs = useMemo(() => (form ? form.packages.map((pkg) => getPackageCalc(pkg)) : []), [form?.packages]);
  const packModelCalcs = useMemo(
    () => (form ? form.packSelections.map((sel) => getPackModelCalc(sel)) : []),
    [form?.packSelections],
  );
  const packageTotals = useMemo(() => {
    const grossWeight =
      packageCalcs.reduce((s, c) => s + c.grossWeight, 0) + packModelCalcs.reduce((s, c) => s + c.grossWeight, 0);
    const volumetricWeight =
      packageCalcs.reduce((s, c) => s + c.volumetricWeight, 0) +
      packModelCalcs.reduce((s, c) => s + c.volumetricWeight, 0);
    return { grossWeight, volumetricWeight, chargeableWeight: Math.max(grossWeight, volumetricWeight) };
  }, [packageCalcs, packModelCalcs]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await updateCaseFn({
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
            total: form.total ? Number(form.total) : null,
            payload: {
              ...originalPayload,
              blNumber: form.blNumber.trim() || null,
              houseBlNumber: form.houseBlNumber.trim() || null,
              unifreightNumber: form.unifreightNumber.trim() || null,
              invoiceNumber: form.invoiceNumber.trim() || null,
              reference: form.reference.trim() || null,
              notes: form.notes.trim() || null,
              pricingItems: normalizedPricingItems(),
              pricingNotes: form.pricingNotes.trim() || null,
              dropType: form.dropType,
              stops: form.dropType ? normalizeStopsForPersist(form.stops) : [],
              cargoType: form.cargoType,
              attrs: form.attrs,
              tempSeriesList: form.tempSeriesList,
              tempSeriesNone: form.tempSeriesNone,
              packSelections: form.packSelections,
              services: form.services,
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
      toast.success(`התיק ${form.unifreightNumber.trim() || res.case_code} נשמר`);
      queryClient.invalidateQueries({ queryKey: ["operations-case", id] });
      queryClient.invalidateQueries({ queryKey: ["operations-cases"] });
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
          <div className="text-sm text-muted-foreground">משלוחים · תיק</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
            תיק {(form?.unifreightNumber.trim() || caseRow?.case_code) ?? ""}
          </h1>
          {caseRow?.quote_id && (
            <p className="mt-1 text-sm text-muted-foreground">
              נפתח מהצעה{" "}
              <Link to="/dashboard/quotes/$id" params={{ id: caseRow.quote_id }} className="text-primary underline-offset-2 hover:underline">
                מקורית
              </Link>
            </p>
          )}
          {form ? (
            <div className="mt-2 flex items-center gap-2">
              <Label className="whitespace-nowrap text-xs text-muted-foreground">מס' תיק ביוניפרייט</Label>
              <Input
                value={form.unifreightNumber}
                onChange={(e) => upd("unifreightNumber", e.target.value)}
                placeholder="לדוגמה: UF-12345"
                className="h-8 w-40 text-sm"
              />
            </div>
          ) : null}
        </div>
        {form && caseRow ? (
          <ActionButtonGroup onSave={handleSave} saving={saving} />
        ) : (
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard/shipments">
              <ArrowRight className="h-4 w-4" /> חזרה למשלוחים
            </Link>
          </Button>
        )}
      </div>

      {isLoading || !form || !caseRow ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          טוען...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold">סטטוס תיק</div>
            <Select
              value={currentPipelineStatus}
              onValueChange={(v) => statusMutation.mutate({ status: v as CasePipelineStatus })}
              disabled={statusMutation.isPending}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="בחר סטטוס...">
                  {CASE_PIPELINE_STATUS_META[currentPipelineStatus].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CASE_PIPELINE_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CASE_PIPELINE_STATUS_META[s].label}
                    <span className="mr-2 text-xs text-muted-foreground">
                      · {CASE_PIPELINE_STATUS_META[s].description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {CASE_PIPELINE_STATUS_META[currentPipelineStatus].description}
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">מועד לביצוע</Label>
                <Input
                  type="date"
                  value={pickupDueDate}
                  onChange={(e) => setPickupDueDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleTransferToPickup}
                disabled={statusMutation.isPending}
              >
                <ArrowLeftRight className="h-4 w-4" /> העבר לאיסוף/הפצה
              </Button>
            </div>
          </div>

          {form.shipmentKind !== "domestic" && (
            <Section title="מסמכי משלוח">
              <Field label="מספר שטר מטען">
                <Input
                  value={form.blNumber}
                  onChange={(e) => upd("blNumber", e.target.value)}
                  placeholder="MAWB / MBL..."
                />
              </Field>
              <Field label="מספר שטר מטען פנימי">
                <Input
                  value={form.houseBlNumber}
                  onChange={(e) => upd("houseBlNumber", e.target.value)}
                  placeholder="HAWB / HBL..."
                />
              </Field>
            </Section>
          )}

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold">פרטי חשבונית ורפרנס</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="מספר חשבונית">
                <Input
                  value={form.invoiceNumber}
                  onChange={(e) => upd("invoiceNumber", e.target.value)}
                  placeholder="לדוגמה: INV-10234"
                />
              </Field>
              <Field label="רפרנס">
                <Input
                  value={form.reference}
                  onChange={(e) => upd("reference", e.target.value)}
                  placeholder="רפרנס פנימי..."
                />
              </Field>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                rows={3}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-muted-foreground" /> טיפול בתיק
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">נציג שירות מטפל</Label>
                <Select
                  value={assignedRep?.id ?? ""}
                  onValueChange={(repId) => {
                    const rep = serviceReps.find((r) => r.id === repId);
                    assignRepMutation.mutate(rep ? { id: rep.id, name: rep.name, role: rep.role } : null);
                  }}
                  disabled={assignRepMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר נציג שירות...">
                      {assignedRep ? `${assignedRep.name} — ${assignedRep.role}` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {serviceReps.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.name} — {rep.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">נציג מסחרי שפתח את התיק</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
                  {commercialRep?.name || "—"}
                </div>
              </div>
            </div>
          </div>

          <Section title="פרטי לקוח ומשלוח">
            <Field label="שם לקוח"><Input value={form.customerName} onChange={(e) => upd("customerName", e.target.value)} /></Field>
            <Field label="Ref לקוח"><Input value={form.customerRef} onChange={(e) => upd("customerRef", e.target.value)} /></Field>
            <Field label="סוג משלוח">
              <Lookup type="shipment_types" matchBy="code" value={form.shipmentKind || null}
                onChange={(item) => upd("shipmentKind", item?.code ?? "")} placeholder="בחר סוג משלוח..." />
            </Field>
            <Field label="Incoterm">
              <Lookup type="incoterms" matchBy="code" value={form.incoterm || null}
                onChange={(item) => upd("incoterm", item?.code ?? "")} placeholder="בחר Incoterm..." />
            </Field>
          </Section>

          <Section title="מסלול ותאריכים">
            {form.shipmentKind !== "domestic" && (
              <>
                <Field label="נמל מוצא"><AirportCombobox value={form.originPort} onChange={(v) => upd("originPort", v)} /></Field>
                <Field label="נמל יעד"><AirportCombobox value={form.destPort} onChange={(v) => upd("destPort", v)} /></Field>
              </>
            )}
            <Field label="תאריך יציאה"><Input type="date" value={form.departDate} onChange={(e) => upd("departDate", e.target.value)} /></Field>
            <Field label="תאריך הגעה"><Input type="date" value={form.arriveDate} onChange={(e) => upd("arriveDate", e.target.value)} /></Field>
            {form.shipmentKind !== "domestic" && (
              <>
                <Field label="סוכן">
                  <Lookup type="agents" matchBy="code" value={form.agent || null}
                    onChange={(item) => upd("agent", item?.code ?? "")} placeholder="בחר סוכן..." />
                </Field>
                <Field label="חברת תעופה">
                  <Lookup type="airlines" matchBy="code" value={form.airline || null}
                    onChange={(item) => upd("airline", item?.code ?? "")} placeholder="בחר חברת תעופה..." />
                </Field>
              </>
            )}
          </Section>

          <Section title="פיננסי">
            <Field label="מטבע">
              <Lookup type="currencies" matchBy="code" value={form.currency || null}
                onChange={(item) => upd("currency", item?.code ?? "")} placeholder="בחר מטבע..." />
            </Field>
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
                  setForm((f) => (f ? { ...f, dropType: next, stops: next ? seedStopsForDropType(next) : [] } : f));
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
                <div className="mb-3 text-xs text-muted-foreground">{DROP_TYPE_SPECS[form.dropType].desc}</div>
                <StopsEditor dropType={form.dropType} stops={form.stops} onChange={(stops) => setForm((f) => (f ? { ...f, stops } : f))} />
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                בחר סוג דרופ כדי להגדיר תחנות.
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold">אופי מטען</div>
            <div className="mb-4">
              <div className="mb-2 text-xs text-muted-foreground">סוג מטען</div>
              <div className="flex flex-wrap gap-2">
                {CARGO_TYPES.map((t) => {
                  const on = form.cargoType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((f) => (f ? { ...f, cargoType: t.id } : f))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mb-4">
              <div className="mb-2 text-xs text-muted-foreground">מאפיינים</div>
              <div className="flex flex-wrap gap-2">
                {ATTR_OPTIONS.map((a) => {
                  const on = !!form.attrs[a.id];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAttr(a.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">דרישות מיוחדות</Label>
                <Textarea value={form.specialReq} onChange={(e) => setForm((f) => (f ? { ...f, specialReq: e.target.value } : f))} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">הערות נוספות</Label>
                <Textarea value={form.extraNotes} onChange={(e) => setForm((f) => (f ? { ...f, extraNotes: e.target.value } : f))} rows={2} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">מארזים ומשטחים</div>
              <Button type="button" variant="outline" size="sm" onClick={addPackage} className="gap-2">
                <Plus className="h-4 w-4" /> הוסף חבילה
              </Button>
            </div>
            <div className="space-y-3">
              {form.packages.map((pkg) => {
                const calc = getPackageCalc(pkg);
                return (
                  <div key={pkg.id} className="rounded-lg border p-3">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <Field label="סוג משטח">
                        <select
                          value={pkg.pallet ?? ""}
                          onChange={(e) => updatePackage(pkg.id, { pallet: e.target.value || null })}
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                        >
                          <option value="">— בחר —</option>
                          {PALLETS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </Field>
                      {pkg.pallet === "custom" && (
                        <>
                          <Field label="אורך (ס״מ)">
                            <Input type="number" value={pkg.customLength} onChange={(e) => updatePackage(pkg.id, { customLength: e.target.value })} />
                          </Field>
                          <Field label="רוחב (ס״מ)">
                            <Input type="number" value={pkg.customWidth} onChange={(e) => updatePackage(pkg.id, { customWidth: e.target.value })} />
                          </Field>
                          <Field label="גובה (ס״מ)">
                            <Input type="number" value={pkg.customHeight} onChange={(e) => updatePackage(pkg.id, { customHeight: e.target.value })} />
                          </Field>
                        </>
                      )}
                      <Field label="משקל יח' (ק״ג)">
                        <Input type="number" value={pkg.unitWeight} onChange={(e) => updatePackage(pkg.id, { unitWeight: e.target.value })} />
                      </Field>
                      <Field label="כמות">
                        <Input type="number" value={pkg.unitQty} onChange={(e) => updatePackage(pkg.id, { unitQty: e.target.value })} />
                      </Field>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {calc.grossWeight > 0 && <div>משקל: {calc.grossWeight.toFixed(1)} ק״ג</div>}
                          {calc.volumetricWeight > 0 && <div>נפחי: {calc.volumetricWeight.toFixed(1)} ק״ג</div>}
                        </div>
                        {form.packages.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePackage(pkg.id)} aria-label="מחק חבילה">
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
                    (form.tempSeriesNone ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")
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
                      (form.tempSeriesList.includes(t.key) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")
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
                      {seriesMeta?.icon} {seriesMeta?.label} — קטלוג {isBio ? "BioTherm" : "CoolGuard"}
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-right font-medium">דגם</th>
                            <th className="px-3 py-2 text-right font-medium">{isBio ? "קטגוריה / משך" : "משקל נפחי ליח'"}</th>
                            <th className="w-28 px-3 py-2 text-center font-medium">כמות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isBio ? BIOTHERM_MODELS : COOLGUARD_MODELS).map((m) => {
                            const key = `${series}:${m.model}`;
                            const qty = getPackQty(key);
                            const unitCalc = getPackModelCalc({ key, qty: 1 });
                            return (
                              <tr key={key} className="border-t">
                                <td className="px-3 py-2">{m.model}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {isBio
                                    ? `${(m as { category: string }).category} · ${(m as { duration: string }).duration}`
                                    : unitCalc.volumetricWeight
                                      ? `${unitCalc.volumetricWeight.toFixed(1)} ק״ג`
                                      : ""}
                                </td>
                                <td className="px-3 py-2">
                                  <PackQtyStepper value={qty} onChange={(v) => setPackQty(key, v)} />
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
              <div>משקל ברוטו: <span className="font-semibold">{packageTotals.grossWeight > 0 ? packageTotals.grossWeight.toFixed(1) : "—"} ק״ג</span></div>
              <div>משקל נפחי: <span className="font-semibold">{packageTotals.volumetricWeight > 0 ? packageTotals.volumetricWeight.toFixed(1) : "—"} ק״ג</span></div>
              <div>משקל לחיוב: <span className="font-semibold">{packageTotals.chargeableWeight > 0 ? packageTotals.chargeableWeight.toFixed(1) : "—"} ק״ג</span></div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold">לוגיסטיקה</div>
            <div className="mb-4">
              <div className="mb-2 text-xs text-muted-foreground">שירותים כלולים</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SERVICE_LIST.map((s) => {
                  const on = !!form.services[s.id];
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-xs transition",
                        on ? "border-primary bg-primary/5" : "text-muted-foreground hover:bg-muted/30",
                      )}
                    >
                      <div className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary" : "border-muted-foreground/30")}>
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
                onChange={(e) => setForm((f) => (f ? { ...f, routeApproved: e.target.checked } : f))}
                className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
              />
              <span>אושר המסלול</span>
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות תכנון לוגיסטי</Label>
              <Textarea value={form.logisticsNotes} onChange={(e) => setForm((f) => (f ? { ...f, logisticsNotes: e.target.value } : f))} rows={3} />
            </div>
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
                        <td className="px-2 py-2"><Input value={item.desc} onChange={(e) => updatePricingItem(item.id, "desc", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input type="number" value={item.qty} onChange={(e) => updatePricingItem(item.id, "qty", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input value={item.unit} onChange={(e) => updatePricingItem(item.id, "unit", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input type="number" value={item.unitPrice} onChange={(e) => updatePricingItem(item.id, "unitPrice", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input value={item.currency} onChange={(e) => updatePricingItem(item.id, "currency", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input type="number" value={item.total} onChange={(e) => updatePricingItem(item.id, "total", e.target.value)} /></td>
                        <td className="px-2 py-2"><Input value={item.note} onChange={(e) => updatePricingItem(item.id, "note", e.target.value)} /></td>
                        <td className="px-2 py-2">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePricingItem(item.id)} aria-label="מחק שורת תמחור">
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
                אין עדיין שורות תמחור בתיק הזה.
              </div>
            )}
            <div className="mt-4 max-w-2xl space-y-1.5">
              <Label className="text-xs text-muted-foreground">הערות תמחור</Label>
              <Input value={form.pricingNotes} onChange={(e) => upd("pricingNotes", e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <ActionButtonGroup onSave={handleSave} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}

// Shared button group so the same actions (primary save first, then cancel,
// then a plain back-to-list link) appear identically at both the top and
// bottom of the page.
function ActionButtonGroup({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "שומר..." : "שמור שינויים"}
      </Button>
      <Button asChild variant="outline">
        <Link to="/dashboard/shipments">ביטול</Link>
      </Button>
      <Button asChild variant="outline" className="gap-2">
        <Link to="/dashboard/shipments">
          <ArrowRight className="h-4 w-4" /> חזרה למשלוחים
        </Link>
      </Button>
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
