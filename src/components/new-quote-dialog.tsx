import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createQuote } from "@/lib/quotes.functions";
import { listCustomers } from "@/lib/customers.functions";
import { toast } from "sonner";
import {
  DROP_TYPE_SPECS,
  FIELDS_BY_KIND,
  STOP_FIELD_LABEL,
  STOP_STATUS_OPTIONS,
  seedStopsForDropType,
  normalizeStopsForPersist,
  makeStop,
  type DropTypeId,
  type Stop,
  type StopKind,
  type StopField,
} from "@/lib/drop-stops";
import {
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Plane,
  Ship,
  Truck,
  PackageOpen,
  Trash2,
  Package,
  Thermometer,
  Zap,
  Rabbit,
  AlertTriangle,
  MoreHorizontal,
  MapPin,
  Gem,
  Snowflake,
  Info,
  X,
  Calendar,
  Clock,
  Route,
  ChevronLeft,
  DollarSign,
  RefreshCw,
  GripVertical,
  FileText,
  Tag,
  TrendingUp,
  PackageX,
  Timer,
  Activity,
  Vibrate,
  Gauge,
  Droplets,
  Droplet,
  Link,
  CloudSnow,
  ThermometerSnowflake,
  FileSignature,
  Stethoscope,
  FlaskConical,
  Dna,
  Hand,
  Briefcase,
  RotateCcw,
  ArrowUp,
  Sun,
  Waves,
  FolderOpen,
  Save,
  FileDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TONE_GRADIENT } from "@/lib/theme";
import {
  customerInitials,
  customerPalette,
} from "@/lib/customers-demo";
import { AirportCombobox } from "@/components/airport-combobox";
import { Lookup } from "@/components/lookup";
import { getLookupItemsByIds } from "@/lib/lookups.functions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PackagingRecommendationService, type PackageModel, type PackageMatch } from "@/lib/packaging-recommendation";
import { SHIPMENT_TYPE_TAGS } from "@/lib/shipment-type-tags";

const STEPS = [
  { n: 1, label: "לקוח" },
  { n: 2, label: "פרטי המשלוח" },
  { n: 3, label: "אופי המשלוח" },
  { n: 4, label: "אופיי לוגיסטי" },
  { n: 5, label: "תמחור" },
  { n: 6, label: "סיכום" },
] as const;

type ShipKind = "export" | "import" | "distribution" | "domestic";
type ShipmentMode = "direct" | "console" | "transship";

const SHIPMENT_MODES: { id: ShipmentMode; label: string; hint: string }[] = [
  { id: "direct", label: "משלוח ישיר", hint: "ללא עצירות ביניים" },
  { id: "console", label: "משלוח קונסול", hint: "איחוד מטענים" },
  { id: "transship", label: "שטעון", hint: "העברה בין כלי הובלה" },
];

const SHIP_TYPES: {
  id: ShipKind;
  label: string;
  desc: string;
  icon: typeof Plane;
  gradient: string;
}[] = [
  { id: "export", label: "ייצוא", desc: "משלוח יוצא מישראל", icon: Plane, gradient: TONE_GRADIENT.primary },
  { id: "import", label: "ייבוא", desc: "משלוח נכנס לישראל", icon: Ship, gradient: TONE_GRADIENT.accent },
  { id: "distribution", label: "משלוחי דרופ", desc: "דרופ ואיסופים בארץ", icon: PackageOpen, gradient: TONE_GRADIENT.success },
  { id: "domestic", label: "פנים ארצי", desc: "משלוח / נסיעה בישראל", icon: Truck, gradient: TONE_GRADIENT.warning },
];

const INCOTERMS = [
  { code: "CIP", name: "Carriage and Insurance Paid", hint: "הובלה וביטוח משולמים עד ליעד" },
  { code: "CPT", name: "Carriage Paid To", hint: "הובלה משולמת עד ליעד" },
  { code: "DDP", name: "Delivered Duty Paid", hint: "מסים משולמים עד ליעד" },
  { code: "EXW", name: "Ex Works", hint: "נמסר במפעל המוכר" },
  { code: "FCA", name: "Free Carrier", hint: "נמסר למוביל בנקודה מוסכמת" },
  { code: "DPU", name: "Delivered at Place Unloaded", hint: "נמסר ופרוק בנקודה מוסכמת" },
  { code: "DAP", name: "Delivered at Place", hint: "נמסר בנקודה מוסכמת" },
];

type CargoRow = { id: string; sku: string; description: string; packaging: string; weight: string; notes: string };
type ContainerRow = { id: string; type: string; sku: string; destination: string; weight: string };
type GoodsRow = { id: string; item: string; sku: string; origin: string; weight: string; dims: string; qty: number };
type ContactRow = { id: string; name: string; phone: string; email: string };
function makeContactRow(): ContactRow {
  return { id: uid(), name: "", phone: "", email: "" };
}

// -------- Step 3: אופי המשלוח --------
export type CargoType = "general" | "temperature" | "nfo" | "live" | "dangerous" | "other";
export type AttrKey =
  | "coldchain"
  | "valuable"
  | "gps"
  | "dangerous"
  | "fragile"
  | "timeCritical"
  | "dataLogger"
  | "shockIndicator"
  | "tiltIndicator"
  | "humidityLogger"
  | "chainOfCustody"
  | "dryIce"
  | "cryogenic"
  | "signatureRequired"
  | "clinical"
  | "biological"
  | "bloodProducts"
  | "cellsAndTissues"
  | "dedicatedVehicle"
  | "whiteGlove"
  | "obc"
  | "nfo"
  | "charter"
  | "noFlip"
  | "noStack"
  | "keepUpright"
  | "moistureSensitive"
  | "lightSensitive"
  | "shockSensitive"
  | "dryIceRefill";
export type TempSeriesKey = "cryogenic" | "deepFrozen" | "frozen" | "chilled" | "ambient";

export const CARGO_TYPES: { id: CargoType; label: string; en: string; icon: typeof Package; tint: string }[] = [
  { id: "general", label: "מטען כללי", en: "General Cargo", icon: Package, tint: TONE_GRADIENT.muted },
  { id: "temperature", label: "מטען מבוקר טמפ'", en: "Temperature Controlled", icon: Thermometer, tint: TONE_GRADIENT.accent },
  { id: "nfo", label: "Next Flight Out", en: "NFO", icon: Zap, tint: TONE_GRADIENT.warning },
  { id: "live", label: "חיות חי", en: "Live Animals", icon: Rabbit, tint: TONE_GRADIENT.success },
  { id: "dangerous", label: "סחורות מסוכנות", en: "Dangerous Goods", icon: AlertTriangle, tint: TONE_GRADIENT.destructive },
  { id: "other", label: "אחר", en: "Other", icon: MoreHorizontal, tint: TONE_GRADIENT.primary },
];

export const ATTR_OPTIONS: { id: AttrKey; label: string; icon: typeof MapPin }[] = [
  { id: "coldchain", label: "שרשרת קירור", icon: Snowflake },
  { id: "valuable", label: "מטען יקר ערך", icon: Gem },
  { id: "gps", label: "GPS מטען", icon: MapPin },
  { id: "dangerous", label: "מטען מסוכן", icon: AlertTriangle },
  { id: "fragile", label: "מטען שביר", icon: PackageX },
  { id: "timeCritical", label: "מטען קריטי (Time Critical)", icon: Timer },
  { id: "dataLogger", label: "דורש Data Logger", icon: Activity },
  { id: "shockIndicator", label: "דורש Shock Indicator", icon: Vibrate },
  { id: "tiltIndicator", label: "דורש Tilt Indicator", icon: Gauge },
  { id: "humidityLogger", label: "דורש Humidity Logger", icon: Droplets },
  { id: "chainOfCustody", label: "דורש שרשרת אחזקה (Chain of Custody)", icon: Link },
  { id: "dryIce", label: "Dry Ice", icon: CloudSnow },
  { id: "cryogenic", label: "Cryogenic", icon: ThermometerSnowflake },
  { id: "signatureRequired", label: "דורש חתימה במסירה", icon: FileSignature },
  { id: "clinical", label: "משלוח קליני", icon: Stethoscope },
  { id: "biological", label: "חומר ביולוגי", icon: FlaskConical },
  { id: "bloodProducts", label: "דם ומוצרי דם", icon: Droplet },
  { id: "cellsAndTissues", label: "תאים ורקמות", icon: Dna },
  { id: "dedicatedVehicle", label: "דורש רכב ייעודי", icon: Truck },
  { id: "whiteGlove", label: "White Glove", icon: Hand },
  { id: "obc", label: "OBC", icon: Briefcase },
  { id: "nfo", label: "NFO", icon: Zap },
  { id: "charter", label: "Charter", icon: Plane },
  { id: "noFlip", label: "לא להפוך", icon: RotateCcw },
  { id: "noStack", label: "לא לערום", icon: PackageOpen },
  { id: "keepUpright", label: "להחזיק זקוף", icon: ArrowUp },
  { id: "moistureSensitive", label: "רגיש ללחות", icon: Droplets },
  { id: "lightSensitive", label: "רגיש לאור", icon: Sun },
  { id: "shockSensitive", label: "רגיש לזעזועים", icon: Waves },
  { id: "dryIceRefill", label: "נדרש מילוי קרח יבש", icon: CloudSnow },
];

export const TEMP_SERIES: { key: TempSeriesKey; label: string; range: string; icon: string }[] = [
  { key: "cryogenic", label: "Cryogenic", range: "≤ -150°C", icon: "❄️" },
  { key: "deepFrozen", label: "Deep Frozen", range: "≤ -80°C", icon: "🧊" },
  { key: "frozen", label: "Frozen", range: "-25°C עד -15°C", icon: "❄️" },
  { key: "chilled", label: "Chilled", range: "+2°C עד +8°C", icon: "🌡️" },
  { key: "ambient", label: "Ambient (CRT)", range: "+15°C עד +25°C", icon: "🏥" },
];

export const COOLGUARD_MODELS = [
  { model: "CoolGuard Advance 96L", payload: "96L", inner: "636×630×630", outer: "457×457×457", tare: "38 kg" },
  { model: "CoolGuard Advance 56L", payload: "56L", inner: "558×552×552", outer: "381×381×381", tare: "27 kg" },
  { model: "CoolGuard Advance 28L", payload: "28L", inner: "470×460×460", outer: "305×297×297", tare: "18 kg" },
  { model: "CoolGuard Advance 12L", payload: "12L", inner: "405×395×395", outer: "230×230×230", tare: "13 kg" },
  { model: "CoolGuard Advance 4L", payload: "4L", inner: "312×310×310", outer: "152×152×152", tare: "6 kg" },
];

// Dry-ice sample-transport packaging for Deep Frozen shipments (Intelsius
// BioTherm range). outer/tare are the published external dimensions (mm)
// and empty system mass from Intelsius's own spec sheet ("BioTherm Dry Ice
// Range" — BT074/BT077/BT041/BT049), same source format as the CoolGuard
// table below, so both catalogs can feed the same weight/volumetric-weight
// calculation instead of BioTherm always contributing zero.
export const BIOTHERM_MODELS = [
  { model: "BioTherm 7", category: "Category A / B", duration: "72 שעות", outer: "308×308×310", tare: "1.0 kg" },
  { model: "BioTherm 14", category: "Category A / B", duration: "96 שעות", outer: "385×380×395", tare: "1.7 kg" },
  { model: "BioTherm 15", category: "Category A", duration: "96+ שעות", outer: "403×396×416", tare: "1.9 kg" },
  { model: "BioTherm 30", category: "Category A / B", duration: "96+ שעות", outer: "465×458×478", tare: "2.5 kg" },
];

// A checked packaging model from the catalog above, with a quantity attached
// so it can contribute to the weight/volumetric summary like a regular
// package. productWeight is the actual goods' weight per unit (kg) packed
// inside the box — separate from the box's own empty tare weight — so the
// gross-weight total reflects package + product together, not just the
// packaging.
export type PackSelection = { key: string; qty: number; productWeight?: number };

// key format is "<tempSeries>:<model name>" (see the catalog tables below).
// deepFrozen always maps to the BioTherm catalog, every other series to
// CoolGuard — both catalogs share the same outer/tare shape, so one
// calculation covers them both.
export function getPackModelCalc(sel: PackSelection) {
  const modelName = sel.key.slice(sel.key.indexOf(":") + 1);
  const isBio = sel.key.startsWith("deepFrozen:");
  const catalog = isBio ? BIOTHERM_MODELS : COOLGUARD_MODELS;
  const m = catalog.find((x) => x.model === modelName);
  const productWeight = sel.productWeight ?? 0;
  if (!m) return { label: modelName, qty: sel.qty, grossWeight: sel.qty * productWeight, volumetricWeight: 0, dims: null as { length: number; width: number; height: number } | null };
  const tare = parseFloat(m.tare) || 0;
  const [outerL, outerW, outerH] = m.outer.split("×").map((v) => parseFloat(v) || 0);
  const hasDims = !!(outerL && outerW && outerH);
  const volumetricWeight = hasDims ? (sel.qty * outerL * outerW * outerH) / 6_000_000 : 0;
  const dims = hasDims ? { length: outerL / 10, width: outerW / 10, height: outerH / 10 } : null;
  return { label: m.model, qty: sel.qty, grossWeight: sel.qty * (tare + productWeight), volumetricWeight, dims };
}

export const PALLETS = [
  { id: "eur", label: "משטח יורו (EUR/EPAL)", size: "120 × 80 × 14.4 ס״מ", length: 120, width: 80, height: 14.4 },
  { id: "std", label: "משטח סטנדרטי", size: "120 × 100 × 15 ס״מ", length: 120, width: 100, height: 15 },
  { id: "half", label: "חצי משטח", size: "80 × 60 × 14.4 ס״מ", length: 80, width: 60, height: 14.4 },
  { id: "quarter", label: "רבע משטח", size: "60 × 40 × 14.4 ס״מ", length: 60, width: 40, height: 14.4 },
  { id: "custom", label: "מידה ידנית", size: "הזנה חופשית", length: null, width: null, height: null },
];

// IATA volumetric divisor for air freight, applied to cm³ → kg.
const VOLUMETRIC_DIVISOR_CM3_PER_KG = 6000;

export type PackageRow = {
  id: string;
  pallet: string | null;
  customLength: string;
  customWidth: string;
  customHeight: string;
  unitWeight: string;
  unitQty: string;
};

export function makePackageRow(): PackageRow {
  // unitQty defaults to "1" (not blank) so a freshly added package —
  // dims + weight filled in, quantity left untouched — immediately counts
  // toward the gross/volumetric weight summary as one real item, instead of
  // silently contributing zero until the person also remembers to type a
  // quantity (matches unitWeight's own "1" default, for the same reason).
  return { id: uid(), pallet: null, customLength: "", customWidth: "", customHeight: "", unitWeight: "1", unitQty: "1" };
}

// Resolves a package's L×W×H in cm, whether it came from a preset pallet or manual entry.
export function getPackageDimsCm(pkg: PackageRow): { length: number; width: number; height: number } | null {
  if (pkg.pallet === "custom") {
    const length = parseFloat(pkg.customLength);
    const width = parseFloat(pkg.customWidth);
    const height = parseFloat(pkg.customHeight);
    if (!length || !width || !height) return null;
    return { length, width, height };
  }
  const preset = PALLETS.find((p) => p.id === pkg.pallet);
  if (!preset || preset.length == null || preset.width == null || preset.height == null) return null;
  return { length: preset.length, width: preset.width, height: preset.height };
}

export function getPackageCalc(pkg: PackageRow) {
  const qty = parseFloat(pkg.unitQty) || 0;
  const unitWeight = parseFloat(pkg.unitWeight) || 0;
  const grossWeight = qty * unitWeight;
  const dims = getPackageDimsCm(pkg);
  const volumetricWeight = dims
    ? (qty * dims.length * dims.width * dims.height) / VOLUMETRIC_DIVISOR_CM3_PER_KG
    : 0;
  return { qty, unitWeight, grossWeight, volumetricWeight, dims };
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// Returns today + n days as "YYYY-MM-DD", for date-input defaults that
// should always be relative to the current date rather than hardcoded.
function addDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// -------- Packaging Recommendation Engine wiring --------
// Matches a package row's dimensions against the CoolGuard catalog (internal
// dims + a standard packing clearance) and ranks the fitting options.
// BioTherm isn't included here: Intelsius doesn't publish internal
// dimensions for that range, so there's nothing for the engine to fit against.
const PACKAGING_CLEARANCE_MM = 15;

const COOLGUARD_CATALOG: PackageModel[] = COOLGUARD_MODELS.map((m, idx) => {
  const [internalLength, internalWidth, internalHeight] = m.inner.split("×").map((v) => parseFloat(v) || 0);
  return {
    id: m.model.toLowerCase().replace(/\s+/g, "-"),
    manufacturer: "CoolGuard",
    model: m.model,
    internalLength,
    internalWidth,
    internalHeight,
    clearance: PACKAGING_CLEARANCE_MM,
    priority: idx + 1,
    active: true,
  };
});

const packagingRecommendationService = new PackagingRecommendationService();

// The UI stores package dims in cm; the catalog above is in mm (matches the
// CoolGuard inner/outer figures as published), so convert before matching.
export function getPackagingRecommendations(pkg: PackageRow, temperatureProfile?: string): PackageMatch[] {
  const dims = getPackageDimsCm(pkg);
  if (!dims) return [];
  const cargo = {
    length: dims.length * 10,
    width: dims.width * 10,
    height: dims.height * 10,
    weight: parseFloat(pkg.unitWeight) || undefined,
    temperatureProfile,
  };
  return packagingRecommendationService.recommend(cargo, COOLGUARD_CATALOG);
}

export function NewQuoteDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [step, setStep] = useState(1);
  const stepScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepScrollRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Step 2 state
  const [kind, setKind] = useState<ShipKind | null>(null);
  const [incoterm, setIncoterm] = useState<string | null>(null);
  const [shipmentTypeTag, setShipmentTypeTag] = useState<string | null>(null);
  const [cargo, setCargo] = useState<CargoRow[]>([{ id: uid(), sku: "", description: "", packaging: "", weight: "", notes: "" }]);
  const [containers, setContainers] = useState<ContainerRow[]>([{ id: uid(), type: "", sku: "", destination: "", weight: "" }]);
  const [goods, setGoods] = useState<GoodsRow[]>([{ id: uid(), item: "", sku: "", origin: "", weight: "", dims: "", qty: 1 }]);
  const [notes, setNotes] = useState("");
  // ד. פרטי משלוח — estimated pickup/delivery date+time window. Previously
  // rendered as plain uncontrolled <Field>s (no state, nothing saved,
  // nothing validated) — now real fields so "all details filled" can
  // actually be enforced before letting the user continue.
  const [pickupDateEst, setPickupDateEst] = useState("");
  const [pickupTimeEst, setPickupTimeEst] = useState("");
  const [deliveryDateEst, setDeliveryDateEst] = useState("");
  const [deliveryTimeEst, setDeliveryTimeEst] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [pickupContacts, setPickupContacts] = useState<ContactRow[]>([makeContactRow()]);
  const [deliveryContacts, setDeliveryContacts] = useState<ContactRow[]>([makeContactRow()]);
  const addPickupContact = () => setPickupContacts((arr) => [...arr, makeContactRow()]);
  const removePickupContact = (id: string) => setPickupContacts((arr) => (arr.length > 1 ? arr.filter((c) => c.id !== id) : arr));
  const updatePickupContact = (id: string, patch: Partial<ContactRow>) =>
    setPickupContacts((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addDeliveryContact = () => setDeliveryContacts((arr) => [...arr, makeContactRow()]);
  const removeDeliveryContact = (id: string) => setDeliveryContacts((arr) => (arr.length > 1 ? arr.filter((c) => c.id !== id) : arr));
  const updateDeliveryContact = (id: string, patch: Partial<ContactRow>) =>
    setDeliveryContacts((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Step 3 state — אופי המשלוח
  const [cargoType, setCargoType] = useState<CargoType | null>(null);
  const [attrs, setAttrs] = useState<Record<AttrKey, boolean>>({
    coldchain: true,
    valuable: false,
    gps: false,
    dangerous: false,
    fragile: false,
    timeCritical: false,
    dataLogger: false,
    shockIndicator: false,
    tiltIndicator: false,
    humidityLogger: false,
    chainOfCustody: false,
    dryIce: false,
    cryogenic: false,
    signatureRequired: false,
    clinical: false,
    biological: false,
    bloodProducts: false,
    cellsAndTissues: false,
    dedicatedVehicle: false,
    whiteGlove: false,
    obc: false,
    nfo: false,
    charter: false,
    noFlip: false,
    noStack: false,
    keepUpright: false,
    moistureSensitive: false,
    lightSensitive: false,
    shockSensitive: false,
    dryIceRefill: false,
  });
  const [packSelections, setPackSelections] = useState<PackSelection[]>([]);
  // Multiple temperature series can apply to one shipment (e.g. some cartons
  // Chilled, some Frozen) — "none" is mutually exclusive with the rest.
  const [tempSeriesList, setTempSeriesList] = useState<TempSeriesKey[]>([]);
  const [tempSeriesNone, setTempSeriesNone] = useState(false);
  const tempSeriesChosen = tempSeriesNone || tempSeriesList.length > 0;
  const toggleTempSeriesNone = () => {
    setTempSeriesNone(true);
    setTempSeriesList([]);
    setPackSelections([]);
  };
  const toggleTempSeries = (key: TempSeriesKey) => {
    setTempSeriesNone(false);
    setTempSeriesList((arr) => {
      const next = arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
      // Drop packaging picks tied to a series that just got deselected.
      setPackSelections((sels) => sels.filter((s) => next.some((k) => s.key.startsWith(`${k}:`))));
      return next;
    });
  };
  const getPackQty = (key: string) => packSelections.find((s) => s.key === key)?.qty ?? 0;
  const setPackQty = (key: string, qty: number) =>
    setPackSelections((arr) => {
      if (qty <= 0) return arr.filter((s) => s.key !== key);
      return arr.some((s) => s.key === key)
        ? arr.map((s) => (s.key === key ? { ...s, qty } : s))
        : [...arr, { key, qty }];
    });
  const getPackProductWeight = (key: string) => packSelections.find((s) => s.key === key)?.productWeight ?? "";
  const setPackProductWeight = (key: string, productWeight: number) =>
    setPackSelections((arr) => arr.map((s) => (s.key === key ? { ...s, productWeight } : s)));
  const packModelCalcs = useMemo(() => packSelections.map((sel) => getPackModelCalc(sel)), [packSelections]);
  const [packages, setPackages] = useState<PackageRow[]>([makePackageRow()]);
  const updatePackage = (id: string, patch: Partial<PackageRow>) =>
    setPackages((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addPackage = () => setPackages((rows) => [...rows, makePackageRow()]);
  const removePackage = (id: string) => setPackages((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  const packageCalcs = useMemo(() => packages.map((pkg) => ({ id: pkg.id, ...getPackageCalc(pkg) })), [packages]);
  const packageTotals = useMemo(() => {
    const grossWeight =
      packageCalcs.reduce((sum, c) => sum + c.grossWeight, 0) +
      packModelCalcs.reduce((sum, c) => sum + c.grossWeight, 0);
    const volumetricWeight =
      packageCalcs.reduce((sum, c) => sum + c.volumetricWeight, 0) +
      packModelCalcs.reduce((sum, c) => sum + c.volumetricWeight, 0);
    return { grossWeight, volumetricWeight, chargeableWeight: Math.max(grossWeight, volumetricWeight) };
  }, [packageCalcs, packModelCalcs]);
  const [specialReq, setSpecialReq] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  // Step 4 state — אופי לוגיסטי
  // Defaults assume an import (goods arriving into Israel), the more common
  // case — but for an export shipment that's backwards (it should start in
  // Israel, not end there), so a dedicated effect below flips them the
  // first time "ייצוא" is selected.
  const [originPort, setOriginPort] = useState("(JFK) New York, USA");
  const [destPort, setDestPort] = useState("(TLV) Tel Aviv, Israel");
  const portsSwappedForExport = useRef(false);
  useEffect(() => {
    if (kind !== "export" || portsSwappedForExport.current) return;
    portsSwappedForExport.current = true;
    setOriginPort("(TLV) Tel Aviv, Israel");
    setDestPort("(JFK) New York, USA");
  }, [kind]);
  const [transit, setTransit] = useState<string[]>([]);
  const [newTransit, setNewTransit] = useState("");
  const [departDate, setDepartDate] = useState(() => addDaysISO(3));
  const [arriveDate, setArriveDate] = useState(() => addDaysISO(5));
  const [services, setServices] = useState<Record<string, boolean>>({
    pickup: true, air: true, exportCustoms: true, importCustoms: true,
    clearance: true, land: true, delivery: true, insurance: true,
  });
  const [compare, setCompare] = useState<Record<string, boolean>>({});
  const [agent, setAgent] = useState("QUICKSTAT");
  const [agents, setAgents] = useState<string[]>([]);
  const [airline, setAirline] = useState("Lufthansa Cargo");
  // Journey mode for step 2's "ה. פרטי מסע" section — determines whether the
  // vessel/flight-name field there is replaced by an airline picker (feeding
  // the same `airline` state used later in step 4's "חברת תעופה מתוכננת").
  const [journeyMode, setJourneyMode] = useState<"air" | "land" | null>(null);
  // Step 2's "ה. פרטי מסע" (import only) — kept as its own state rather than
  // reusing step 4's originPort/destPort, since these describe the specific
  // journey/flight leg, not the shipment's overall origin/destination.
  // Previously uncontrolled <Field>s, same as the ד. section above.
  const [journeyOriginPort, setJourneyOriginPort] = useState("");
  const [journeyDestPort, setJourneyDestPort] = useState("");
  const [journeyVesselOrFlight, setJourneyVesselOrFlight] = useState("");
  const [journeyNumber, setJourneyNumber] = useState("");
  const [journeyCode, setJourneyCode] = useState("");
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [dropType, setDropType] = useState<DropTypeId | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  useEffect(() => {
    if (!dropType) { setStops([]); return; }
    setStops(seedStopsForDropType(dropType));
  }, [dropType]);
  useEffect(() => {
    if (kind !== "distribution" && dropType) setDropType(null);
  }, [kind, dropType]);
  const [routeApproved, setRouteApproved] = useState(false);
  const [shipmentMode, setShipmentMode] = useState<ShipmentMode | null>(null);
  // Step 5 state — תמחור
  const [currency, setCurrency] = useState<"USD" | "EUR" | "ILS">("USD");
  const [margin, setMargin] = useState<string>("15");
  const [pricingNotes, setPricingNotes] = useState("");
  const [pricingItems, setPricingItems] = useState<PricingItem[]>(() => DEFAULT_PRICING_ITEMS.map((r) => ({ ...r })));
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  // Changing the currency needs to stay consistent everywhere it's shown on
  // this step — the summary panel, the items table's per-row currency, and
  // any new row added afterward. This only relabels the currency (no FX
  // conversion, since no exchange-rate source is available); it keeps the
  // whole page showing one currency instead of a stale mix.
  const changeCurrency = (next: "USD" | "EUR" | "ILS") => {
    setCurrency(next);
    setPricingItems((rows) => rows.map((r) => ({ ...r, currency: next })));
  };
  // Step 6 state — סיכום
  const [discount, setDiscount] = useState<string>("0");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showFinishOptions, setShowFinishOptions] = useState(false);
  const navigate = useNavigate();
  const quoteCode = useMemo(
    () => `Q-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const createQuoteFn = useServerFn(createQuote);
  const listCustomersFn = useServerFn(listCustomers);
  const { user: currentUser } = useCurrentUser();
  const { data: customersList = [] } = useQuery({
    queryKey: ["customers", "quote-picker"],
    queryFn: () => listCustomersFn(),
    enabled: open,
  });

  const STATUS_LABEL_DB: Record<string, string> = { active: "פעיל", inactive: "לא פעיל", frozen: "מוקפא" };
  const STATUS_DOT_DB: Record<string, string> = {
    active: "bg-success",
    inactive: "bg-muted-foreground",
    frozen: "bg-accent",
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customersList;
    return customersList.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.customer_code.toLowerCase().includes(q) ||
        (c.company_id ?? "").toLowerCase().includes(q),
    );
  }, [query, customersList]);

  const canContinue = useMemo(() => {
    if (step === 1) return selectedId !== null;
    if (step === 2) {
      if (kind === null) return false;
      if (kind !== "domestic" && incoterm === null) return false;
      if (kind === "distribution" && dropType === null) return false;
      if (shipmentTypeTag === null) return false;
      if (!pickupDateEst || !pickupTimeEst || !deliveryDateEst || !deliveryTimeEst) return false;
      if (kind === "import") {
        if (journeyMode === null) return false;
        if (!journeyOriginPort.trim() || !journeyDestPort.trim()) return false;
        if (journeyMode === "air" ? !airline.trim() : !journeyVesselOrFlight.trim()) return false;
        if (!journeyNumber.trim() || !journeyCode.trim()) return false;
      }
      if (!pickupAddress.trim() || !pickupContacts.some((c) => c.name.trim())) return false;
      if (!deliveryAddress.trim() || !deliveryContacts.some((c) => c.name.trim())) return false;
      return true;
    }
    if (step === 3) {
      if (cargoType === null) return false;
      if (cargoType === "temperature") {
        if (!tempSeriesChosen) return false;
        if (tempSeriesList.length > 0 && packSelections.length === 0) return false;
      }
      if (packages.some((pkg) => pkg.pallet === null)) return false;
      return true;
    }
    if (step === 4) return shipmentMode !== null;
    return true;
  }, [
    step,
    selectedId,
    kind,
    incoterm,
    dropType,
    shipmentTypeTag,
    pickupDateEst,
    pickupTimeEst,
    deliveryDateEst,
    deliveryTimeEst,
    journeyMode,
    journeyOriginPort,
    journeyDestPort,
    journeyVesselOrFlight,
    journeyNumber,
    journeyCode,
    airline,
    pickupAddress,
    pickupContacts,
    deliveryAddress,
    deliveryContacts,
    cargoType,
    tempSeriesChosen,
    tempSeriesList,
    packSelections,
    packages,
    shipmentMode,
  ]);

  const reset = () => {
    setStep(1);
    setSelectedId(null);
    setQuery("");
    setKind(null);
    setIncoterm(null);
    setShipmentTypeTag(null);
    setDropType(null);
    setCargo([{ id: uid(), sku: "", description: "", packaging: "", weight: "", notes: "" }]);
    setContainers([{ id: uid(), type: "", sku: "", destination: "", weight: "" }]);
    setGoods([{ id: uid(), item: "", sku: "", origin: "", weight: "", dims: "", qty: 1 }]);
    setNotes("");
    setPickupDateEst("");
    setPickupTimeEst("");
    setDeliveryDateEst("");
    setDeliveryTimeEst("");
    setPickupAddress("");
    setDeliveryAddress("");
    setPickupContacts([makeContactRow()]);
    setDeliveryContacts([makeContactRow()]);
    setJourneyMode(null);
    setJourneyOriginPort("");
    setJourneyDestPort("");
    setJourneyVesselOrFlight("");
    setJourneyNumber("");
    setJourneyCode("");
    setCargoType(null);
    setTempSeriesList([]);
    setTempSeriesNone(false);
    setPackSelections([]);
    setPackages([makePackageRow()]);
    setShipmentMode(null);
    setShowFinishOptions(false);
  };

  async function handleFinish(action: "case" | "save" | "pdf") {
    try {
      setSubmitting(true);
      const customer = customersList.find((c) => c.id === selectedId);
      const totalCost = pricingItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
      const marginPct = Number(margin) || 0;
      const discountAmt = Number(discount) || 0;
      const total = totalCost * (1 + marginPct / 100) - discountAmt;
      const res = await createQuoteFn({
        data: {
          quoteCode,
          customerId: customer?.id ?? null,
          customerRef: customer?.customer_code ?? null,
          customerName: customer?.company_name ?? null,
          shipmentKind: kind,
          shipmentMode: shipmentMode ?? "direct",
          incoterm,
          originPort,
          destPort,
          transitPorts: transit,
          departDate,
          arriveDate,
          agent: kind === "distribution" ? (agents[0] ?? null) : agent,
          airline,
          currency,
          marginPct,
          total,
          payload: {
            accountManager: currentUser
              ? { name: currentUser.fullName || currentUser.email, email: currentUser.email }
              : null,
            pickupDateEst: pickupDateEst || null,
            pickupTimeEst: pickupTimeEst.trim() || null,
            deliveryDateEst: deliveryDateEst || null,
            deliveryTimeEst: deliveryTimeEst.trim() || null,
            pickupAddress: pickupAddress.trim() || null,
            deliveryAddress: deliveryAddress.trim() || null,
            pickupContacts: pickupContacts.filter((c) => c.name || c.phone || c.email),
            deliveryContacts: deliveryContacts.filter((c) => c.name || c.phone || c.email),
            journey:
              kind === "import"
                ? {
                    mode: journeyMode,
                    originPort: journeyOriginPort.trim() || null,
                    destPort: journeyDestPort.trim() || null,
                    vesselOrFlight: journeyMode === "land" ? journeyVesselOrFlight.trim() || null : null,
                    journeyNumber: journeyNumber.trim() || null,
                    journeyCode: journeyCode.trim() || null,
                  }
                : null,
            cargoType,
            shipmentTypeTag,
            attrs,
            tempSeriesList,
            tempSeriesNone,
            packSelections,
            agents: kind === "distribution" ? agents : [],
            packages: packages.map((pkg) => ({
              pallet: pkg.pallet,
              customDims: pkg.pallet === "custom"
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
            specialReq,
            extraNotes,
            services,
            compare,
            logisticsNotes,
            routeApproved,
            pricingItems,
            pricingNotes,
            discount: discountAmt,
            internalNotes,
            dropType,
            stops: normalizeStopsForPersist(stops),
          },
        },
      });
      toast.success(`הצעה ${res?.quote_code ?? quoteCode} נשמרה`);
      onSaved?.();
      setShowFinishOptions(false);
      onOpenChange(false);
      if (action === "pdf" && res?.id) {
        sessionStorage.setItem("autoprint-quote", res.id);
      }
      if ((action === "case" || action === "pdf") && res?.id) {
        navigate({ to: "/dashboard/quotes/$id", params: { id: res.id } });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירת ההצעה";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent dir="rtl" className="max-w-6xl p-0 overflow-hidden">
        <div className="border-b bg-muted/30 p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </span>
              {step === 1 ? "בחירת לקוח" : STEPS[step - 1].label}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "בחר את הלקוח עבור תיעוד הצעת המחיר"
                : `שלב ${step} מתוך 6 — הצעת מחיר חדשה`}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="mt-5 flex items-center justify-between gap-2" dir="ltr">
            {[...STEPS].reverse().map((s, idx) => {
              const done = s.n < step;
              const active = s.n === step;
              return (
                <div key={s.n} className="flex flex-1 items-center gap-2">
                  {idx > 0 && (
                    <div className={cn("h-px flex-1", s.n < step ? "bg-primary" : "bg-border")} />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition",
                        active && "bg-primary text-primary-foreground shadow",
                        done && "bg-primary/15 text-primary",
                        !active && !done && "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </div>
                    <span className={cn("text-[11px]", active ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={stepScrollRef} className="max-h-[60vh] overflow-y-auto p-6">
          {step === 1 && (
            <>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חפש לפי שם לקוח, קוד לקוח או ח.פ."
                  className="pr-9"
                />
              </div>
              <div className="rounded-xl border">
                {filtered.map((c, i) => {
                  const active = selectedId === c.id;
                  const palette = customerPalette(c.company_name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 px-4 py-3 text-right transition",
                        i > 0 && "border-t",
                        active ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold",
                            active ? "bg-primary text-primary-foreground" : cn(palette.bg, palette.text),
                          )}
                        >
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.company_name} className="h-full w-full object-cover" />
                          ) : (
                            customerInitials(c.company_name)
                          )}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{c.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.trade_name || c.industry || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_DB[c.status])} />
                            {STATUS_LABEL_DB[c.status]}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{c.customer_code}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {c.company_id && <span>ח.פ. {c.company_id}</span>}
                          {c.company_type && <span>· {c.company_type}</span>}
                        </div>
                        {c.website && (
                          <span className="max-w-[200px] truncate text-[11px] text-muted-foreground">{c.website}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">לא נמצאו לקוחות</div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* א. סוג משלוח */}
              <Section title="א. סוג משלוח *">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {SHIP_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = kind === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setKind(t.id)}
                        className={cn(
                          "relative overflow-hidden rounded-xl border p-4 text-right transition",
                          active ? "border-primary ring-2 ring-primary/20 shadow-sm" : "hover:border-primary/40 hover:bg-muted/30",
                        )}
                      >
                        <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white", t.gradient)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-semibold">{t.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</div>
                        {active && (
                          <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* ב. תנאי מכר — לא רלוונטי לפנים ארצי, ולא מוצג לפני שנבחר סוג משלוח */}
              {kind && kind !== "domestic" && (
                <Section title="ב. תנאי מכר (Incoterms 2020) *">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {INCOTERMS.map((t) => {
                      const active = incoterm === t.code;
                      return (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() => setIncoterm(t.code)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-right transition",
                            active ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                            )}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{t.code}</div>
                            <div className="text-[11px] leading-tight text-muted-foreground">{t.name}</div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground/80">{t.hint}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* סוג משלוח — תגית צבעונית, מתחת לתנאי המכר */}
              {kind && (
                <Section title="סוג משלוח *">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {SHIPMENT_TYPE_TAGS.map((t) => {
                      const active = shipmentTypeTag === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setShipmentTypeTag(active ? null : t.value)}
                          style={{ backgroundColor: t.bg, color: t.fg }}
                          className={cn(
                            "rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition",
                            active ? "ring-2 ring-primary ring-offset-2" : "opacity-90 hover:opacity-100",
                          )}
                        >
                          {t.value}
                        </button>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* ג. סוגי משלוחי דרופ — בחירה, רק כשנבחר סוג משלוח "דרופ" */}
              {kind === "distribution" && (
              <Section title="ג. סוגי משלוחי דרופ (Drop Types)">
                {(() => {
                  const dropTypeIds = Object.keys(DROP_TYPE_SPECS) as DropTypeId[];
                  const selectedSpec = dropType ? DROP_TYPE_SPECS[dropType] : null;
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {dropTypeIds.map((t) => {
                          const active = dropType === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDropType(active ? null : t)}
                              className={`rounded-lg border px-3 py-2 text-right text-sm transition ${
                                active
                                  ? "border-primary bg-primary/10 text-primary font-semibold"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      {dropType && selectedSpec && (
                        <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                          <div className="text-sm">
                            <span className="font-semibold">{dropType}</span>{" "}
                            <span className="text-muted-foreground">— {selectedSpec.desc}</span>
                          </div>
                          <StopsEditor
                            dropType={dropType}
                            stops={stops}
                            onChange={setStops}
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
              </Section>
              )}




              {/* ד. פרטי משלוח (משותף) */}
              <Section title="ד. פרטי משלוח *">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="תאריך איסוף משוער *"
                    type="date"
                    value={pickupDateEst}
                    onChange={(e) => setPickupDateEst(e.target.value)}
                  />
                  <Field
                    label="שעת איסוף *"
                    placeholder="09:00 – 12:00"
                    value={pickupTimeEst}
                    onChange={(e) => setPickupTimeEst(e.target.value)}
                  />
                  <Field
                    label="תאריך הגעה משוער *"
                    type="date"
                    value={deliveryDateEst}
                    onChange={(e) => setDeliveryDateEst(e.target.value)}
                  />
                  <Field
                    label="שעת הגעה *"
                    placeholder="14:00 – 18:00"
                    value={deliveryTimeEst}
                    onChange={(e) => setDeliveryTimeEst(e.target.value)}
                  />
                </div>
              </Section>

              {/* ה. פרטי מסע — ייבוא בלבד */}
              {kind === "import" && (
                <Section title="ה. פרטי מסע *">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">סוג מסע *</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setJourneyMode("air")}
                          className={cn(
                            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm transition",
                            journeyMode === "air" ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                          )}
                        >
                          <Plane className="h-3.5 w-3.5" /> אווירי
                        </button>
                        <button
                          type="button"
                          onClick={() => setJourneyMode("land")}
                          className={cn(
                            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-sm transition",
                            journeyMode === "land" ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                          )}
                        >
                          <Truck className="h-3.5 w-3.5" /> יבשתי
                        </button>
                      </div>
                    </div>
                    <Field label="נמל מוצא *" value={journeyOriginPort} onChange={(e) => setJourneyOriginPort(e.target.value)} />
                    <Field label="נמל יעד *" value={journeyDestPort} onChange={(e) => setJourneyDestPort(e.target.value)} />
                    {journeyMode === "air" ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">חברת תעופה *</Label>
                        <Lookup
                          type="airlines"
                          matchBy="code"
                          value={airline || null}
                          onChange={(item) => setAirline(item?.code ?? "")}
                          placeholder="בחר חברת תעופה..."
                        />
                      </div>
                    ) : (
                      <Field
                        label="שם כלי שיט / טיסה *"
                        value={journeyVesselOrFlight}
                        onChange={(e) => setJourneyVesselOrFlight(e.target.value)}
                      />
                    )}
                    <Field label="מספר מסע *" value={journeyNumber} onChange={(e) => setJourneyNumber(e.target.value)} />
                    <Field label="קוד מסע *" value={journeyCode} onChange={(e) => setJourneyCode(e.target.value)} />
                  </div>
                </Section>
              )}

              {/* ו. אנשי קשר — איסוף ומסירה, כל אחד תומך בכמה אנשי קשר */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Section title="איש קשר באיסוף *">
                  <Field label="כתובת איסוף *" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="רחוב, עיר, מדינה" />
                  <div className="mt-3 space-y-3">
                    {pickupContacts.map((c, idx) => (
                      <div key={c.id} className={cn("space-y-2", idx > 0 && "border-t pt-3")}>
                        {pickupContacts.length > 1 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">איש קשר {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removePickupContact(c.id)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> הסר
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Field label="שם *" value={c.name} onChange={(e) => updatePickupContact(c.id, { name: e.target.value })} />
                          <Field label="טלפון" type="tel" value={c.phone} onChange={(e) => updatePickupContact(c.id, { phone: e.target.value })} />
                          <Field label='דוא"ל' type="email" value={c.email} onChange={(e) => updatePickupContact(c.id, { email: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addPickupContact}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" /> הוסף איש קשר
                  </button>
                </Section>

                <Section title="איש קשר במסירה *">
                  <Field label="כתובת מסירה *" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="רחוב, עיר, מדינה" />
                  <div className="mt-3 space-y-3">
                    {deliveryContacts.map((c, idx) => (
                      <div key={c.id} className={cn("space-y-2", idx > 0 && "border-t pt-3")}>
                        {deliveryContacts.length > 1 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">איש קשר {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeDeliveryContact(c.id)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> הסר
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Field label="שם *" value={c.name} onChange={(e) => updateDeliveryContact(c.id, { name: e.target.value })} />
                          <Field label="טלפון" type="tel" value={c.phone} onChange={(e) => updateDeliveryContact(c.id, { phone: e.target.value })} />
                          <Field label='דוא"ל' type="email" value={c.email} onChange={(e) => updateDeliveryContact(c.id, { email: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addDeliveryContact}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4" /> הוסף איש קשר
                  </button>
                </Section>
              </div>

              <Section title="הערות">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות כלליות למשלוח…" rows={3} />
              </Section>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Section title="בחר סוג מטען" action={<span className="text-xs text-muted-foreground">בחר את סוג המטען שברצונך לשלוח</span>}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CARGO_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = cargoType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCargoType(t.id)}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border p-4 text-right transition",
                          active ? "border-primary ring-2 ring-primary/30 shadow-sm" : "hover:border-primary/40 hover:bg-muted/40",
                        )}
                      >
                        <div className={cn("mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm", t.tint)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-semibold">{t.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t.en}</div>
                        {active && (
                          <div className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="מאפייני מטען" action={<span className="text-xs text-muted-foreground">ניתן לבחור כמה שדרוש</span>}>
                <div className="flex flex-wrap gap-2">
                  {ATTR_OPTIONS.map((a) => {
                    const on = attrs[a.id];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAttrs((s) => ({ ...s, [a.id]: !s[a.id] }))}
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
              </Section>

              {cargoType === "temperature" && (
                <Section title="בחר אריזה" action={<span className="text-xs text-muted-foreground">אפשר לבחור כמה סדרות טמפרטורה במקביל</span>}>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={toggleTempSeriesNone}
                      className={cn("rounded-full border px-3 py-1 text-xs", tempSeriesNone ? "border-primary bg-primary/5" : "hover:bg-muted/40")}
                    >
                      ללא אריזה מוגדרת
                    </button>
                    {TEMP_SERIES.map((s) => {
                      const active = tempSeriesList.includes(s.key);
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => toggleTempSeries(s.key)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition",
                            active ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {active && <Check className="ml-1 inline h-3 w-3" />}
                          <span className="ml-1">{s.icon}</span>
                          <span className="font-medium text-foreground">{s.label}</span>
                          <span className="mr-2 text-muted-foreground">{s.range}</span>
                        </button>
                      );
                    })}
                  </div>

                  {tempSeriesList.length > 0 && (
                    <div className="space-y-4">
                      {tempSeriesList.map((series) => {
                        const seriesInfo = TEMP_SERIES.find((s) => s.key === series);
                        return (
                          <div key={series} className="overflow-x-auto rounded-lg border">
                            <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-1.5">
                              <span className="text-xs font-medium">
                                {seriesInfo?.icon} {seriesInfo?.label} <span className="text-muted-foreground">({seriesInfo?.range})</span>
                              </span>
                              <span className="text-[11px] text-muted-foreground">אפשר לבחור כמה סוגי אריזה שונים, כל אחד בכמות משלו</span>
                            </div>
                            {series === "deepFrozen" ? (
                              <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs text-muted-foreground">
                                  <tr>
                                    <th className="w-28 px-2 py-2 text-center font-medium">כמות</th>
                                    <th className="px-3 py-2 text-right font-medium">דגם</th>
                                    <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
                                    <th className="px-3 py-2 text-right font-medium">מידות חיצוניות</th>
                                    <th className="px-3 py-2 text-right font-medium">Tare</th>
                                    <th className="w-28 px-3 py-2 text-right font-medium">משקל מוצר (ק״ג)</th>
                                    <th className="px-3 py-2 text-right font-medium">משקל נפחי</th>
                                    <th className="px-3 py-2 text-right font-medium">משך</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {BIOTHERM_MODELS.map((m) => {
                                    const key = `${series}:${m.model}`;
                                    const qty = getPackQty(key);
                                    const productWeight = getPackProductWeight(key);
                                    const calc = qty > 0 ? getPackModelCalc({ key, qty, productWeight: Number(productWeight) || 0 }) : null;
                                    return (
                                      <tr key={m.model} className={cn("border-t transition", qty > 0 && "bg-primary/5")}>
                                        <td className="px-2 py-2">
                                          <PackQtyStepper value={qty} onChange={(v) => setPackQty(key, v)} />
                                        </td>
                                        <td className="px-3 py-2 font-medium">{m.model}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{m.category}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{m.outer}</td>
                                        <td className="px-3 py-2">{m.tare}</td>
                                        <td className="px-3 py-2">
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            disabled={qty === 0}
                                            value={productWeight}
                                            onChange={(e) => setPackProductWeight(key, Number(e.target.value) || 0)}
                                            className="w-20 rounded border bg-background px-2 py-1 text-sm disabled:opacity-40"
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {calc ? `${calc.volumetricWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג` : ""}
                                        </td>
                                        <td className="px-3 py-2">{m.duration}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-xs text-muted-foreground">
                                  <tr>
                                    <th className="w-28 px-2 py-2 text-center font-medium">כמות</th>
                                    <th className="px-3 py-2 text-right font-medium">דגם</th>
                                    <th className="px-3 py-2 text-right font-medium">Payload</th>
                                    <th className="px-3 py-2 text-right font-medium">מידות חיצוניות</th>
                                    <th className="px-3 py-2 text-right font-medium">Tare</th>
                                    <th className="w-28 px-3 py-2 text-right font-medium">משקל מוצר (ק״ג)</th>
                                    <th className="px-3 py-2 text-right font-medium">משקל נפחי</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {COOLGUARD_MODELS.map((m) => {
                                    const key = `${series}:${m.model}`;
                                    const qty = getPackQty(key);
                                    const productWeight = getPackProductWeight(key);
                                    const calc = qty > 0 ? getPackModelCalc({ key, qty, productWeight: Number(productWeight) || 0 }) : null;
                                    return (
                                      <tr key={m.model} className={cn("border-t transition", qty > 0 && "bg-primary/5")}>
                                        <td className="px-2 py-2">
                                          <PackQtyStepper value={qty} onChange={(v) => setPackQty(key, v)} />
                                        </td>
                                        <td className="px-3 py-2 font-medium">{m.model}</td>
                                        <td className="px-3 py-2">{m.payload}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{m.outer}</td>
                                        <td className="px-3 py-2">{m.tare}</td>
                                        <td className="px-3 py-2">
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            disabled={qty === 0}
                                            value={productWeight}
                                            onChange={(e) => setPackProductWeight(key, Number(e.target.value) || 0)}
                                            className="w-20 rounded border bg-background px-2 py-1 text-sm disabled:opacity-40"
                                          />
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {calc ? `${calc.volumetricWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג` : ""}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {packSelections.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {packModelCalcs.map((c, idx) => (
                        <span key={packSelections[idx].key} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                          <span className="font-medium">{c.qty}×</span> {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              <Section title="מידות ידניות מארז / משטח">
                <div className="space-y-4">
                  {packages.map((pkg, idx) => (
                    <div key={pkg.id} className={cn("relative", idx > 0 && "border-t pt-4")}>
                      {packages.length > 1 && (
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">חבילה {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removePackage(pkg.id)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> הסר חבילה
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {PALLETS.map((p) => {
                          const active = pkg.pallet === p.id;
                          const size = p.id === "custom" && pkg.customLength && pkg.customWidth && pkg.customHeight
                            ? `${pkg.customLength} × ${pkg.customWidth} × ${pkg.customHeight} ס״מ`
                            : p.size;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => updatePackage(pkg.id, { pallet: p.id })}
                              className={cn(
                                "rounded-lg border p-3 text-right transition",
                                active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                              )}
                            >
                              <div className="text-sm font-medium">{p.label}</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">{size}</div>
                            </button>
                          );
                        })}
                      </div>
                      {pkg.pallet === "custom" && (
                        <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3">
                          <Field label='אורך (ס"מ)' type="number" value={pkg.customLength} onChange={(e) => updatePackage(pkg.id, { customLength: e.target.value })} placeholder="120" />
                          <Field label='רוחב (ס"מ)' type="number" value={pkg.customWidth} onChange={(e) => updatePackage(pkg.id, { customWidth: e.target.value })} placeholder="80" />
                          <Field label='גובה (ס"מ)' type="number" value={pkg.customHeight} onChange={(e) => updatePackage(pkg.id, { customHeight: e.target.value })} placeholder="14.4" />
                        </div>
                      )}
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label='משקל ליחידה (ק"ג)' type="number" value={pkg.unitWeight} onChange={(e) => updatePackage(pkg.id, { unitWeight: e.target.value })} />
                        <Field label="כמות (יח')" type="number" value={pkg.unitQty} onChange={(e) => updatePackage(pkg.id, { unitQty: e.target.value })} placeholder="0" />
                      </div>
                      {cargoType === "temperature" && (() => {
                        const dims = getPackageDimsCm(pkg);
                        if (!dims) return null;
                        const matches = getPackagingRecommendations(pkg, tempSeriesList[0]);
                        const palletLabel = pkg.pallet === "custom"
                          ? `מידה ידנית ${dims.length}×${dims.width}×${dims.height} ס״מ`
                          : PALLETS.find((p) => p.id === pkg.pallet)?.label ?? "—";
                        const tempLabel = tempSeriesList.length > 0
                          ? tempSeriesList.map((k) => TEMP_SERIES.find((t) => t.key === k)?.label).filter(Boolean).join(" + ")
                          : "לא נבחרה סדרת טמפרטורה";
                        return (
                          <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                            <div className="mb-2 space-y-0.5">
                              <div className="text-xs font-medium text-muted-foreground">המלצת אריזה</div>
                              <div className="text-xs text-muted-foreground">
                                סוג מארז: <span className="font-medium text-foreground">{palletLabel}</span>
                                <span className="mx-1.5">·</span>
                                טמפרטורה: <span className="font-medium text-foreground">{tempLabel}</span>
                              </div>
                            </div>
                            {matches.length === 0 ? (
                              <p className="text-xs text-muted-foreground">לא נמצאה אריזה מהקטלוג שמתאימה למידות אלו.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {matches.slice(0, 3).map((m, rank) => (
                                  <div key={m.package.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
                                    <span className="flex items-center gap-2">
                                      <span className={cn(
                                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                                        rank === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                      )}>
                                        {rank + 1}
                                      </span>
                                      <span className="font-medium">{m.package.model}</span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      סבב {m.rotation} · ניצול {(m.utilization * 100).toLocaleString("he-IL", { maximumFractionDigits: 0 })}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPackage}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" /> הוסף חבילה
                </button>
              </Section>

              <Section title="סיכום משקלי ונפחי">
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-right font-medium">חבילה</th>
                        <th className="px-3 py-2 text-right font-medium">מידות (ס״מ)</th>
                        <th className="px-3 py-2 text-right font-medium">כמות</th>
                        <th className="px-3 py-2 text-right font-medium">משקל ברוטו</th>
                        <th className="px-3 py-2 text-right font-medium">משקל נפחי</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {packageCalcs.map((c, idx) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2">חבילה {idx + 1}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.dims ? `${c.dims.length} × ${c.dims.width} × ${c.dims.height}` : ""}
                          </td>
                          <td className="px-3 py-2">{c.qty ? c.qty : ""}</td>
                          <td className="px-3 py-2">{c.grossWeight ? `${c.grossWeight.toLocaleString("he-IL")} ק"ג` : ""}</td>
                          <td className="px-3 py-2">{c.volumetricWeight ? `${c.volumetricWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג` : ""}</td>
                        </tr>
                      ))}
                      {packModelCalcs.map((c, idx) => (
                        <tr key={packSelections[idx].key}>
                          <td className="px-3 py-2">{c.label}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {c.dims ? `${c.dims.length} × ${c.dims.width} × ${c.dims.height}` : ""}
                          </td>
                          <td className="px-3 py-2">{c.qty ? c.qty : ""}</td>
                          <td className="px-3 py-2">{c.grossWeight ? `${c.grossWeight.toLocaleString("he-IL")} ק"ג` : ""}</td>
                          <td className="px-3 py-2">{c.volumetricWeight ? `${c.volumetricWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">סה״כ משקל ברוטו</div>
                    <div className="mt-1 text-lg font-semibold">{packageTotals.grossWeight.toLocaleString("he-IL")} ק"ג</div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">סה״כ משקל נפחי</div>
                    <div className="mt-1 text-lg font-semibold">{packageTotals.volumetricWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג</div>
                  </div>
                  <div className="rounded-lg border border-primary bg-primary/5 p-3 text-center">
                    <div className="text-[11px] text-muted-foreground">משקל חייב (הגבוה מבין השניים)</div>
                    <div className="mt-1 text-lg font-semibold text-primary">{packageTotals.chargeableWeight.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ק"ג</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  חישוב המשקל הנפחי מבוסס על מקדם IATA לתובלה אווירית: (אורך × רוחב × גובה בס״מ) ÷ 6000.
                </p>
              </Section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Section title="דרישות מיוחדות">
                  <Textarea value={specialReq} onChange={(e) => setSpecialReq(e.target.value)} placeholder="הזן דרישות מיוחדות למשלוח…" rows={3} />
                </Section>
                <Section title="הערות">
                  <Textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} placeholder="הזן הערות נוספות…" rows={3} />
                </Section>
              </div>
            </div>
          )}

          {step === 4 && <Step4Logistics
            kind={kind}
            originPort={originPort} setOriginPort={setOriginPort}
            destPort={destPort} setDestPort={setDestPort}
            transit={transit} setTransit={setTransit}
            newTransit={newTransit} setNewTransit={setNewTransit}
            departDate={departDate} setDepartDate={setDepartDate}
            arriveDate={arriveDate} setArriveDate={setArriveDate}
            services={services} setServices={setServices}
            compare={compare} setCompare={setCompare}
            agent={agent} setAgent={setAgent}
            agents={agents} setAgents={setAgents}
            airline={airline} setAirline={setAirline}
            logisticsNotes={logisticsNotes} setLogisticsNotes={setLogisticsNotes}
            routeApproved={routeApproved} setRouteApproved={setRouteApproved}
            shipmentMode={shipmentMode} setShipmentMode={setShipmentMode}
          />}

          {step === 5 && (
            <Step5Pricing
              customerName={customersList.find((c) => c.id === selectedId)?.company_name ?? "—"}
              customerCode={customersList.find((c) => c.id === selectedId)?.customer_code ?? "—"}
              originPort={originPort}
              destPort={destPort}
              departDate={departDate}
              agent={agent}
              cargoTypeLabel={CARGO_TYPES.find((c) => c.id === cargoType)?.en ?? "—"}
              stackable={attrs.valuable ? "Stackable" : "Non-Stackable"}
              shipmentModeLabel={SHIPMENT_MODES.find((m) => m.id === shipmentMode)?.label ?? "—"}
              currency={currency} setCurrency={changeCurrency}
              margin={margin} setMargin={setMargin}
              items={pricingItems} setItems={setPricingItems}
              notes={pricingNotes} setNotes={setPricingNotes}
              dismissed={dismissedAlerts} setDismissed={setDismissedAlerts}
              hasInsurance={cargoType === "temperature"}
            />
          )}

          {step === 6 && (
            <Step6Summary
              quoteCode={quoteCode}
              customer={customersList.find((c) => c.id === selectedId) ?? null}
              kind={kind}
              shipmentMode={shipmentMode}
              originPort={originPort}
              destPort={destPort}
              departDate={departDate}
              arriveDate={arriveDate}
              agent={agent}
              airline={airline}
              cargoType={cargoType}
              tempSeriesList={tempSeriesList}
              pricingItems={pricingItems}
              currency={currency}
              margin={margin}
              discount={discount}
              setDiscount={setDiscount}
              internalNotes={internalNotes}
              setInternalNotes={setInternalNotes}
            />
          )}


        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            {step === 1 && (
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> לקוח פוטנציאלי חדש
              </Button>
            )}
            {!canContinue && !submitting && (
              <span className="text-xs text-muted-foreground">יש למלא את כל השדות המסומנים ב-* לפני שממשיכים</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                if (step <= 1) {
                  onOpenChange(false);
                  return;
                }
                // Domestic shipments skip step 4 (logistics mode) — going back
                // from step 5 should land on step 3, not the skipped step 4.
                setStep(step === 5 && kind === "domestic" ? 3 : step - 1);
              }}
            >
              <ArrowRight className="h-4 w-4" /> חזור
            </Button>
            <Button
              size="sm"
              className="gap-1"
              data-testid={step < 6 ? "wizard-next" : "wizard-finish"}
              disabled={!canContinue || submitting}
              onClick={() => {
                if (step >= 6) {
                  setShowFinishOptions(true);
                  return;
                }
                // Domestic shipments skip step 4 (logistics mode: direct/console/
                // transship) — not meaningful for a local pickup/delivery run.
                if (step === 3 && kind === "domestic") {
                  setShipmentMode((m) => m ?? "direct");
                  setStep(5);
                  return;
                }
                setStep(step + 1);
              }}
            >
              {step < 6 ? "המשך" : "סיום"} <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFinishOptions && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-1 text-base font-semibold">מה תרצה לעשות?</div>
              <div className="mb-4 text-sm text-muted-foreground">ההצעה תישמר, ולאחר מכן:</div>
              <div className="space-y-2">
                <button
                  type="button"
                  data-testid="finish-open-case"
                  disabled={submitting}
                  onClick={() => handleFinish("case")}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-right transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">פתח הצעה</span>
                    <span className="block text-xs text-muted-foreground">שמור ועבור לדף ההצעה</span>
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="finish-save"
                  disabled={submitting}
                  onClick={() => handleFinish("save")}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-right transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Save className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">שמור שינויים</span>
                    <span className="block text-xs text-muted-foreground">שמור וסגור</span>
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="finish-pdf"
                  disabled={submitting}
                  onClick={() => handleFinish("pdf")}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-right transition hover:border-primary/40 hover:bg-muted/40 disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileDown className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">ייצוא ל-PDF</span>
                    <span className="block text-xs text-muted-foreground">שמור וייצא כ-PDF</span>
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowFinishOptions(false)}
                className="mt-4 w-full rounded-lg py-2 text-center text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                {submitting ? "שומר..." : "ביטול"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --------- Stops editor (drop shipments) ---------

export function StopsEditor({
  dropType,
  stops,
  onChange,
}: {
  dropType: DropTypeId;
  stops: Stop[];
  onChange: (stops: Stop[]) => void;
}) {
  const spec = DROP_TYPE_SPECS[dropType];

  function update(id: string, patch: Partial<Stop>) {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function remove(id: string) {
    onChange(stops.filter((s) => s.id !== id));
  }
  function add(kind: StopKind) {
    onChange([...stops, makeStop(kind, stops.length)]);
  }
  function move(id: string, dir: -1 | 1) {
    const i = stops.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = stops.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const kindBadge: Record<StopKind, string> = {
    Pickup: "bg-success/15 text-success dark:bg-success/20/40 dark:text-success",
    Drop: "bg-accent/15 text-accent dark:bg-accent/20/40 dark:text-accent",
    Hub: "bg-warning/15 text-warning dark:bg-warning/20/40 dark:text-warning",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          נשמרים רק השדות הרלוונטיים לכל סוג תחנה ({spec.allowedKinds.join(" / ")}).
        </div>
        {spec.addable && (
          <div className="flex flex-wrap items-center gap-2">
            {spec.allowedKinds.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => add(k)}
              >
                <Plus className="h-3.5 w-3.5" /> {k}
              </Button>
            ))}
          </div>
        )}
      </div>

      {stops.length === 0 ? (
        <div className="rounded-md border border-dashed bg-background/60 p-4 text-center text-xs text-muted-foreground">
          אין תחנות. הוסף תחנה כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-3">
          {stops.map((stop, index) => {
            const fields = FIELDS_BY_KIND[stop.kind];
            return (
              <div key={stop.id} className="rounded-lg border bg-background/70 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold">
                      {index + 1}
                    </span>
                    <select
                      value={stop.kind}
                      onChange={(e) => update(stop.id, { kind: e.target.value as StopKind })}
                      className={`h-7 rounded-md px-2 text-xs font-medium ${kindBadge[stop.kind]}`}
                    >
                      {spec.allowedKinds.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(stop.id, -1)} disabled={index === 0} aria-label="הזז למעלה">↑</Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(stop.id, 1)} disabled={index === stops.length - 1} aria-label="הזז למטה">↓</Button>
                    {spec.addable && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(stop.id)} aria-label="מחק תחנה">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {fields.map((f) => (
                    <StopField
                      key={f}
                      field={f}
                      value={(stop as Record<string, string | undefined>)[f] ?? ""}
                      onChange={(v) => update(stop.id, { [f]: v } as Partial<Stop>)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StopField({
  field,
  value,
  onChange,
}: {
  field: StopField;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = STOP_FIELD_LABEL[field];
  if (field === "status") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {STOP_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "—"}</option>
          ))}
        </select>
      </div>
    );
  }
  const type =
    field === "etaAt" || field === "ataAt"
      ? "datetime-local"
      : field === "phone"
        ? "tel"
        : "text";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}


function updateRow<T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: string, patch: Partial<T>) {
  setter((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}
function removeRow<T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: string) {
  setter((rows) => (rows.length === 1 ? rows : rows.filter((r) => r.id !== id)));
}

function Section({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input className="h-9" {...rest} />
    </div>
  );
}

// Compact +/- quantity control used to pick "how many of this packaging type",
// letting several different types be added side by side (each with its own count).
// (Named distinctly from the pre-existing QtyStepper below, which clamps to a minimum of 1 —
// here 0 is a valid state meaning "not selected".)
export function PackQtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-muted disabled:opacity-30"
      >
        −
      </button>
      <span className={cn("w-5 text-center text-sm font-medium", value === 0 && "text-muted-foreground")}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-6 w-6 items-center justify-center rounded border text-sm hover:bg-muted"
      >
        +
      </button>
    </div>
  );
}

function RowTable({ headers, rows }: { headers: React.ReactNode[]; rows: { id: string; cells: React.ReactNode[] }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-right font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              {r.cells.map((c, i) => (
                <td key={i} className="px-2 py-2 align-middle">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowDelete({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" size="icon" variant="ghost" onClick={onClick} disabled={disabled} className="h-8 w-8 text-muted-foreground hover:text-destructive">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className="px-2 py-1 text-sm hover:bg-muted/50">−</button>
      <span className="min-w-[2ch] px-2 text-center text-sm">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="px-2 py-1 text-sm hover:bg-muted/50">+</button>
    </div>
  );
}

// ============ Step 4 — אופי לוגיסטי ============

export const SERVICE_LIST: { id: string; label: string }[] = [
  { id: "pickup", label: "איסוף מהמשלוח" },
  { id: "air", label: "הובלה אווירית" },
  { id: "exportCustoms", label: "מכס יצוא" },
  { id: "importCustoms", label: "מכס יבוא" },
  { id: "clearance", label: "שחרור מהמכס" },
  { id: "land", label: "הובלה יבשתית" },
  { id: "delivery", label: "מסירה ליעד" },
  { id: "insurance", label: "ביטוח בסיסי ($500)" },
];

const ALTERNATIVES = [
  { code: "TR", name: "Turkish Cargo", days: 4, price: "USD 3,450" },
  { code: "AE", name: "Emirates SkyCargo", days: 3, price: "USD 3,980" },
  { code: "QA", name: "Qatar Airways Cargo", days: 4, price: "USD 3,640" },
];

type Step4Props = {
  kind: ShipKind | null;
  originPort: string; setOriginPort: (v: string) => void;
  destPort: string; setDestPort: (v: string) => void;
  transit: string[]; setTransit: React.Dispatch<React.SetStateAction<string[]>>;
  newTransit: string; setNewTransit: (v: string) => void;
  departDate: string; setDepartDate: (v: string) => void;
  arriveDate: string; setArriveDate: (v: string) => void;
  services: Record<string, boolean>; setServices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  compare: Record<string, boolean>; setCompare: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  agent: string; setAgent: (v: string) => void;
  agents: string[]; setAgents: React.Dispatch<React.SetStateAction<string[]>>;
  airline: string; setAirline: (v: string) => void;
  logisticsNotes: string; setLogisticsNotes: (v: string) => void;
  routeApproved: boolean; setRouteApproved: (v: boolean) => void;
  shipmentMode: ShipmentMode | null; setShipmentMode: (v: ShipmentMode) => void;
};

function Step4Logistics(p: Step4Props) {
  const transitDays = useMemo(() => {
    const d1 = new Date(p.departDate); const d2 = new Date(p.arriveDate);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return isNaN(diff) ? 0 : Math.max(0, diff);
  }, [p.departDate, p.arriveDate]);

  const isDropShipment = p.kind === "distribution";
  const getAgentsByIdsFn = useServerFn(getLookupItemsByIds);
  const selectedAgentsQuery = useQuery({
    queryKey: ["lookup-selected-agents", p.agents],
    queryFn: () => getAgentsByIdsFn({ data: { type: "agents", ids: p.agents, by: "code" } }),
    enabled: isDropShipment && p.agents.length > 0,
  });
  const selectedAgentItems = selectedAgentsQuery.data ?? [];

  const routeCode = (s: string) => {
    const m = s.match(/\(([A-Z]{3})\)/);
    return m ? m[1] : s.slice(0, 3).toUpperCase();
  };
  const originCode = routeCode(p.originPort);
  const destCode = routeCode(p.destPort);

  const shipmentModes = SHIPMENT_MODES;
  const shipmentMode = p.shipmentMode;
  const setShipmentMode = p.setShipmentMode;

  return (
    <div className="space-y-6">
      <Section title="מסלול מוצע" action={<span className="text-xs text-muted-foreground">בחר את תוכנית המשלוח המועדפת</span>}>
        <div>
          <Label className="text-xs text-muted-foreground">סוג מסלול</Label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {shipmentModes.map((m) => {
              const on = shipmentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`mode-${m.id}`}
                  data-active={on ? "true" : "false"}
                  onClick={() => setShipmentMode(m.id)}
                  className={cn(
                    "rounded-lg border p-3 text-right transition",
                    on ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                  )}
                >
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AirportCombobox label="נמל מוצא *" value={p.originPort} onChange={p.setOriginPort} />
          <AirportCombobox label="נמל יעד *" value={p.destPort} onChange={p.setDestPort} />
        </div>


        <div className="mt-4">
          <Label className="text-xs text-muted-foreground">נמלי המשך (Transit)</Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {p.transit.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs">
                {t}
                <button type="button" onClick={() => p.setTransit((arr) => arr.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input value={p.newTransit} onChange={(e) => p.setNewTransit(e.target.value.toUpperCase())} placeholder="קוד נמל" className="h-8 w-24 text-xs" maxLength={4} />
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1"
                onClick={() => { if (p.newTransit.trim()) { p.setTransit((a) => [...a, p.newTransit.trim()]); p.setNewTransit(""); } }}>
                <Plus className="h-3 w-3" /> הוסף
              </Button>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">ניתן להוסיף נמלי ביניים על מנת לתכנן מסלול עם עצירות</div>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">{destCode}</span>
            {[...p.transit].reverse().map((t) => (
              <span key={t} className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                <span className="rounded-md bg-muted px-2 py-1">{t}</span>
              </span>
            ))}
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="rounded-md bg-muted px-2 py-1">{originCode}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="תאריך יציאה מתוכנן" type="date" value={p.departDate} onChange={(e) => p.setDepartDate(e.target.value)} />
          <Field label="תאריך הגעה מתוכנן" type="date" value={p.arriveDate} onChange={(e) => p.setArriveDate(e.target.value)} />
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border bg-gradient-to-l from-primary/5 to-transparent p-3">
          <div>
            <div className="text-xs text-muted-foreground">זמן מעבר משוער</div>
            <div className="text-lg font-semibold">{transitDays} ימים</div>
            <div className="text-[11px] text-muted-foreground">כולל ימי עבודה</div>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1">
            <Calendar className="h-3.5 w-3.5" /> הצג לוח זמנים מפורט
          </Button>
        </div>
      </Section>

      <Section title="אלטרנטיבות" action={<span className="text-xs text-muted-foreground">ניתן להוסיף חלופות למשלוח להשוואה</span>}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ALTERNATIVES.map((a) => {
            const on = !!p.compare[a.code];
            return (
              <div key={a.code} className={cn("rounded-lg border p-3 transition", on ? "border-primary bg-primary/5" : "hover:bg-muted/30")}>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{a.code}</span>
                  <span className="text-sm font-medium">{a.name}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {a.days} ימים</span>
                  <span className="font-medium text-foreground">{a.price}</span>
                </div>
                <button type="button"
                  onClick={() => p.setCompare((s) => ({ ...s, [a.code]: !s[a.code] }))}
                  className={cn("mt-2 w-full rounded-md border py-1 text-xs transition", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted/40")}>
                  {on ? "הוסר מהשוואה" : "הוסף להשוואה"}
                </button>
              </div>
            );
          })}
        </div>
        <button type="button" className="mt-3 text-xs text-primary hover:underline">הצג עוד חלופות ←</button>
      </Section>

      <Section title="שירותים כלולים" action={<Button type="button" variant="ghost" size="sm" className="h-7 text-xs">ערוך שירותים</Button>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SERVICE_LIST.map((s) => {
            const on = !!p.services[s.id];
            return (
              <button key={s.id} type="button"
                onClick={() => p.setServices((st) => ({ ...st, [s.id]: !st[s.id] }))}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-xs transition", on ? "border-primary bg-primary/5" : "hover:bg-muted/30 text-muted-foreground")}>
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                  {on && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="flex-1">{s.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Section
          title={isDropShipment ? "סוכנים מתווכים" : "סוכן מתווכן"}
          action={!isDropShipment && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs">פרטי סוכן מלאים</Button>}
        >
          {isDropShipment ? (
            <>
              <Lookup
                type="agents"
                matchBy="code"
                value={null}
                placeholder="הוסף סוכן..."
                onChange={(item) => {
                  if (!item) return;
                  p.setAgents((arr) => (arr.includes(item.code) ? arr : [...arr, item.code]));
                }}
              />
              {selectedAgentItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedAgentItems.map((item) => (
                    <span key={item.id} className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-1 pr-1 pl-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => p.setAgents((arr) => arr.filter((c) => c !== item.code))}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="font-medium">{item.name}</span>
                    </span>
                  ))}
                </div>
              )}
              {p.agents.length === 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">ניתן לבחור יותר מסוכן אחד למשלוחי דרופ (איסוף מסוכן אחד, מסירה לסוכן אחר וכו׳).</p>
              )}
            </>
          ) : (
            <>
              <Lookup
                type="agents"
                matchBy="code"
                value={p.agent || null}
                placeholder="בחר סוכן..."
                onChange={(item) => p.setAgent(item?.code ?? "")}
              />
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>סוג שירות: <span className="font-medium text-foreground">Premium</span></li>
                <li>סניף מטפל: <span className="font-medium text-foreground">TLV Office</span></li>
                <li>איש קשר: <span className="font-medium text-foreground">John Doe</span></li>
                <li>טלפון: <span className="font-medium text-foreground">+972-3-1234567</span></li>
                <li>דוא״ל: <span className="font-medium text-foreground">tlv@quickstat.com</span></li>
              </ul>
            </>
          )}
        </Section>

        <Section title="חברת תעופה מתוכננת">
          <Field label="שם חברת התעופה" value={p.airline} onChange={(e) => p.setAirline(e.target.value)} />
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>מספר טיסה: <span className="font-medium text-foreground">LH 401</span></li>
            <li>מסלול: <span className="font-medium text-foreground">JFK → FRA → TLV</span></li>
            <li>תדירות: <span className="font-medium text-foreground">יומי</span></li>
            <li>סוג מטוס: <span className="font-medium text-foreground">B777F</span></li>
            <li>יציאה משוערת: <span className="font-medium text-foreground">10/06/2025 22:30</span></li>
            <li>הגעה משוערת: <span className="font-medium text-foreground">11/06/2025 18:15</span></li>
          </ul>
        </Section>
      </div>

      <Section title="הערות תכנון לוגיסטי *">
        <Textarea value={p.logisticsNotes} onChange={(e) => p.setLogisticsNotes(e.target.value)} maxLength={500} rows={3} placeholder="הזן הערות לגבי תכנון הלוגיסטיקה..." />
        <div className="mt-1 text-left text-[11px] text-muted-foreground">{p.logisticsNotes.length}/500</div>
      </Section>

      <label className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <input type="checkbox" checked={p.routeApproved} onChange={(e) => p.setRouteApproved(e.target.checked)} className="h-4 w-4 rounded border-muted-foreground/30 accent-primary" />
        <span>אישרתי את המסלול המוצע</span>
        <Route className="mr-auto h-4 w-4 text-muted-foreground" />
      </label>
    </div>
  );
}

// ============ Step 5 — תמחור ============

type PriceSource = "pricelist" | "rfq" | "manual" | "missing";
export type PricingItem = {
  id: string;
  group: string;
  label: string;
  source: PriceSource;
  sourceLabel: string;
  sourceDate: string;
  currency: "USD" | "EUR" | "ILS";
  price: number;
  stale?: boolean;
};

const DEFAULT_PRICING_ITEMS: PricingItem[] = [
  { id: "p1", group: "הובלה אווירית", label: "הובלה אווירית", source: "rfq", sourceLabel: "RFQ - QuickSTAT", sourceDate: "2025-05-05", currency: "USD", price: 2850 },
  { id: "p2", group: "טיפול נמל", label: "טיפול נמל", source: "pricelist", sourceLabel: "Price List", sourceDate: "2025-05-20", currency: "USD", price: 285 },
  { id: "p3", group: "דמי איסוף", label: "דמי איסוף", source: "rfq", sourceLabel: "RFQ - QuickSTAT", sourceDate: "2025-06-06", currency: "USD", price: 65 },
  { id: "p4", group: "דמי טיפול", label: "דמי טיפול", source: "pricelist", sourceLabel: "Price List", sourceDate: "2025-05-20", currency: "USD", price: 45 },
  { id: "p5", group: "דמי מסירה", label: "דמי מסירה", source: "pricelist", sourceLabel: "Price List", sourceDate: "2025-05-20", currency: "USD", price: 120 },
  { id: "p6", group: "ביטוח מטען", label: "ביטוח מטען", source: "missing", sourceLabel: "חסר Price List", sourceDate: "", currency: "USD", price: 0 },
  { id: "p7", group: "טיפול נמל יעד", label: "טיפול נמל יעד", source: "pricelist", sourceLabel: "Terminal Handling (Destination)", sourceDate: "2025-05-20", currency: "USD", price: 85 },
  { id: "p8", group: "איסוף", label: "איסוף", source: "pricelist", sourceLabel: "Pickup Fee", sourceDate: "2025-05-20", currency: "USD", price: 150 },
  { id: "p9", group: "דמי ניהול", label: "דמי ניהול", source: "pricelist", sourceLabel: "Price List", sourceDate: "2025-05-20", currency: "USD", price: 75 },
  { id: "p10", group: "טיפול מסמכים", label: "טיפול מסמכים", source: "pricelist", sourceLabel: "Price List", sourceDate: "2025-05-20", currency: "USD", price: 45 },
  { id: "p11", group: "אריזה חיוונית", label: "אריזה חיוונית", source: "pricelist", sourceLabel: "Packaging (CoolGuard 60L)", sourceDate: "2025-05-20", currency: "USD", price: 180 },
  { id: "p12", group: "בקרת טמפרטורה", label: "בקרת טמפרטורה", source: "pricelist", sourceLabel: "Temperature Logger", sourceDate: "2025-05-20", currency: "USD", price: 95 },
  { id: "p13", group: "היטל דלק", label: "היטל דלק", source: "pricelist", sourceLabel: "Fuel Surcharge", sourceDate: "2025-04-08", currency: "USD", price: 60, stale: true },
];

const SOURCE_META: Record<PriceSource, { label: string; dot: string; row: string }> = {
  pricelist: { label: "Price List", dot: "bg-accent", row: "" },
  rfq: { label: "RFQ", dot: "bg-success", row: "" },
  manual: { label: "ידני", dot: "bg-warning", row: "" },
  missing: { label: "חסר מקור", dot: "bg-destructive", row: "bg-destructive/10/60" },
};

type Step5Props = {
  customerName: string;
  customerCode: string;
  originPort: string;
  destPort: string;
  departDate: string;
  agent: string;
  cargoTypeLabel: string;
  stackable: string;
  shipmentModeLabel: string;
  currency: "USD" | "EUR" | "ILS";
  setCurrency: (v: "USD" | "EUR" | "ILS") => void;
  margin: string;
  setMargin: (v: string) => void;
  items: PricingItem[];
  setItems: React.Dispatch<React.SetStateAction<PricingItem[]>>;
  notes: string;
  setNotes: (v: string) => void;
  dismissed: Record<string, boolean>;
  setDismissed: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  hasInsurance: boolean;
};

function Step5Pricing(p: Step5Props) {
  const total = p.items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const marginPct = Number(p.margin) || 0;
  const profit = total * (marginPct / 100);
  const customerPrice = total + profit;
  const profitRate = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;

  const sourceCounts = p.items.reduce<Record<PriceSource, number>>(
    (acc, i) => ({ ...acc, [i.source]: (acc[i.source] || 0) + 1 }),
    { pricelist: 0, rfq: 0, manual: 0, missing: 0 },
  );

  const alerts = [
    ...p.items.filter((i) => i.source === "missing").map((i) => ({
      id: `missing-${i.id}`,
      tone: "rose" as const,
      title: `חסר מחיר: ${i.label}`,
      badge: "לא נמצא ב-Price List",
      body: "הפריט \"ביטוח מטען\" לא קיים במחירון של הסוכן. הזן מחיר ידני, בקש RFQ מהסוכן, או הסר את הפריט לפני שליחה.",
      action: "מלא מחיר",
    })),
    ...p.items.filter((i) => i.stale).map((i) => ({
      id: `stale-${i.id}`,
      tone: "amber" as const,
      title: `מחיר ישן: ${i.label}`,
      badge: `03 ימים (${i.sourceDate})`,
      body: `תוקף התעריף עבור \"${i.label}\" פג לפני 33 ימים. רענן את ה-Price List או בקש עדכון מהסוכן.`,
      action: "רענן תעריף",
    })),
    ...(!p.hasInsurance
      ? [{
          id: "no-insurance",
          tone: "rose" as const,
          title: "אין כיסוי ביטוחי",
          badge: "",
          body: "משלוח Temperature Controlled ללא ביטוח מטען מהווה חשיפה. הוסף פריט ביטוח או קבל אישור בכתב מהלקוח על ויתור.",
          action: "הוסף ביטוח",
        }]
      : []),
  ].filter((a) => !p.dismissed[a.id]);

  const addRow = () =>
    p.setItems((rows) => [...rows, {
      id: uid(), group: "פריט חדש", label: "פריט חדש", source: "manual",
      sourceLabel: "ידני", sourceDate: new Date().toISOString().slice(0, 10),
      currency: p.currency, price: 0,
    }]);

  const removeRow = (id: string) =>
    p.setItems((rows) => rows.filter((r) => r.id !== id));

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Summary chips bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
        <SummaryChip icon={Building2} label="לקוח" value={p.customerName} sub={p.customerCode} />
        <SummaryChip icon={Route} label="מסלול" value={`${extractCode(p.originPort)} → ${extractCode(p.destPort)}`} sub={p.departDate} />
        <SummaryChip icon={Route} label="סוג מסלול" value={p.shipmentModeLabel} />
        <SummaryChip icon={Tag} label="סוכן" value={p.agent} />
        <SummaryChip icon={Package} label="סוג משלוח" value={p.cargoTypeLabel} />
        <SummaryChip icon={X} label="מטען" value={p.stackable} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Right column (RTL) — items table (spans 2) */}
        <div className="space-y-4 lg:col-span-2">
          <Section
            title={<span className="flex items-center gap-2">פריטים ועלויות <Info className="h-3.5 w-3.5 text-muted-foreground" /></span> as unknown as string}
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">מטבע</span>
                <select value={p.currency} onChange={(e) => p.setCurrency(e.target.value as "USD" | "EUR" | "ILS")} className="h-8 rounded-md border bg-background px-2 text-xs">
                  <option>USD</option><option>EUR</option><option>ILS</option>
                </select>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-3 py-2 text-right font-medium">סכום</th>
                    <th className="px-3 py-2 text-right font-medium">מטבע</th>
                    <th className="px-3 py-2 text-right font-medium">מקור מחיר</th>
                    <th className="px-3 py-2 text-right font-medium">קבוצות עלויות</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((it) => {
                    const meta = SOURCE_META[it.source];
                    return (
                      <tr key={it.id} className={cn("border-t", meta.row, it.stale && "bg-warning/10/60")}>
                        <td className="px-2 py-2 text-muted-foreground"><GripVertical className="h-4 w-4" /></td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={it.price}
                            onChange={(e) => p.setItems((rows) => rows.map((r) => r.id === it.id ? { ...r, price: Number(e.target.value) } : r))}
                            className={cn("h-8 w-24 rounded-md border bg-background px-2 text-right text-sm", it.source === "missing" && "border-destructive/40 text-destructive")}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{it.currency}</td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center justify-end gap-2">
                            {it.sourceDate && <span className="text-[10px] text-muted-foreground">{it.sourceDate}</span>}
                            <span className={cn(it.source === "missing" && "text-destructive", it.stale && "text-warning")}>
                              {it.sourceLabel}
                            </span>
                            {it.source === "missing" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                            {it.stale && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">{it.label}</td>
                        <td className="px-2 py-2 text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => removeRow(it.id)}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="מחק פריט"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td></td>
                    <td className="px-2 py-2 text-right">{fmt(total)}</td>
                    <td className="px-3 py-2 text-xs">{p.currency}</td>
                    <td className="px-3 py-2 text-right text-sm" colSpan={2}>סה"כ עלויות</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRow}>
                <Plus className="h-4 w-4" /> הוספת פריט
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" /> הוספת קבוצת עלויות
              </Button>
              <Button type="button" size="sm" variant="ghost" className="gap-1">
                <RefreshCw className="h-4 w-4" /> רענן תעריפים
              </Button>
            </div>
          </Section>
        </div>

        {/* Left column — summary + source + alerts */}
        <div className="space-y-4">
          <Section title={<span className="flex items-center gap-2">סיכום מחיר <Info className="h-3.5 w-3.5 text-muted-foreground" /></span> as unknown as string}
            action={
              <select value={p.currency} onChange={(e) => p.setCurrency(e.target.value as "USD" | "EUR" | "ILS")} className="h-8 rounded-md border bg-background px-2 text-xs">
                <option>USD</option><option>EUR</option><option>ILS</option>
              </select>
            }>
            <div className="space-y-2 text-sm">
              <SumLine label="סה״כ עלויות" value={fmt(total)} />
              <SumLine label="הוצאות נלוות" value="120.00" muted />
              <SumLine label="סה״כ עלויות" value={fmt(total + 120)} bold />
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">רווח מוצע (%)</span>
                <input type="number" value={p.margin} onChange={(e) => p.setMargin(e.target.value)} className="h-8 w-16 rounded-md border bg-background px-2 text-right text-sm" />
              </div>
              <SumLine label="סכום רווח" value={fmt(profit)} />
              <div className="rounded-lg border border-success/25 bg-success/10 p-3 text-center">
                <div className="text-[11px] text-success">מחיר מוצע ללקוח</div>
                <div className="mt-1 text-2xl font-bold text-success">{fmt(customerPrice)} {p.currency}</div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">שיעור רווח</span>
                <span className="font-semibold">{profitRate.toFixed(2)}%</span>
              </div>
            </div>
          </Section>

          <div className="rounded-xl border border-destructive/25 bg-destructive/10/70 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="text-xs">
                <div className="font-semibold text-destructive">חסרים תיקונים לפני שליחה</div>
                <div className="text-destructive/80">
                  {alerts.filter((a) => a.tone === "rose").length} קריטי · {alerts.filter((a) => a.tone === "amber").length} אזהרה · {p.items.length} פריטים · שיעור רווח {profitRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <Section title="מקור מחיר">
            <ul className="space-y-2 text-sm">
              <SourceLine dot="bg-accent" label="Price List" count={sourceCounts.pricelist} />
              <SourceLine dot="bg-success" label="RFQ" count={sourceCounts.rfq} />
              <SourceLine dot="bg-warning" label="ידני" count={sourceCounts.manual} />
              <SourceLine dot="bg-destructive" label="חסר מקור" count={sourceCounts.missing} />
            </ul>
          </Section>

          <Section title={<span>התראות והמלצות <span className="mr-1 text-xs text-muted-foreground">{alerts.length} סה״כ</span></span> as unknown as string}>
            <div className="space-y-3">
              {alerts.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">אין התראות פתוחות</div>
              )}
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-lg border p-3 text-xs",
                    a.tone === "rose" && "border-destructive/25 bg-destructive/10/70",
                    a.tone === "amber" && "border-warning/25 bg-warning/10/70",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className={cn("flex items-center gap-1.5 font-semibold", a.tone === "rose" ? "text-destructive" : "text-warning")}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {a.title}
                    </div>
                    {a.badge && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", a.tone === "rose" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <p className="mb-2 text-muted-foreground">{a.body}</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs">{a.action}</Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => p.setDismissed((d) => ({ ...d, [a.id]: true }))}
                    >
                      אשר בכל זאת
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Section title="הערות">
        <Textarea value={p.notes} onChange={(e) => p.setNotes(e.target.value)} placeholder="הזן הערות להצעת המחיר…" rows={3} />
        <div className="mt-1 text-left text-[11px] text-muted-foreground">{p.notes.length}/500</div>
      </Section>

      {alerts.filter((a) => a.tone === "rose").length > 0 && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10/70 px-3 py-2 text-xs text-destructive">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          יש לתקן {alerts.filter((a) => a.tone === "rose").length} התראות קריטיות לפני המשך
        </div>
      )}
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, sub }: { icon: typeof Building2; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="text-right">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="font-semibold text-foreground">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function SumLine({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", muted && "text-muted-foreground", bold && "font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SourceLine({ dot, label, count }: { dot: string; label: string; count: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{count} פריטים</span>
    </li>
  );
}

function extractCode(port: string) {
  const m = port.match(/\(([^)]+)\)/);
  return m ? m[1] : port;
}

// ============ Step 6 — סיכום ============
const KIND_LABEL: Record<ShipKind, string> = {
  export: "ייצוא",
  import: "ייבוא",
  distribution: "משלוחי דרופ",
  domestic: "פנים ארצי",
};
const MODE_LABEL: Record<ShipmentMode, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};
const CARGO_LABEL: Record<CargoType, string> = {
  general: "כללי",
  temperature: "בקרת טמפרטורה",
  fragile: "שביר",
  danger: "מסוכן",
  oversize: "חריג",
} as unknown as Record<CargoType, string>;

type Step6Props = {
  quoteCode: string;
  customer: { id: string; company_name: string; customer_code: string } | null;
  kind: ShipKind | null;
  shipmentMode: ShipmentMode | null;
  originPort: string;
  destPort: string;
  departDate: string;
  arriveDate: string;
  agent: string;
  airline: string;
  cargoType: CargoType | null;
  tempSeriesList: TempSeriesKey[];
  pricingItems: PricingItem[];
  currency: "USD" | "EUR" | "ILS";
  margin: string;
  discount: string;
  setDiscount: (v: string) => void;
  internalNotes: string;
  setInternalNotes: (v: string) => void;
};

function Step6Summary(p: Step6Props) {
  const now = new Date();
  const validUntil = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtDT = (d: Date) =>
    d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const groups = new Map<string, number>();
  for (const it of p.pricingItems) {
    const key = it.group || it.label || "אחר";
    groups.set(key, (groups.get(key) ?? 0) + (Number(it.price) || 0));
  }
  const totalCost = Array.from(groups.values()).reduce((s, v) => s + v, 0);
  const marginPct = Number(p.margin) || 0;
  const marginAmt = totalCost * (marginPct / 100);
  const beforeDiscount = totalCost + marginAmt;
  const discountAmt = Number(p.discount) || 0;
  const grandTotal = beforeDiscount - discountAmt;
  const money = (n: number) =>
    `${p.currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const tempLabel = p.tempSeriesList.length > 0
    ? p.tempSeriesList.map((k) => TEMP_SERIES.find((t) => t.key === k)?.label).filter(Boolean).join(" + ")
    : null;

  return (
    <div className="space-y-4" data-testid="wizard-step-6">
      {/* Top status ribbon */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 md:grid-cols-5">
        <SumStat label="מספר הצעה" value={<span className="font-mono">{p.quoteCode}</span>} />
        <SumStat
          label="סטטוס"
          value={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <Check className="h-3 w-3" /> מוכן לאישור
            </span>
          }
        />
        <SumStat label="תאריך יצירה" value={fmtDT(now)} />
        <SumStat label="תוקף הצעה" value={`${fmtDate(validUntil)} (7 ימים)`} />
        <SumStat
          label='סה"כ להצעה'
          value={<span className="text-base font-bold text-primary">{money(grandTotal)}</span>}
          hint={`שיעור רווח: ${(totalCost > 0 ? (marginAmt / beforeDiscount) * 100 : 0).toFixed(2)}%`}
        />
      </div>

      {/* Customer preview */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" /> תצוגה מקדימה להצעה ללקוח
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">לכבוד</div>
            <div className="mt-1 text-sm font-medium">{p.customer?.company_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {p.customer?.customer_code ?? ""}
            </div>
          </div>
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">תאריך:</span>
              <span>{fmtDate(now)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">תוקף:</span>
              <span>{fmtDate(validUntil)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-medium">מסלול</th>
                <th className="px-3 py-2 text-right font-medium">תאריך יציאה</th>
                <th className="px-3 py-2 text-right font-medium">תאריך הגעה</th>
                <th className="px-3 py-2 text-right font-medium">סוג משלוח</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 font-medium">
                  {extractCode(p.originPort)} → {extractCode(p.destPort)}
                </td>
                <td className="px-3 py-2">{p.departDate || "—"}</td>
                <td className="px-3 py-2">{p.arriveDate || "—"}</td>
                <td className="px-3 py-2">
                  {p.cargoType ? (CARGO_LABEL[p.cargoType] ?? p.cargoType) : "—"}
                  {tempLabel ? ` · ${tempLabel}` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {p.kind && <Chip>{KIND_LABEL[p.kind]}</Chip>}
          {p.shipmentMode && <Chip>{MODE_LABEL[p.shipmentMode]}</Chip>}
          {p.agent ? <Chip>סוכן: {p.agent}</Chip> : null}
          {p.airline ? <Chip>מוביל: {p.airline}</Chip> : null}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <DollarSign className="h-4 w-4 text-primary" /> סיכום עלויות
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-medium">תיאור</th>
                <th className="px-3 py-2 text-right font-medium">מטבע</th>
                <th className="px-3 py-2 text-left font-medium">סכום</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groups.entries()).map(([g, v]) => (
                <tr key={g} className="border-t">
                  <td className="px-3 py-2">{g}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.currency}</td>
                  <td className="px-3 py-2 text-left font-medium">{money(v)}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30">
                <td className="px-3 py-2 font-semibold">סה"כ עלויות</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-left font-semibold">{money(totalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          * ההצעה אינה כוללת מע"מ אלא אם צוין אחרת
        </div>
      </div>

      {/* Totals + risk + notes */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 md:col-span-2">
          <div className="mb-3 text-sm font-semibold">סיכום הצעה</div>
          <div className="space-y-1.5 text-sm">
            <Row k="סה״כ עלויות" v={money(totalCost)} />
            <Row k={`רווח מוצע (${marginPct.toFixed(2)}%)`} v={money(marginAmt)} />
            <Row k="סה״כ לפני הנחות" v={money(beforeDiscount)} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">הנחות</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-8 w-28 text-left"
                  value={p.discount}
                  onChange={(e) => p.setDiscount(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">{p.currency}</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-bold">
              <span>סה״כ להצעה</span>
              <span className="text-primary">{money(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-success" /> רמת סיכון
          </div>
          <div className="inline-flex rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            נמוכה
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> כל התנאים מולאו</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> שיעור רווח תקין</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> אין חריגות</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> אישורי סוכן קיימים</li>
          </ul>
          <div className="mt-3 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
            אין דרישות לאישור מנהל — ניתן לאשר את ההצעה
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">הערות פנימיות</div>
        <Textarea
          value={p.internalNotes}
          onChange={(e) => p.setInternalNotes(e.target.value.slice(0, 500))}
          placeholder="הוסף הערות פנימיות להצעה זו..."
          rows={3}
        />
        <div className="mt-1 text-left text-[11px] text-muted-foreground">
          {p.internalNotes.length}/500
        </div>
      </div>
    </div>
  );
}

function SumStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}


