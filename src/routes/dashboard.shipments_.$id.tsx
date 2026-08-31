import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
  Info,
  FileText,
  Receipt,
  Building2,
  Route as RouteIcon,
  MapPin,
  ClipboardList,
  StickyNote,
  Wallet,
  Waypoints,
  Boxes,
  Thermometer,
  Truck,
  Calculator,
  Camera,
  PenLine,
  Send,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  LoggerPicker,
  TEMP_LOGGERS,
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
import { REVIEW_STATUS_OPTIONS, getReviewStatusStyle } from "@/lib/review-status";
import { PackagingChecklistLauncher } from "@/components/packaging-checklist-dialog";
import type { ChecklistCaseSnapshot, ChecklistBox } from "@/lib/packaging-checklist";
import { CourierTaskReportLauncher } from "@/components/courier-task-report-dialog";
import {
  buildCourierTaskReportHtml,
  type CourierTaskReportData,
  type CourierTaskReportPoint,
} from "@/lib/courier-task-report";
import { listCouriers } from "@/lib/couriers.functions";
import {
  getCourierProofUrl,
  uploadCaseSignatureDocument,
  sendCourierTaskReport,
} from "@/lib/courier-portal.functions";

// Resolves a package/selection's attached recorder to a display label for
// the packaging checklist — either a real device from the TEMP_LOGGERS
// catalog, or (import shipments only) the simple "יש רשם" yes/no flag with
// no specific device attached. undefined means no recorder was set at all.
function resolveLoggerLabel(
  loggerId: string | null | undefined,
  hasLogger?: boolean | null,
): string | undefined {
  if (loggerId) {
    const logger = TEMP_LOGGERS.find((t) => t.id === loggerId);
    if (logger) return `${logger.company} ${logger.model}`;
  }
  if (hasLogger === true) return "יש רשם (ללא דגם ספציפי)";
  return undefined;
}

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
  pickupAddress: string;
  deliveryAddress: string;
  pickupContacts: ContactForm[];
  deliveryContacts: ContactForm[];
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
  critilog: CritiLogForm;
};

// Mirrors the columns of the CritiLog tracking sheet operators work from
// day-to-day, kept as its own nested payload.critilog object (rather than
// flat top-level keys) so it doesn't collide with the case's own fields —
// this is a separate, parallel tracking log, not a replacement for them.
type CritiLogForm = {
  name: string;
  serviceRep: string;
  blNumber: string;
  customer: string;
  ref: string;
  route: string;
  type: string;
  reviewStatus: string;
  opsNotes: string;
  pickupIsrael: string;
  dutyUpdates: string;
  evening: boolean;
  weekend: boolean;
  courier: string;
  courierId: string;
  notes: string;
  pickupAbroad: string;
};

// Same four shipment-kind categories used across the wizard/Operations/
// Pickup-Distribution — used below to default the CritiLog "סוג" field.
const SHIP_KIND_LABEL_HE: Record<string, string> = {
  import: "ייבוא",
  export: "ייצוא",
  distribution: "דרופ",
  domestic: "פנים ארצי",
};

const EMPTY_CRITILOG: CritiLogForm = {
  name: "",
  serviceRep: "",
  blNumber: "",
  customer: "",
  ref: "",
  route: "",
  type: "",
  reviewStatus: "",
  opsNotes: "",
  pickupIsrael: "",
  dutyUpdates: "",
  evening: false,
  weekend: false,
  courier: "",
  courierId: "",
  notes: "",
  pickupAbroad: "",
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
    .map((s) => ({
      key: toText(s.key),
      qty: Number(s.qty) || 0,
      // These were previously dropped here, which silently reset a
      // selection's product weight / dry ice / logger back to nothing every
      // time the case was opened for editing and saved.
      productWeight: s.productWeight != null ? Number(s.productWeight) || 0 : undefined,
      loggerId: typeof s.loggerId === "string" ? s.loggerId : null,
      dryIceQty: s.dryIceQty != null ? Number(s.dryIceQty) || 0 : undefined,
      hasLogger: typeof s.hasLogger === "boolean" ? s.hasLogger : null,
      loggerDataRead: s.loggerDataRead === true,
    }))
    .filter((s) => s.key && s.qty > 0);
}

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
function parseCritiLog(raw: unknown): CritiLogForm {
  if (!isRecord(raw)) return { ...EMPTY_CRITILOG };
  return {
    name: toText(raw.name),
    serviceRep: toText(raw.serviceRep),
    blNumber: toText(raw.blNumber),
    customer: toText(raw.customer),
    ref: toText(raw.ref),
    route: toText(raw.route),
    type: toText(raw.type),
    reviewStatus: toText(raw.reviewStatus),
    opsNotes: toText(raw.opsNotes),
    pickupIsrael: toText(raw.pickupIsrael),
    dutyUpdates: toText(raw.dutyUpdates),
    evening: raw.evening === true,
    weekend: raw.weekend === true,
    courier: toText(raw.courier),
    courierId: toText(raw.courierId),
    notes: toText(raw.notes),
    pickupAbroad: toText(raw.pickupAbroad),
  };
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
        // Previously dropped — a package's own temperature requirement and
        // attached logger were silently reset every time the case was saved.
        tempSeries,
        loggerId: typeof p.loggerId === "string" ? p.loggerId : null,
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
  const listCouriersFn = useServerFn(listCouriers);

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["operations-case", id],
    queryFn: () => getCaseFn({ data: { id } }),
  });

  const { data: serviceReps = [] } = useQuery({
    queryKey: ["service-reps"],
    queryFn: () => listServiceRepsFn(),
  });

  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listCouriersFn(),
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

  // Set only by the courier's own no-login portal (src/routes/courier.$token.tsx
  // via src/lib/courier-portal.functions.ts) — never edited from this page,
  // just displayed here so staff can see pickup/delivery status and open the
  // proof photo/signature the courier uploaded.
  const courierTaskRaw = isRecord(casePayload.courierTask) ? casePayload.courierTask : {};
  const courierTaskStatus: "pending" | "picked_up" | "delivered" =
    courierTaskRaw.status === "picked_up" || courierTaskRaw.status === "delivered"
      ? courierTaskRaw.status
      : "pending";
  const courierPickedUpAt =
    typeof courierTaskRaw.pickedUpAt === "string" ? courierTaskRaw.pickedUpAt : null;
  const courierDeliveredAt =
    typeof courierTaskRaw.deliveredAt === "string" ? courierTaskRaw.deliveredAt : null;
  const courierProofPhotoPath =
    typeof courierTaskRaw.proofPhotoPath === "string" ? courierTaskRaw.proofPhotoPath : null;
  const courierProofSignaturePath =
    typeof courierTaskRaw.proofSignaturePath === "string"
      ? courierTaskRaw.proofSignaturePath
      : null;
  const courierDocumentPath =
    typeof courierTaskRaw.documentPath === "string" ? courierTaskRaw.documentPath : null;
  const courierDocumentName =
    typeof courierTaskRaw.documentName === "string" ? courierTaskRaw.documentName : null;
  const courierReportSentAt =
    typeof courierTaskRaw.reportSentAt === "string" ? courierTaskRaw.reportSentAt : null;

  const getCourierProofUrlFn = useServerFn(getCourierProofUrl);
  const viewCourierProof = useMutation({
    mutationFn: (path: string) => getCourierProofUrlFn({ data: { path } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "לא ניתן לפתוח את הקובץ"),
  });

  const uploadCaseSignatureDocumentFn = useServerFn(uploadCaseSignatureDocument);
  const uploadDocument = useMutation({
    mutationFn: (vars: { fileName: string; dataUrl: string }) =>
      uploadCaseSignatureDocumentFn({ data: { caseId: id, ...vars } }),
    onSuccess: () => {
      toast.success("המסמך הועלה — יופיע באפליקציית הבלדר");
      queryClient.invalidateQueries({ queryKey: ["operations-case", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העלאת המסמך נכשלה"),
  });

  const sendCourierTaskReportFn = useServerFn(sendCourierTaskReport);
  const sendReport = useMutation({
    mutationFn: (html: string) => sendCourierTaskReportFn({ data: { caseId: id, html } }),
    onSuccess: () => {
      toast.success("דוח המשימה נשלח לאפליקציית הבלדר");
      queryClient.invalidateQueries({ queryKey: ["operations-case", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שליחת הדוח נכשלה"),
  });

  const assignedRep: CaseRep = isRecord(casePayload.assignedRep)
    ? {
        id: toText(casePayload.assignedRep.id),
        name: toText(casePayload.assignedRep.name),
        role: toText(casePayload.assignedRep.role),
      }
    : null;
  const commercialRep = isRecord(casePayload.accountManager)
    ? {
        name: toText(casePayload.accountManager.name),
        email: toText(casePayload.accountManager.email),
      }
    : null;
  const pipelineStatusRaw = toText(casePayload.pipelineStatus);
  const currentPipelineStatus: CasePipelineStatus = CASE_PIPELINE_STATUS_ORDER.includes(
    pipelineStatusRaw as CasePipelineStatus,
  )
    ? (pipelineStatusRaw as CasePipelineStatus)
    : "new";

  // Coarse-status → badge tone, mirrors the Operations dashboard's
  // STATUS_BADGE_CLASS so the same status reads the same color everywhere.
  const COARSE_BADGE_CLASS: Record<string, string> = {
    new: "bg-primary/10 text-primary",
    in_progress: "bg-accent/15 text-accent",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
  };

  const [form, setForm] = useState<Form | null>(null);
  const [originalPayload, setOriginalPayload] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // Filling in the CritiLog "איסוף/מסירה בישראל" date (the same field the
  // courier team's own sheet is keyed off) is what links this case into the
  // Pickup/Distribution screen — no separate status transition or
  // navigation happens here, the Pickup/Distribution page itself picks up
  // any case with this date set (see getPickupIsraelDate there).

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

    // The CritiLog tracking fields are their own free-editable log (an ops
    // team may retype values differently from the quote), but they should
    // still start out matching what's already on record for the case
    // instead of loading blank — only fall back to the case's own data when
    // the field hasn't been filled in on the log itself yet.
    const parsedCritiLog = parseCritiLog(payload.critilog);
    const critiLogBlNumber = toText(payload.blNumber);
    const critiLogRoute = [caseRow.origin_port, caseRow.dest_port].filter(Boolean).join("-");
    const critiLogType = caseRow.shipment_kind
      ? (SHIP_KIND_LABEL_HE[caseRow.shipment_kind] ?? caseRow.shipment_kind)
      : "";
    const critilog: CritiLogForm = {
      ...parsedCritiLog,
      serviceRep: parsedCritiLog.serviceRep || (assignedRep?.name ?? ""),
      blNumber: parsedCritiLog.blNumber || critiLogBlNumber,
      customer: parsedCritiLog.customer || (caseRow.customer_name ?? ""),
      ref: parsedCritiLog.ref || (caseRow.customer_ref ?? ""),
      route: parsedCritiLog.route || critiLogRoute,
      type: parsedCritiLog.type || critiLogType,
    };

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
      // Absent entirely from this page before — a rep who set the pickup/
      // delivery address and contacts on the quote had no way to see or
      // correct them once the case was opened, which is exactly the "no
      // connection" gap most visible on domestic shipments (no ports/agent/
      // airline there, so the address+contacts are the only "where does
      // this go" info there is).
      pickupAddress: toText(payload.pickupAddress),
      deliveryAddress: toText(payload.deliveryAddress),
      pickupContacts: parseContacts(payload.pickupContacts),
      deliveryContacts: parseContacts(payload.deliveryContacts),
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
      services:
        caseRow.shipment_kind === "domestic"
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
      critilog,
    });
  }, [caseRow]);

  function upd<K extends keyof Form>(k: K, v: string) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function updCl<K extends keyof CritiLogForm>(k: K, v: CritiLogForm[K]) {
    setForm((f) => (f ? { ...f, critilog: { ...f.critilog, [k]: v } } : f));
  }
  function updatePricingItem(id: string, key: PricingKey, value: string) {
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
      f ? { ...f, pricingItems: [...f.pricingItems, makePricingRow(f.pricingItems.length)] } : f,
    );
  }
  function removePricingItem(id: string) {
    setForm((f) =>
      f ? { ...f, pricingItems: f.pricingItems.filter((item) => item.id !== id) } : f,
    );
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
  // Same three per-model fields the catalog table needs beyond qty — see
  // parsePackSelections above for why these previously got silently reset.
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
          item.note,
        ),
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

  // Pulls whatever the case already knows into "comparison" reference values
  // shown next to the matching checklist rows (see buildCaseReferenceValues
  // in packaging-checklist.ts) — so the person filling out the checklist can
  // check the physical shipment against what's on file instead of guessing.
  const checklistCaseSnapshot: ChecklistCaseSnapshot | undefined = useMemo(() => {
    if (!form) return undefined;
    const tempRange = form.tempSeriesNone
      ? "ללא בקרת טמפרטורה"
      : form.tempSeriesList.length > 0
        ? form.tempSeriesList
            .map((k) => {
              const t = TEMP_SERIES.find((s) => s.key === k);
              return t ? `${t.label} (${t.range})` : k;
            })
            .join(", ")
        : undefined;
    const productType = form.cargoType
      ? CARGO_TYPES.find((c) => c.id === form.cargoType)?.label
      : undefined;
    const transitTime =
      form.departDate && form.arriveDate ? `${form.departDate} → ${form.arriveDate}` : undefined;
    const attrLabels = ATTR_OPTIONS.filter((a) => form.attrs[a.id])
      .map((a) => a.label)
      .join(", ");
    const specialInstructions = form.specialReq.trim() || attrLabels || undefined;
    const dropStop = form.dropType
      ? [...form.stops].reverse().find((s) => s.kind === "Drop")
      : undefined;
    const destAddress = dropStop?.address || form.destPort || undefined;
    return {
      shipmentNumber: form.unifreightNumber.trim() || caseRow?.case_code,
      tempRange,
      destination: form.shipmentKind === "domestic" ? "ישראל" : form.destPort || undefined,
      transitTime,
      productType,
      specialInstructions,
      awb: form.blNumber.trim() || form.houseBlNumber.trim() || undefined,
      destAddress,
    };
  }, [form, caseRow]);

  // Which physical box(es) the case actually ships in — one checklist per
  // box. Prefers the checked temperature-packaging models (CoolGuard/
  // BioTherm), since that's what the checklist itself is about; falls back
  // to the general pallet rows for non-temperature-controlled cargo so the
  // feature still works there too.
  const checklistBoxes: ChecklistBox[] = useMemo(() => {
    if (!form) return [];
    const fromPackModels = form.packSelections
      .filter((sel) => sel.qty > 0)
      .map((sel): ChecklistBox => {
        const calc = getPackModelCalc(sel);
        const boxSize = calc.dims
          ? `${calc.dims.length}×${calc.dims.width}×${calc.dims.height} ס״מ`
          : undefined;
        return {
          id: `pack:${sel.key}`,
          label: `${calc.label} (${sel.qty} יח')`,
          boxType: calc.label,
          boxSize,
          loggerLabel: resolveLoggerLabel(sel.loggerId, sel.hasLogger),
        };
      });

    // Manual pallets ("מארזים ומשטחים") and catalog packaging models
    // ("סדרת טמפרטורה ואריזה") aren't mutually exclusive — a case can have
    // both. Each real box/pallet across both sections gets its own
    // checklist entry, instead of the catalog list silently hiding manual
    // pallets whenever both were filled in.
    const fromPackages = form.packages
      .filter((p) => p.pallet && Number(p.unitQty) > 0)
      .map((p): ChecklistBox => {
        const pallet = PALLETS.find((pl) => pl.id === p.pallet);
        const label = pallet?.label ?? "משטח";
        const boxSize =
          p.pallet === "custom"
            ? p.customLength && p.customWidth && p.customHeight
              ? `${p.customLength}×${p.customWidth}×${p.customHeight} ס״מ`
              : undefined
            : pallet?.size;
        return {
          id: `pallet:${p.id}`,
          label: `${label} (${p.unitQty} יח')`,
          boxType: label,
          boxSize,
          loggerLabel: resolveLoggerLabel(p.loggerId),
        };
      });

    return [...fromPackModels, ...fromPackages];
  }, [form]);

  // Everything the courier needs to physically pick up and deliver the
  // shipment, formatted for the printable "דוח משימה" (task report) — reuses
  // the same packaging/weight/temp calcs used elsewhere on this page so the
  // report always matches what's on file.
  const courierReportData: CourierTaskReportData | null = useMemo(() => {
    if (!form || !caseRow) return null;
    const tempRangeLabel = form.tempSeriesNone
      ? "ללא בקרת טמפרטורה"
      : form.tempSeriesList
          .map((k) => {
            const t = TEMP_SERIES.find((s) => s.key === k);
            return t ? `${t.label} (${t.range})` : k;
          })
          .join(", ");
    const attrLabels = ATTR_OPTIONS.filter((a) => form.attrs[a.id]).map((a) => a.label);
    const dryIceTotal = form.packSelections.reduce(
      (sum, sel) => sum + (sel.qty > 0 ? (sel.dryIceQty ?? 0) : 0),
      0,
    );
    const loggerLabels = form.packSelections
      .filter((sel) => sel.qty > 0 && sel.loggerId)
      .map((sel) => {
        const l = TEMP_LOGGERS.find((tl) => tl.id === sel.loggerId);
        return l ? `${l.company} ${l.model}` : sel.loggerId!;
      });

    // Multi-stop drop shipments (Multi Pickup / Multi Drop / Milk Run etc.)
    // carry several pickup/delivery points, each with its own address and
    // contact, on form.stops — use those when present instead of the single
    // pickup/delivery address+contacts fields.
    const hasStops = form.dropType != null && form.stops.length > 0;
    function stopToPoint(s: Stop, label?: string): CourierTaskReportPoint {
      const contactName = s.contact?.trim() || s.company?.trim() || "";
      return {
        label,
        address: [s.company, s.address].filter(Boolean).join(" — ") || s.address || "",
        contacts: contactName || s.phone ? [{ name: contactName, phone: s.phone ?? "" }] : [],
        plannedTime: s.plannedTime,
        notes: s.notes,
      };
    }
    const pickupPoints: CourierTaskReportPoint[] = hasStops
      ? form.stops
          .filter((s) => s.kind === "Pickup")
          .map((s, i, arr) => stopToPoint(s, arr.length > 1 ? `נקודת איסוף ${i + 1}` : undefined))
      : [
          {
            address: form.pickupAddress,
            contacts: form.pickupContacts.filter((c) => c.name.trim() || c.phone.trim()),
          },
        ];
    const deliveryPoints: CourierTaskReportPoint[] = hasStops
      ? form.stops
          .filter((s) => s.kind === "Drop")
          .map((s, i, arr) => stopToPoint(s, arr.length > 1 ? `נקודת מסירה ${i + 1}` : undefined))
      : [
          {
            address: form.deliveryAddress,
            contacts: form.deliveryContacts.filter((c) => c.name.trim() || c.phone.trim()),
          },
        ];
    const hubPoints: CourierTaskReportPoint[] = hasStops
      ? form.stops
          .filter((s) => s.kind === "Hub")
          .map((s, i, arr) => stopToPoint(s, arr.length > 1 ? `תחנת מעבר ${i + 1}` : undefined))
      : [];

    return {
      caseCode: form.unifreightNumber.trim() || caseRow.case_code,
      customerName: form.customerName,
      customerRef: form.customerRef,
      shipmentKindLabel: form.shipmentKind
        ? (SHIP_KIND_LABEL_HE[form.shipmentKind] ?? form.shipmentKind)
        : "",
      courierName: form.critilog.courier,
      pickupDate: form.critilog.pickupIsrael || form.departDate,
      deliveryDate: form.arriveDate,
      pickupPoints,
      deliveryPoints,
      hubPoints,
      packagingLines: checklistBoxes.map((b) => b.label),
      grossWeight:
        packageTotals.grossWeight > 0 ? `${packageTotals.grossWeight.toFixed(1)} ק״ג` : "—",
      volumetricWeight:
        packageTotals.volumetricWeight > 0
          ? `${packageTotals.volumetricWeight.toFixed(1)} ק״ג`
          : "—",
      chargeableWeight:
        packageTotals.chargeableWeight > 0
          ? `${packageTotals.chargeableWeight.toFixed(1)} ק״ג`
          : "—",
      tempRangeLabel,
      dryIceLabel: dryIceTotal > 0 ? `${dryIceTotal} ק״ג` : "—",
      loggerLabels,
      attrLabels,
      specialInstructions: form.specialReq.trim(),
      notes: form.extraNotes.trim(),
      generatedAt: new Date().toLocaleString("he-IL"),
    };
  }, [form, caseRow, checklistBoxes, packageTotals]);

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
              pickupAddress: form.pickupAddress.trim() || null,
              deliveryAddress: form.deliveryAddress.trim() || null,
              pickupContacts: form.pickupContacts.filter((c) => c.name || c.phone || c.email),
              deliveryContacts: form.deliveryContacts.filter((c) => c.name || c.phone || c.email),
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
              services:
                form.shipmentKind === "domestic"
                  ? { ...form.services, pickup: true, land: true, delivery: true, insurance: false }
                  : form.services,
              routeApproved: form.routeApproved,
              logisticsNotes: form.logisticsNotes.trim() || null,
              specialReq: form.specialReq.trim() || null,
              extraNotes: form.extraNotes.trim() || null,
              critilog: {
                name: form.critilog.name.trim() || null,
                serviceRep: form.critilog.serviceRep.trim() || null,
                blNumber: form.critilog.blNumber.trim() || null,
                customer: form.critilog.customer.trim() || null,
                ref: form.critilog.ref.trim() || null,
                route: form.critilog.route.trim() || null,
                type: form.critilog.type.trim() || null,
                reviewStatus: form.critilog.reviewStatus.trim() || null,
                opsNotes: form.critilog.opsNotes.trim() || null,
                pickupIsrael: form.critilog.pickupIsrael || null,
                dutyUpdates: form.critilog.dutyUpdates.trim() || null,
                evening: form.critilog.evening,
                weekend: form.critilog.weekend,
                courier: form.critilog.courier.trim() || null,
                courierId: form.critilog.courierId || null,
                notes: form.critilog.notes.trim() || null,
                pickupAbroad: form.critilog.pickupAbroad || null,
              },
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
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              תיק {(form?.unifreightNumber.trim() || caseRow?.case_code) ?? ""}
            </h1>
            {caseRow && (
              <Badge
                className={
                  COARSE_BADGE_CLASS[CASE_PIPELINE_STATUS_META[currentPipelineStatus].coarse]
                }
              >
                {CASE_PIPELINE_STATUS_META[currentPipelineStatus].label}
              </Badge>
            )}
          </div>
          {caseRow?.quote_id && (
            <p className="mt-1 text-sm text-muted-foreground">
              נפתח מהצעה{" "}
              <Link
                to="/dashboard/quotes/$id"
                params={{ id: caseRow.quote_id }}
                className="text-primary underline-offset-2 hover:underline"
              >
                מקורית
              </Link>
            </p>
          )}
          {typeof casePayload.parentCaseId === "string" && casePayload.parentCaseId && (
            <p className="mt-1 text-sm text-muted-foreground">
              תיק איסוף/הפצה, מקושר לתיק הראשי{" "}
              <Link
                to="/dashboard/shipments/$id"
                params={{ id: casePayload.parentCaseId }}
                className="text-primary underline-offset-2 hover:underline"
              >
                {typeof casePayload.parentCaseCode === "string" ? casePayload.parentCaseCode : ""}
              </Link>
            </p>
          )}
          {typeof casePayload.pickupCaseId === "string" && casePayload.pickupCaseId && (
            <p className="mt-1 text-sm text-muted-foreground">
              נפתח ממנו תיק איסוף/הפצה{" "}
              <Link
                to="/dashboard/shipments/$id"
                params={{ id: casePayload.pickupCaseId }}
                className="text-primary underline-offset-2 hover:underline"
              >
                {typeof casePayload.pickupCaseCode === "string" ? casePayload.pickupCaseCode : ""}
              </Link>
            </p>
          )}
          {form ? (
            <div className="mt-2 flex items-center gap-2">
              <Label className="whitespace-nowrap text-xs text-muted-foreground">
                מס' תיק ביוניפרייט
              </Label>
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
          <div className="flex flex-wrap items-center gap-2">
            <ActionButtonGroup onSave={handleSave} saving={saving} />
            {courierReportData && <CourierTaskReportLauncher data={courierReportData} />}
            {courierReportData && form.critilog.courierId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={sendReport.isPending}
                onClick={() => sendReport.mutate(buildCourierTaskReportHtml(courierReportData))}
              >
                <Send className="h-3.5 w-3.5" />
                {sendReport.isPending
                  ? "שולח…"
                  : courierReportSentAt
                    ? "שליחת דוח מעודכן לבלדר"
                    : "שליחת דוח לבלדר"}
              </Button>
            )}
            {form.critilog.pickupIsrael && (
              <PackagingChecklistLauncher
                caseId={id}
                boxes={checklistBoxes}
                existingChecklists={
                  isRecord(casePayload.packagingChecklists) ? casePayload.packagingChecklists : {}
                }
                baseSnapshot={checklistCaseSnapshot ?? {}}
                defaults={{
                  shipmentNumber: form.unifreightNumber.trim() || caseRow.case_code,
                  customer: form.customerName,
                  destination: form.shipmentKind === "domestic" ? "ישראל" : form.destPort,
                }}
                lockDestination={form.shipmentKind === "domestic"}
              />
            )}
            <Button asChild variant="ghost" className="gap-2 text-muted-foreground">
              <Link to="/dashboard/shipments">
                <ArrowRight className="h-4 w-4" /> חזרה למשלוחים
              </Link>
            </Button>
          </div>
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
            <SectionHeading icon={Info} tone="primary" title="סטטוס תיק" className="mb-3" />
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
          </div>

          {form.shipmentKind !== "domestic" && (
            <Section title="מסמכי משלוח" icon={FileText} tone="accent">
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
            <SectionHeading
              icon={Receipt}
              tone="warning"
              title="פרטי חשבונית ורפרנס"
              className="mb-3"
            />
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
            <SectionHeading icon={UserRound} tone="success" title="טיפול בתיק" className="mb-3" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">נציג שירות מטפל</Label>
                <Select
                  value={assignedRep?.id ?? ""}
                  onValueChange={(repId) => {
                    const rep = serviceReps.find((r) => r.id === repId);
                    assignRepMutation.mutate(
                      rep ? { id: rep.id, name: rep.name, role: rep.role } : null,
                    );
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

          <Section title="פרטי לקוח ומשלוח" icon={Building2} tone="primary">
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
              <Lookup
                type="shipment_types"
                matchBy="code"
                value={form.shipmentKind || null}
                onChange={(item) => upd("shipmentKind", item?.code ?? "")}
                placeholder="בחר סוג משלוח..."
              />
            </Field>
            {form.shipmentKind !== "domestic" && (
              <Field label="Incoterm">
                <Lookup
                  type="incoterms"
                  matchBy="code"
                  value={form.incoterm || null}
                  onChange={(item) => upd("incoterm", item?.code ?? "")}
                  placeholder="בחר Incoterm..."
                />
              </Field>
            )}
          </Section>

          <Section title="מסלול ותאריכים" icon={RouteIcon} tone="accent">
            {form.shipmentKind !== "domestic" && (
              <>
                <Field label="נמל מוצא">
                  <AirportCombobox value={form.originPort} onChange={(v) => upd("originPort", v)} />
                </Field>
                <Field label="נמל יעד">
                  <AirportCombobox value={form.destPort} onChange={(v) => upd("destPort", v)} />
                </Field>
              </>
            )}
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
            {form.shipmentKind !== "domestic" && (
              <>
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
                  <Lookup
                    type="airlines"
                    matchBy="code"
                    value={form.airline || null}
                    onChange={(item) => upd("airline", item?.code ?? "")}
                    placeholder="בחר חברת תעופה..."
                  />
                </Field>
              </>
            )}
          </Section>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <SectionHeading
              icon={MapPin}
              tone="warning"
              title="כתובות ואנשי קשר"
              className="mb-4"
            />
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

          <Section title="מעקב" icon={ClipboardList} tone="warning">
            <Field label="כיסוי">
              <div className="flex h-9 items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.critilog.evening}
                    onChange={(e) => updCl("evening", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  ערב
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.critilog.weekend}
                    onChange={(e) => updCl("weekend", e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  סופ"ש
                </label>
              </div>
            </Field>
            <Field label="מספר מעקב">
              <Input value={form.critilog.name} onChange={(e) => updCl("name", e.target.value)} />
            </Field>
            <Field label="איש שירות">
              <Input
                value={form.critilog.serviceRep}
                onChange={(e) => updCl("serviceRep", e.target.value)}
              />
            </Field>
            {form.shipmentKind !== "domestic" && (
              <Field label="שטר מטען">
                <Input
                  value={form.critilog.blNumber}
                  onChange={(e) => updCl("blNumber", e.target.value)}
                />
              </Field>
            )}
            <Field label="לקוח">
              <Input
                value={form.critilog.customer}
                onChange={(e) => updCl("customer", e.target.value)}
              />
            </Field>
            <Field label="REF">
              <Input value={form.critilog.ref} onChange={(e) => updCl("ref", e.target.value)} />
            </Field>
            {form.shipmentKind !== "domestic" && (
              <Field label="ניתוב">
                <Input
                  value={form.critilog.route}
                  onChange={(e) => updCl("route", e.target.value)}
                  placeholder="לדוגמה: YYZ-TLV"
                />
              </Field>
            )}
            <Field label="סוג">
              <Input value={form.critilog.type} onChange={(e) => updCl("type", e.target.value)} />
            </Field>
            <Field label="סטטוס לבדיקה">
              <Select
                value={form.critilog.reviewStatus || ""}
                onValueChange={(v) => updCl("reviewStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סטטוס...">
                    {form.critilog.reviewStatus ? (
                      <ReviewStatusBadge value={form.critilog.reviewStatus} />
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REVIEW_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <ReviewStatusBadge value={o.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="איסוף/מסירה בישראל" hint="הזנת תאריך מקשרת את התיק למסך איסוף/הפצה">
              <Input
                type="date"
                value={form.critilog.pickupIsrael}
                onChange={(e) => updCl("pickupIsrael", e.target.value)}
              />
            </Field>
            {form.shipmentKind !== "domestic" && (
              <Field label="איסוף/מסירה בחול">
                <Input
                  type="date"
                  value={form.critilog.pickupAbroad}
                  onChange={(e) => updCl("pickupAbroad", e.target.value)}
                />
              </Field>
            )}
            <Field
              label="בלדר"
              hint="בחירת בלדר משויכת מקשרת את התיק לאפליקציית הבלדר שלו — ניהול בלדרים וקישורים בעמוד הארגון"
            >
              <div className="space-y-2">
                <Select
                  value={form.critilog.courierId || "none"}
                  onValueChange={(v) => {
                    if (v === "none") {
                      updCl("courierId", "");
                      return;
                    }
                    const c = couriers.find((c) => c.id === v);
                    updCl("courierId", v);
                    if (c) updCl("courier", c.name);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="שיוך לבלדר באפליקציה (לא חובה)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא שיוך</SelectItem>
                    {couriers
                      .filter((c) => c.isActive || c.id === form.critilog.courierId)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {!c.isActive ? " (מושבת)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  value={form.critilog.courier}
                  onChange={(e) => updCl("courier", e.target.value)}
                  placeholder="שם הבלדר (חופשי)"
                />
              </div>
            </Field>
            {form.critilog.courierId && (
              <Field label="סטטוס באפליקציית הבלדר">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      courierTaskStatus === "delivered"
                        ? "bg-success/15 text-success"
                        : courierTaskStatus === "picked_up"
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground"
                    }
                  >
                    {courierTaskStatus === "delivered"
                      ? "נמסר ללקוח"
                      : courierTaskStatus === "picked_up"
                        ? "נאסף"
                        : "ממתין לאיסוף"}
                  </Badge>
                  {courierPickedUpAt && (
                    <span className="text-xs text-muted-foreground">
                      נאסף: {new Date(courierPickedUpAt).toLocaleString("he-IL")}
                    </span>
                  )}
                  {courierDeliveredAt && (
                    <span className="text-xs text-muted-foreground">
                      נמסר: {new Date(courierDeliveredAt).toLocaleString("he-IL")}
                    </span>
                  )}
                </div>
                {(courierProofPhotoPath || courierProofSignaturePath) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {courierProofPhotoPath && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={viewCourierProof.isPending}
                        onClick={() => viewCourierProof.mutate(courierProofPhotoPath)}
                      >
                        <Camera className="h-3.5 w-3.5" /> צפייה בתמונה
                      </Button>
                    )}
                    {courierProofSignaturePath && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={viewCourierProof.isPending}
                        onClick={() => viewCourierProof.mutate(courierProofSignaturePath)}
                      >
                        <PenLine className="h-3.5 w-3.5" /> צפייה בחתימה
                      </Button>
                    )}
                  </div>
                )}
                {courierReportSentAt && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    דוח משימה נשלח לבלדר: {new Date(courierReportSentAt).toLocaleString("he-IL")}
                  </div>
                )}
              </Field>
            )}
            {form.critilog.courierId && (
              <Field
                label="מסמך לחתימה"
                hint="מסמך שתעלו כאן (למשל שטר מטען) יופיע באפליקציית הבלדר לצפייה — הבלדר מאשר בחתימה שכבר קיימת באפליקציה"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="courier-document-upload"
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === "string") {
                          uploadDocument.mutate({ fileName: file.name, dataUrl: reader.result });
                        }
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={uploadDocument.isPending}
                    onClick={() => document.getElementById("courier-document-upload")?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadDocument.isPending
                      ? "מעלה…"
                      : courierDocumentPath
                        ? "החלפת מסמך"
                        : "העלאת מסמך"}
                  </Button>
                  {courierDocumentPath && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={viewCourierProof.isPending}
                      onClick={() => viewCourierProof.mutate(courierDocumentPath)}
                    >
                      <FileText className="h-3.5 w-3.5" /> צפייה במסמך
                    </Button>
                  )}
                </div>
                {courierDocumentName && (
                  <div className="mt-1 text-xs text-muted-foreground">{courierDocumentName}</div>
                )}
              </Field>
            )}
          </Section>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <SectionHeading
              icon={StickyNote}
              tone="primary"
              title="הערות ועדכונים"
              className="mb-4"
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">לתפעול</Label>
                <Textarea
                  value={form.critilog.opsNotes}
                  onChange={(e) => updCl("opsNotes", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">עדכונים תורנות</Label>
                <Textarea
                  value={form.critilog.dutyUpdates}
                  onChange={(e) => updCl("dutyUpdates", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">הערות</Label>
                <Textarea
                  value={form.critilog.notes}
                  onChange={(e) => updCl("notes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Section title="פיננסי" icon={Wallet} tone="success">
            <Field label="מטבע">
              <Lookup
                type="currencies"
                matchBy="code"
                value={form.currency || null}
                onChange={(item) => upd("currency", item?.code ?? "")}
                placeholder="בחר מטבע..."
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
              <SectionHeading icon={Waypoints} tone="warning" title="משלוחי דרופ (Drop Type)" />
              <select
                value={form.dropType ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = isDropTypeId(v) ? v : null;
                  setForm((f) =>
                    f ? { ...f, dropType: next, stops: next ? seedStopsForDropType(next) : [] } : f,
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
              <SectionHeading icon={Boxes} tone="success" title="מארזים ומשטחים" />
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
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <Field label="סוג משטח">
                        <select
                          value={pkg.pallet ?? ""}
                          onChange={(e) =>
                            updatePackage(pkg.id, { pallet: e.target.value || null })
                          }
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                        >
                          <option value="">— בחר —</option>
                          {PALLETS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {pkg.pallet === "custom" && (
                        <>
                          <Field label="אורך (ס״מ)">
                            <Input
                              type="number"
                              value={pkg.customLength}
                              onChange={(e) =>
                                updatePackage(pkg.id, { customLength: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="רוחב (ס״מ)">
                            <Input
                              type="number"
                              value={pkg.customWidth}
                              onChange={(e) =>
                                updatePackage(pkg.id, { customWidth: e.target.value })
                              }
                            />
                          </Field>
                          <Field label="גובה (ס״מ)">
                            <Input
                              type="number"
                              value={pkg.customHeight}
                              onChange={(e) =>
                                updatePackage(pkg.id, { customHeight: e.target.value })
                              }
                            />
                          </Field>
                        </>
                      )}
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
                                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
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

                    {pkg.pallet === "custom" && pkg.tempSeries === "deepFrozen" && (
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

                    <div className="mt-3 max-w-xs">
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
                  </div>
                );
              })}
            </div>

            <div className="mt-5 border-t pt-4">
              <SectionHeading
                icon={Thermometer}
                tone="primary"
                title="סדרת טמפרטורה ואריזה"
                className="mb-3"
              />
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
            <SectionHeading icon={Truck} tone="accent" title="לוגיסטיקה" className="mb-4" />
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
              <span>אושר המסלול</span>
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
              <SectionHeading icon={Calculator} tone="warning" title="תמחור" />
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
                          <Input
                            value={item.desc}
                            onChange={(e) => updatePricingItem(item.id, "desc", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) => updatePricingItem(item.id, "qty", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.unit}
                            onChange={(e) => updatePricingItem(item.id, "unit", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updatePricingItem(item.id, "unitPrice", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.currency}
                            onChange={(e) => updatePricingItem(item.id, "currency", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.total}
                            onChange={(e) => updatePricingItem(item.id, "total", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.note}
                            onChange={(e) => updatePricingItem(item.id, "note", e.target.value)}
                          />
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
                אין עדיין שורות תמחור בתיק הזה.
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
// שמור שינויים is the primary action for this page, so it always renders
// first (rightmost in RTL) with solid styling; ביטול sits right beside it as
// its natural pair. Secondary/utility actions (documents, back navigation)
// render after this group and recede visually (outline/ghost), so the save
// action isn't crowded out of the most prominent spot in the row.
function ActionButtonGroup({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "שומר..." : "שמור שינויים"}
      </Button>
      <Button
        asChild
        variant="outline"
        className="gap-2 border-warning/30 text-warning hover:bg-warning/5 hover:text-warning"
      >
        <Link to="/dashboard/shipments">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-warning/15">
            <X className="h-3 w-3" />
          </span>
          ביטול
        </Link>
      </Button>
    </div>
  );
}

// Shared tone palette for section-header icon badges — same bg-x/10-15
// text-x convention used across the Operations/Pickup-Distribution kind
// cards, just cycled per section here to make this otherwise all-white
// form page feel less monotone.
const TONE_BADGE = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
} as const;
type SectionTone = keyof typeof TONE_BADGE;

function SectionHeading({
  icon: Icon,
  tone,
  title,
  className,
}: {
  icon: typeof Info;
  tone: SectionTone;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm font-semibold", className)}>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          TONE_BADGE[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      {title}
    </div>
  );
}

function Section({
  title,
  icon,
  tone = "primary",
  children,
}: {
  title: string;
  icon?: typeof Info;
  tone?: SectionTone;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      {icon ? (
        <SectionHeading icon={icon} tone={tone} title={title} className="mb-4" />
      ) : (
        <div className="mb-4 text-sm font-semibold">{title}</div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}
function ReviewStatusBadge({ value }: { value: string }) {
  const style = getReviewStatusStyle(value);
  return (
    <span
      className="rounded px-2 py-0.5 text-xs font-medium"
      style={style ? { backgroundColor: style.bg, color: style.fg } : undefined}
    >
      {value}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Pickup/delivery address + repeatable contacts — mirrors the wizard's step
// 2 and the quote edit page's version. Was entirely absent from this case
// page before, so once a case was opened there was no way to see or correct
// an address/contact that had been entered on the quote.
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
