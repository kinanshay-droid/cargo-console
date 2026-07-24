import { useEffect, useMemo, useState } from "react";
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
import {
  customerInitials,
  customerPalette,
} from "@/lib/customers-demo";
import { AirportCombobox } from "@/components/airport-combobox";

const STEPS = [
  { n: 1, label: "לקוח" },
  { n: 2, label: "פרטי המשלוח" },
  { n: 3, label: "אופיי המשלוח" },
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
  { id: "export", label: "ייצוא", desc: "משלוח יוצא מישראל", icon: Plane, gradient: "from-sky-500 to-blue-600" },
  { id: "import", label: "ייבוא", desc: "משלוח נכנס לישראל", icon: Ship, gradient: "from-indigo-500 to-violet-600" },
  { id: "distribution", label: "משלוחי דרופ", desc: "דרופ ואיסופים בארץ", icon: PackageOpen, gradient: "from-emerald-500 to-teal-600" },
  { id: "domestic", label: "פנים ארצי", desc: "משלוח / נסיעה בישראל", icon: Truck, gradient: "from-amber-500 to-orange-600" },
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

// -------- Step 3: אופי המשלוח --------
type CargoType = "general" | "temperature" | "nfo" | "live" | "dangerous" | "other";
type AttrKey = "gps" | "valuable" | "coldchain" | "dangerous";
type TempSeriesKey = "s20m" | "s22" | "s4";

const CARGO_TYPES: { id: CargoType; label: string; en: string; icon: typeof Package; tint: string }[] = [
  { id: "general", label: "מטען כללי", en: "General Cargo", icon: Package, tint: "from-slate-500 to-slate-700" },
  { id: "temperature", label: "מטען מבוקר טמפ'", en: "Temperature Controlled", icon: Thermometer, tint: "from-sky-500 to-cyan-600" },
  { id: "nfo", label: "Next Flight Out", en: "NFO", icon: Zap, tint: "from-amber-500 to-orange-600" },
  { id: "live", label: "חיות חי", en: "Live Animals", icon: Rabbit, tint: "from-emerald-500 to-teal-600" },
  { id: "dangerous", label: "סחורות מסוכנות", en: "Dangerous Goods", icon: AlertTriangle, tint: "from-rose-500 to-red-600" },
  { id: "other", label: "אחר", en: "Other", icon: MoreHorizontal, tint: "from-violet-500 to-purple-600" },
];

const ATTR_OPTIONS: { id: AttrKey; label: string; icon: typeof MapPin }[] = [
  { id: "gps", label: "GPS מטען", icon: MapPin },
  { id: "valuable", label: "מטען יקר", icon: Gem },
  { id: "coldchain", label: "שרשרת קור", icon: Snowflake },
  { id: "dangerous", label: "מטען מסוכן", icon: AlertTriangle },
];

const TEMP_SERIES: { key: TempSeriesKey; label: string; range: string }[] = [
  { key: "s20m", label: "סדרה 20M", range: "-20°C / -18°C" },
  { key: "s22", label: "סדרה 22", range: "+15°C עד +25°C" },
  { key: "s4", label: "סדרה 4", range: "+2°C עד +8°C" },
];

const COOLGUARD_MODELS = [
  { model: "CoolGuard Advance 96L", payload: "96L", inner: "636×630×630", outer: "457×457×457", tare: "38 kg" },
  { model: "CoolGuard Advance 56L", payload: "56L", inner: "558×552×552", outer: "381×381×381", tare: "27 kg" },
  { model: "CoolGuard Advance 28L", payload: "28L", inner: "470×460×460", outer: "305×297×297", tare: "18 kg" },
  { model: "CoolGuard Advance 12L", payload: "12L", inner: "405×395×395", outer: "230×230×230", tare: "13 kg" },
  { model: "CoolGuard Advance 4L", payload: "4L", inner: "312×310×310", outer: "152×152×152", tare: "6 kg" },
];

const PALLETS = [
  { id: "eur", label: "משטח יורו (EUR/EPAL)", size: "1200 × 800 × 144 מ״מ" },
  { id: "std", label: "משטח סטנדרטי", size: "1200 × 1000 × 150 מ״מ" },
  { id: "half", label: "חצי משטח", size: "800 × 600 × 144 מ״מ" },
  { id: "quarter", label: "רבע משטח", size: "600 × 400 × 144 מ״מ" },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Step 2 state
  const [kind, setKind] = useState<ShipKind>("export");
  const [incoterm, setIncoterm] = useState<string>("CIP");
  const [cargo, setCargo] = useState<CargoRow[]>([{ id: uid(), sku: "", description: "", packaging: "", weight: "", notes: "" }]);
  const [containers, setContainers] = useState<ContainerRow[]>([{ id: uid(), type: "", sku: "", destination: "", weight: "" }]);
  const [goods, setGoods] = useState<GoodsRow[]>([{ id: uid(), item: "", sku: "", origin: "", weight: "", dims: "", qty: 1 }]);
  const [notes, setNotes] = useState("");

  // Step 3 state — אופי המשלוח
  const [cargoType, setCargoType] = useState<CargoType>("temperature");
  const [attrs, setAttrs] = useState<Record<AttrKey, boolean>>({ gps: false, valuable: false, coldchain: true, dangerous: false });
  const [tempSeries, setTempSeries] = useState<TempSeriesKey | "none">("s4");
  const [selectedPackModel, setSelectedPackModel] = useState<string | null>(null);
  const [pallet, setPallet] = useState<string | null>("eur");
  const [unitWeight, setUnitWeight] = useState<string>("1");
  const [unitQty, setUnitQty] = useState<string>("");
  const [specialReq, setSpecialReq] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  // Step 4 state — אופי לוגיסטי
  const [originPort, setOriginPort] = useState("(JFK) New York, USA");
  const [destPort, setDestPort] = useState("(TLV) Tel Aviv, Israel");
  const [transit, setTransit] = useState<string[]>(["FRA"]);
  const [newTransit, setNewTransit] = useState("");
  const [departDate, setDepartDate] = useState("2025-06-10");
  const [arriveDate, setArriveDate] = useState("2025-06-12");
  const [services, setServices] = useState<Record<string, boolean>>({
    pickup: true, air: true, exportCustoms: true, importCustoms: true,
    clearance: true, land: true, delivery: true, insurance: true,
  });
  const [compare, setCompare] = useState<Record<string, boolean>>({});
  const [agent, setAgent] = useState("QuickSTAT Global");
  const [airline, setAirline] = useState("Lufthansa Cargo");
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [dropType, setDropType] = useState<DropTypeId | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  useEffect(() => {
    if (!dropType) { setStops([]); return; }
    setStops(seedStopsForDropType(dropType));
  }, [dropType]);
  const [routeApproved, setRouteApproved] = useState(false);
  const [shipmentMode, setShipmentMode] = useState<ShipmentMode>("direct");
  // Step 5 state — תמחור
  const [currency, setCurrency] = useState<"USD" | "EUR" | "ILS">("USD");
  const [margin, setMargin] = useState<string>("15");
  const [pricingNotes, setPricingNotes] = useState("");
  const [pricingItems, setPricingItems] = useState<PricingItem[]>(() => DEFAULT_PRICING_ITEMS.map((r) => ({ ...r })));
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  // Step 6 state — סיכום
  const [discount, setDiscount] = useState<string>("0");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const quoteCode = useMemo(
    () => `Q-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const createQuoteFn = useServerFn(createQuote);
  const listCustomersFn = useServerFn(listCustomers);
  const { data: customersList = [] } = useQuery({
    queryKey: ["customers", "quote-picker"],
    queryFn: () => listCustomersFn(),
    enabled: open,
  });

  const STATUS_LABEL_DB: Record<string, string> = { active: "פעיל", inactive: "לא פעיל", frozen: "מוקפא" };
  const STATUS_DOT_DB: Record<string, string> = {
    active: "bg-emerald-500",
    inactive: "bg-slate-400",
    frozen: "bg-sky-500",
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

  const canContinue = step === 1 ? selectedId !== null : true;

  const reset = () => {
    setStep(1);
    setSelectedId(null);
    setQuery("");
    setKind("export");
    setIncoterm("CIP");
    setCargo([{ id: uid(), sku: "", description: "", packaging: "", weight: "", notes: "" }]);
    setContainers([{ id: uid(), type: "", sku: "", destination: "", weight: "" }]);
    setGoods([{ id: uid(), item: "", sku: "", origin: "", weight: "", dims: "", qty: 1 }]);
    setNotes("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent dir="rtl" className="max-w-5xl p-0 overflow-hidden">
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

        <div className="max-h-[60vh] overflow-y-auto p-6">
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
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn("h-2 w-2 rounded-full", STATUS_DOT_DB[c.status])} />
                          {STATUS_LABEL_DB[c.status]}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{c.customer_code}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-semibold">{c.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.trade_name || c.industry || "—"}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-xs font-semibold",
                            active ? "bg-primary text-primary-foreground" : cn(palette.bg, palette.text),
                          )}
                        >
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.company_name} className="h-full w-full object-cover" />
                          ) : (
                            customerInitials(c.company_name)
                          )}
                        </span>
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
              <Section title="א. סוג משלוח">
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

              {/* ב. תנאי מכר — לא רלוונטי לפנים ארצי */}
              {kind !== "domestic" && (
                <Section title="ב. תנאי מכר (Incoterms 2020)">
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

              {/* ג. סוגי משלוחי דרופ — בחירה */}
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






              {/* ד. פרטי משלוח (משותף) */}
              <Section title="ד. פרטי משלוח">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="תאריך איסוף משוער" type="date" />
                  <Field label="שעת איסוף" placeholder="09:00 – 12:00" />
                  <Field label="תאריך הגעה משוער" type="date" />
                  <Field label="שעת הגעה" placeholder="14:00 – 18:00" />
                </div>
              </Section>

              {/* ה. פרטי קשר / מסע */}
              {kind === "import" ? (
                <Section title="ה. פרטי מסע">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="סוג מסע" placeholder="ימי / אווירי / יבשתי" />
                    <Field label="נמל מוצא" />
                    <Field label="נמל יעד" />
                    <Field label="שם כלי שיט / טיסה" />
                    <Field label="מספר מסע" />
                    <Field label="קוד מסע" />
                  </div>
                </Section>
              ) : (
                <Section title="ה. פרטי קשר">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="שם איש קשר" />
                    <Field label="טלפון" type="tel" />
                    <Field label='דוא"ל' type="email" />
                    <Field label="שם חברה" />
                    <Field label="כתובת + קוד" />
                    <Field label="שם איש קשר יעד" />
                  </div>
                </Section>
              )}

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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ATTR_OPTIONS.map((a) => {
                    const Icon = a.icon;
                    const on = attrs[a.id];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAttrs((s) => ({ ...s, [a.id]: !s[a.id] }))}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                          on ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted/40 text-muted-foreground",
                        )}
                      >
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", on ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="flex-1 text-right">{a.label}</span>
                        <div className={cn("h-4 w-4 rounded border", on ? "border-primary bg-primary" : "border-muted-foreground/30")}>
                          {on && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {cargoType === "temperature" && (
                <Section title="בחר אריזה" action={<span className="text-xs text-muted-foreground">בחר סדרת טמפרטורה ואריזה אחת</span>}>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setTempSeries("none"); setSelectedPackModel(null); }}
                      className={cn("rounded-full border px-3 py-1 text-xs", tempSeries === "none" ? "border-primary bg-primary/5" : "hover:bg-muted/40")}
                    >
                      ללא אריזה מוגדרת
                    </button>
                    {TEMP_SERIES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setTempSeries(s.key)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          tempSeries === s.key ? "border-primary bg-primary/5 text-foreground" : "hover:bg-muted/40 text-muted-foreground",
                        )}
                      >
                        <span className="font-medium text-foreground">{s.label}</span>
                        <span className="mr-2 text-muted-foreground">{s.range}</span>
                      </button>
                    ))}
                  </div>

                  {tempSeries !== "none" && (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs text-muted-foreground">
                          <tr>
                            <th className="w-8 px-2 py-2"></th>
                            <th className="px-3 py-2 text-right font-medium">דגם</th>
                            <th className="px-3 py-2 text-right font-medium">Payload</th>
                            <th className="px-3 py-2 text-right font-medium">מידות פנימיות</th>
                            <th className="px-3 py-2 text-right font-medium">מידות חיצוניות</th>
                            <th className="px-3 py-2 text-right font-medium">Tare</th>
                          </tr>
                        </thead>
                        <tbody>
                          {COOLGUARD_MODELS.map((m) => {
                            const key = `${tempSeries}:${m.model}`;
                            const active = selectedPackModel === key;
                            return (
                              <tr
                                key={m.model}
                                onClick={() => setSelectedPackModel(key)}
                                className={cn("cursor-pointer border-t transition", active ? "bg-primary/5" : "hover:bg-muted/30")}
                              >
                                <td className="px-2 py-2 text-center">
                                  <div className={cn("mx-auto h-4 w-4 rounded-full border", active ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                                    {active && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                </td>
                                <td className="px-3 py-2 font-medium">{m.model}</td>
                                <td className="px-3 py-2">{m.payload}</td>
                                <td className="px-3 py-2 text-muted-foreground">{m.inner}</td>
                                <td className="px-3 py-2 text-muted-foreground">{m.outer}</td>
                                <td className="px-3 py-2">{m.tare}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              )}

              <Section title="מידות ידניות מארז / משטח">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PALLETS.map((p) => {
                    const active = pallet === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPallet(p.id)}
                        className={cn(
                          "rounded-lg border p-3 text-right transition",
                          active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="text-sm font-medium">{p.label}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{p.size}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label='משקל ליחידה (ק"ג)' type="number" value={unitWeight} onChange={(e) => setUnitWeight(e.target.value)} />
                  <Field label="כמות (יח')" type="number" value={unitQty} onChange={(e) => setUnitQty(e.target.value)} placeholder="0" />
                </div>
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
            originPort={originPort} setOriginPort={setOriginPort}
            destPort={destPort} setDestPort={setDestPort}
            transit={transit} setTransit={setTransit}
            newTransit={newTransit} setNewTransit={setNewTransit}
            departDate={departDate} setDepartDate={setDepartDate}
            arriveDate={arriveDate} setArriveDate={setArriveDate}
            services={services} setServices={setServices}
            compare={compare} setCompare={setCompare}
            agent={agent} setAgent={setAgent}
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
              currency={currency} setCurrency={setCurrency}
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
              tempSeries={tempSeries}
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
          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> לקוח פוטנציאלי חדש
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}
            >
              <ArrowRight className="h-4 w-4" /> חזור
            </Button>
            <Button
              size="sm"
              className="gap-1"
              data-testid={step < 6 ? "wizard-next" : "wizard-finish"}
              disabled={!canContinue || submitting}
              onClick={async () => {
                if (step < 6) { setStep(step + 1); return; }
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
                      shipmentMode,
                      incoterm,
                      originPort,
                      destPort,
                      transitPorts: transit,
                      departDate,
                      arriveDate,
                      agent,
                      airline,
                      currency,
                      marginPct,
                      total,
                      payload: {
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
                        discount: discountAmt,
                        internalNotes,
                        dropType,
                        stops: normalizeStopsForPersist(stops),
                      },
                    },
                  });
                  toast.success(`הצעה ${res?.quote_code ?? quoteCode} נשמרה`);
                  onSaved?.();
                  onOpenChange(false);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "שגיאה בשמירת ההצעה";
                  toast.error(msg);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {step < 6 ? "המשך" : submitting ? "שומר..." : "סיום"} <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
    Pickup: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    Drop: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    Hub: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
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

const SERVICE_LIST: { id: string; label: string }[] = [
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
  originPort: string; setOriginPort: (v: string) => void;
  destPort: string; setDestPort: (v: string) => void;
  transit: string[]; setTransit: React.Dispatch<React.SetStateAction<string[]>>;
  newTransit: string; setNewTransit: (v: string) => void;
  departDate: string; setDepartDate: (v: string) => void;
  arriveDate: string; setArriveDate: (v: string) => void;
  services: Record<string, boolean>; setServices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  compare: Record<string, boolean>; setCompare: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  agent: string; setAgent: (v: string) => void;
  airline: string; setAirline: (v: string) => void;
  logisticsNotes: string; setLogisticsNotes: (v: string) => void;
  routeApproved: boolean; setRouteApproved: (v: boolean) => void;
  shipmentMode: ShipmentMode; setShipmentMode: (v: ShipmentMode) => void;
};

function Step4Logistics(p: Step4Props) {
  const transitDays = useMemo(() => {
    const d1 = new Date(p.departDate); const d2 = new Date(p.arriveDate);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return isNaN(diff) ? 0 : Math.max(0, diff);
  }, [p.departDate, p.arriveDate]);

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
        <Section title="סוכן מתווכן" action={<Button type="button" variant="ghost" size="sm" className="h-7 text-xs">פרטי סוכן מלאים</Button>}>
          <Field label="שם הסוכן" value={p.agent} onChange={(e) => p.setAgent(e.target.value)} />
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            <li>סוג שירות: <span className="font-medium text-foreground">Premium</span></li>
            <li>סניף מטפל: <span className="font-medium text-foreground">TLV Office</span></li>
            <li>איש קשר: <span className="font-medium text-foreground">John Doe</span></li>
            <li>טלפון: <span className="font-medium text-foreground">+972-3-1234567</span></li>
            <li>דוא״ל: <span className="font-medium text-foreground">tlv@quickstat.com</span></li>
          </ul>
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
  pricelist: { label: "Price List", dot: "bg-sky-500", row: "" },
  rfq: { label: "RFQ", dot: "bg-emerald-500", row: "" },
  manual: { label: "ידני", dot: "bg-amber-500", row: "" },
  missing: { label: "חסר מקור", dot: "bg-rose-500", row: "bg-rose-50/60" },
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
                      <tr key={it.id} className={cn("border-t", meta.row, it.stale && "bg-amber-50/60")}>
                        <td className="px-2 py-2 text-muted-foreground"><GripVertical className="h-4 w-4" /></td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            value={it.price}
                            onChange={(e) => p.setItems((rows) => rows.map((r) => r.id === it.id ? { ...r, price: Number(e.target.value) } : r))}
                            className={cn("h-8 w-24 rounded-md border bg-background px-2 text-right text-sm", it.source === "missing" && "border-rose-400 text-rose-600")}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{it.currency}</td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex items-center justify-end gap-2">
                            {it.sourceDate && <span className="text-[10px] text-muted-foreground">{it.sourceDate}</span>}
                            <span className={cn(it.source === "missing" && "text-rose-600", it.stale && "text-amber-600")}>
                              {it.sourceLabel}
                            </span>
                            {it.source === "missing" && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                            {it.stale && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm">{it.label}</td>
                        <td className="px-2 py-2 text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></td>
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
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                <div className="text-[11px] text-emerald-700">מחיר מוצע ללקוח</div>
                <div className="mt-1 text-2xl font-bold text-emerald-700">{fmt(customerPrice)} {p.currency}</div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-xs">
                <span className="text-muted-foreground">שיעור רווח</span>
                <span className="font-semibold">{profitRate.toFixed(2)}%</span>
              </div>
            </div>
          </Section>

          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-500" />
              <div className="text-xs">
                <div className="font-semibold text-rose-700">חסרים תיקונים לפני שליחה</div>
                <div className="text-rose-700/80">
                  {alerts.filter((a) => a.tone === "rose").length} קריטי · {alerts.filter((a) => a.tone === "amber").length} אזהרה · {p.items.length} פריטים · שיעור רווח {profitRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <Section title="מקור מחיר">
            <ul className="space-y-2 text-sm">
              <SourceLine dot="bg-sky-500" label="Price List" count={sourceCounts.pricelist} />
              <SourceLine dot="bg-emerald-500" label="RFQ" count={sourceCounts.rfq} />
              <SourceLine dot="bg-amber-500" label="ידני" count={sourceCounts.manual} />
              <SourceLine dot="bg-rose-500" label="חסר מקור" count={sourceCounts.missing} />
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
                    a.tone === "rose" && "border-rose-200 bg-rose-50/70",
                    a.tone === "amber" && "border-amber-200 bg-amber-50/70",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className={cn("flex items-center gap-1.5 font-semibold", a.tone === "rose" ? "text-rose-700" : "text-amber-700")}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {a.title}
                    </div>
                    {a.badge && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", a.tone === "rose" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
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
        <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-700">
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
  kind: ShipKind;
  shipmentMode: ShipmentMode;
  originPort: string;
  destPort: string;
  departDate: string;
  arriveDate: string;
  agent: string;
  airline: string;
  cargoType: CargoType;
  tempSeries: TempSeriesKey | "none";
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

  const tempLabel = p.tempSeries !== "none" ? TEMP_SERIES.find((t) => t.key === p.tempSeries)?.label : null;

  return (
    <div className="space-y-4" data-testid="wizard-step-6">
      {/* Top status ribbon */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 md:grid-cols-5">
        <SumStat label="מספר הצעה" value={<span className="font-mono">{p.quoteCode}</span>} />
        <SumStat
          label="סטטוס"
          value={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
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
                  {CARGO_LABEL[p.cargoType] ?? p.cargoType}
                  {tempLabel ? ` · ${tempLabel}` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>{KIND_LABEL[p.kind]}</Chip>
          <Chip>{MODE_LABEL[p.shipmentMode]}</Chip>
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
            <TrendingUp className="h-4 w-4 text-emerald-600" /> רמת סיכון
          </div>
          <div className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            נמוכה
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> כל התנאים מולאו</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> שיעור רווח תקין</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> אין חריגות</li>
            <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> אישורי סוכן קיימים</li>
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


