import { Plane, Truck } from "lucide-react";
import {
  PALLETS,
  TEMP_SERIES,
  COOLGUARD_MODELS,
  BIOTHERM_MODELS,
  ATTR_OPTIONS,
  getPackageCalc,
  getPackageDimsCm,
  getPackModelCalc,
  type PackageRow,
  type PackSelection,
  type TempSeriesKey,
} from "@/components/new-quote-dialog";
import { TONE_BADGE, TONE_BADGE_ON_PRIMARY, type Tone } from "@/lib/theme";

// ============================================================
// Customer-facing quote document — mirrors the layout of a
// typical freight-forwarder quote (branded header, route
// timeline, weight/volume summary, itemized cost breakdown,
// packaging table, shipper/consignee, terms). Renders on-screen
// and is what gets printed via the "ייצוא ל-PDF" button.
// ============================================================

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
export function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
export function bool(v: unknown): boolean {
  return v === true || v === "true";
}
function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("he-IL");
}
function fmtMoney(n: number, currency: string): string {
  return `${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const SHIPMENT_MODE_LABEL: Record<string, string> = {
  direct: "משלוח ישיר",
  console: "משלוח קונסול",
  transship: "שטעון",
};
const SHIPMENT_KIND_LABEL: Record<string, string> = {
  export: "ייצוא",
  import: "יבוא",
  domestic: "מקומי",
  distribution: "דיסטריביושן",
};

// The four selectable statuses (see QUOTE_OPS_STATUSES in quotes.functions.ts),
// plus the original scaffold statuses so older rows still render sensibly.
export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלח",
  approved: "אושר",
  rejected: "נדחה",
  expired: "פג תוקף",
  transferred: "הועבר",
  pending_update: "ממתין לעדכון",
  cancelled: "מבוטלת",
  suspended: "מושהת",
  archived: "בארכיון",
};

export const QUOTE_STATUS_PICKER_OPTIONS: { value: string; label: string }[] = [
  { value: "transferred", label: "הועבר" },
  { value: "pending_update", label: "ממתין לעדכון" },
  { value: "cancelled", label: "מבוטלת" },
  { value: "suspended", label: "מושהת" },
];

// Semantic tone per quote status — keeps every status pill (light card view and
// on-dark hero header) grounded in the app's Navy Trust theme tokens instead of
// arbitrary Tailwind hues.
const QUOTE_STATUS_TONE: Record<string, Tone> = {
  draft: "muted",
  sent: "accent",
  approved: "success",
  rejected: "destructive",
  expired: "muted",
  transferred: "accent",
  pending_update: "warning",
  cancelled: "destructive",
  suspended: "muted",
  archived: "primary",
};

export const QUOTE_STATUS_BADGE_LIGHT: Record<string, string> = Object.fromEntries(
  Object.entries(QUOTE_STATUS_TONE).map(([status, tone]) => [status, TONE_BADGE[tone]])
);

const QUOTE_STATUS_BADGE_DARK: Record<string, string> = Object.fromEntries(
  Object.entries(QUOTE_STATUS_TONE).map(([status, tone]) => [status, TONE_BADGE_ON_PRIMARY[tone]])
);

const COUNTRY_FLAGS: [string, string][] = [
  ["israel", "🇮🇱"],
  ["ישראל", "🇮🇱"],
  ["united states", "🇺🇸"],
  ["usa", "🇺🇸"],
  ["u.s.a", "🇺🇸"],
  ["germany", "🇩🇪"],
  ["france", "🇫🇷"],
  ["united kingdom", "🇬🇧"],
  ["uk", "🇬🇧"],
  ["china", "🇨🇳"],
  ["netherlands", "🇳🇱"],
  ["belgium", "🇧🇪"],
  ["turkey", "🇹🇷"],
  ["united arab emirates", "🇦🇪"],
  ["uae", "🇦🇪"],
  ["qatar", "🇶🇦"],
  ["ethiopia", "🇪🇹"],
  ["hong kong", "🇭🇰"],
  ["korea", "🇰🇷"],
  ["japan", "🇯🇵"],
  ["india", "🇮🇳"],
  ["canada", "🇨🇦"],
  ["mexico", "🇲🇽"],
  ["brazil", "🇧🇷"],
  ["italy", "🇮🇹"],
  ["spain", "🇪🇸"],
  ["switzerland", "🇨🇭"],
  ["poland", "🇵🇱"],
  ["georgia", "🇬🇪"],
  ["azerbaijan", "🇦🇿"],
  ["jordan", "🇯🇴"],
];
function flagFor(text: string): string {
  const t = text.toLowerCase();
  for (const [needle, flag] of COUNTRY_FLAGS) {
    if (t.includes(needle)) return flag;
  }
  return "";
}

// -------- payload parsing (defensive — payload shape has evolved) --------

export function parsePackages(raw: unknown): PackageRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (isRecord(p) ? p : null))
    .filter((p): p is Record<string, unknown> => p !== null)
    .map((p) => {
      const customDims = isRecord(p.customDims) ? p.customDims : null;
      const tempSeries = typeof p.tempSeries === "string" && TEMP_SERIES.some((t) => t.key === p.tempSeries)
        ? (p.tempSeries as TempSeriesKey)
        : null;
      return {
        id: str(p.id) || Math.random().toString(36).slice(2, 9),
        pallet: typeof p.pallet === "string" ? p.pallet : null,
        customLength: str(customDims?.length),
        customWidth: str(customDims?.width),
        customHeight: str(customDims?.height),
        unitWeight: str(p.unitWeight) || "1",
        unitQty: str(p.unitQty),
        tempSeries,
        loggerId: typeof p.loggerId === "string" ? p.loggerId : null,
      } satisfies PackageRow;
    });
}

export function parsePackSelections(raw: unknown): PackSelection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (isRecord(s) ? s : null))
    .filter((s): s is Record<string, unknown> => s !== null)
    .map((s) => ({ key: str(s.key), qty: num(s.qty) }))
    .filter((s) => s.key && s.qty > 0);
}

export type PricingRow = { id: string; desc: string; qty: number; unit: string; unitPrice: number; currency: string; total: number };

export function parsePricingItems(raw: unknown, fallbackCurrency: string): PricingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => (isRecord(it) ? it : null))
    .filter((it): it is Record<string, unknown> => it !== null)
    .map((it, idx) => {
      const desc = str(it.desc) || str(it.label) || str(it.group) || "פריט";
      const currency = str(it.currency) || fallbackCurrency;
      const qty = it.qty != null ? num(it.qty) : 1;
      const unitPrice = it.unitPrice != null ? num(it.unitPrice) : num(it.price);
      const total = it.total != null ? num(it.total) : it.price != null ? num(it.price) : qty * unitPrice;
      const id = str(it.id) || `price-${idx}`;
      return { id, desc, qty, unit: str(it.unit), unitPrice, currency, total };
    })
    .filter((r) => r.desc || r.total);
}

function packageVolumeCbm(pkg: PackageRow): number {
  const qty = num(pkg.unitQty);
  const dims = getPackageDimsCm(pkg);
  if (!dims || !qty) return 0;
  return (qty * dims.length * dims.width * dims.height) / 1_000_000;
}

export function palletLabel(pkg: PackageRow): string {
  if (pkg.pallet === "custom") {
    const dims = getPackageDimsCm(pkg);
    return dims ? `מידה ידנית ${dims.length}×${dims.width}×${dims.height} ס״מ` : "מידה ידנית";
  }
  return PALLETS.find((p) => p.id === pkg.pallet)?.label ?? "—";
}

export function selectionLabel(sel: PackSelection): string {
  const modelName = sel.key.slice(sel.key.indexOf(":") + 1);
  const seriesKey = sel.key.slice(0, sel.key.indexOf(":"));
  const seriesMeta = TEMP_SERIES.find((t) => t.key === seriesKey);
  return `${modelName}${seriesMeta ? ` (${seriesMeta.label})` : ""}`;
}

function selectionVolumeCbm(sel: PackSelection): number {
  const calc = getPackModelCalc(sel);
  if (!calc.dims) return 0;
  return (sel.qty * calc.dims.length * calc.dims.width * calc.dims.height) / 1_000_000;
}

// -------- small building blocks --------

function DocField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value || "—"}</div>
    </div>
  );
}

function RouteStop({
  icon,
  label,
  value,
  sub,
  flag,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  flag?: string;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className="mb-1 flex h-5 items-center text-lg leading-none">{flag ?? ""}</div>
      <div className="mb-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background text-primary">
        {icon}
      </div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 max-w-[150px] text-sm font-semibold leading-tight">{value || "—"}</div>
      {sub && <div className="mt-0.5 max-w-[150px] text-[11px] text-muted-foreground leading-tight">{sub}</div>}
    </div>
  );
}

function YesNoBadge({ on }: { on: boolean }) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
        (on ? TONE_BADGE.success : "border-muted-foreground/20 text-muted-foreground")
      }
    >
      {on ? "כן" : "לא"}
    </span>
  );
}

// Controls what a given render of the document shows. `null` for an
// item-id list means "show all of them"; omitting `visibility` entirely
// (the internal/admin usage) is equivalent to every section being on and
// every item list being null — i.e. show everything.
export type QuoteVisibility = {
  route: boolean;
  summary: boolean;
  info: boolean;
  costs: boolean;
  costItemIds: string[] | null;
  otherServices: boolean;
  attrs: boolean;
  attrIds: string[] | null;
  packaging: boolean;
  packageIds: string[] | null;
  shipperConsignee: boolean;
  terms: boolean;
};

export const FULL_VISIBILITY: QuoteVisibility = {
  route: true,
  summary: true,
  info: true,
  costs: true,
  costItemIds: null,
  otherServices: true,
  attrs: true,
  attrIds: null,
  packaging: true,
  packageIds: null,
  shipperConsignee: true,
  terms: true,
};

export function QuoteDocument({ quote, visibility }: { quote: unknown; visibility?: QuoteVisibility }) {
  const v = visibility ?? FULL_VISIBILITY;
  const q = isRecord(quote) ? quote : {};
  const payload = isRecord(q.payload) ? q.payload : {};
  const currency = str(q.currency) || "USD";
  // The custom handoff status (הועבר/ממתין לעדכון/מבוטלת/מושהת) lives in
  // payload.opsStatus rather than the DB status column — see
  // updateQuoteOpsStatus in quotes.functions.ts for why. Fall back to the
  // native quote status (draft/sent/...) when opsStatus hasn't been set.
  const displayStatusKey = str(payload.opsStatus) || str(q.status);

  const packages = parsePackages(payload.packages);
  const packSelections = parsePackSelections(payload.packSelections);
  const packageCalcsAll = packages.map((pkg) => ({ pkg, calc: getPackageCalc(pkg), cbm: packageVolumeCbm(pkg) }));
  const modelCalcsAll = packSelections.map((sel) => ({ sel, calc: getPackModelCalc(sel), cbm: selectionVolumeCbm(sel) }));

  const totalQty = packageCalcsAll.reduce((s, c) => s + c.calc.qty, 0) + modelCalcsAll.reduce((s, c) => s + c.sel.qty, 0);
  const grossWeight = packageCalcsAll.reduce((s, c) => s + c.calc.grossWeight, 0) + modelCalcsAll.reduce((s, c) => s + c.calc.grossWeight, 0);
  const volumetricWeight =
    packageCalcsAll.reduce((s, c) => s + c.calc.volumetricWeight, 0) + modelCalcsAll.reduce((s, c) => s + c.calc.volumetricWeight, 0);
  const totalCbm = packageCalcsAll.reduce((s, c) => s + c.cbm, 0) + modelCalcsAll.reduce((s, c) => s + c.cbm, 0);
  const chargeableWeight = Math.max(grossWeight, volumetricWeight);

  // Packaging table rows respect the visibility selection; the totals
  // above stay true regardless, since they're physical facts not opt-in detail.
  const packageCalcs = v.packageIds ? packageCalcsAll.filter((c) => v.packageIds!.includes(c.pkg.id)) : packageCalcsAll;
  const modelCalcs = v.packageIds ? modelCalcsAll.filter((c) => v.packageIds!.includes(c.sel.key)) : modelCalcsAll;

  const attrs = isRecord(payload.attrs) ? payload.attrs : {};
  const services = isRecord(payload.services) ? payload.services : {};
  const cargoType = str(payload.cargoType);

  const pricingItemsAll = parsePricingItems(payload.pricingItems, currency);
  const pricingItems = v.costItemIds ? pricingItemsAll.filter((r) => v.costItemIds!.includes(r.id)) : pricingItemsAll;
  const pricingTotal = pricingItemsAll.reduce((s, r) => s + r.total, 0);
  const grandTotal = q.total != null ? num(q.total) : pricingTotal;

  const originPort = str(q.origin_port);
  const destPort = str(q.dest_port);
  const pickupAddress = str(payload.pickupAddress);
  const deliveryAddress = str(payload.deliveryAddress);
  const transitPorts = Array.isArray(q.transit_ports) ? (q.transit_ports as unknown[]).map(str).filter(Boolean) : [];

  const departDate = str(q.depart_date);
  const arriveDate = str(q.arrive_date);
  let transitDaysLabel = "—";
  if (departDate && arriveDate) {
    const d1 = new Date(departDate).getTime();
    const d2 = new Date(arriveDate).getTime();
    if (!Number.isNaN(d1) && !Number.isNaN(d2) && d2 >= d1) {
      const days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      transitDaysLabel = `${days} ${days === 1 ? "יום" : "ימים"}`;
    }
  }

  const pickupContacts = Array.isArray(payload.pickupContacts) ? payload.pickupContacts.filter(isRecord) : [];
  const deliveryContacts = Array.isArray(payload.deliveryContacts) ? payload.deliveryContacts.filter(isRecord) : [];
  const moveType = pickupAddress || deliveryAddress || pickupContacts.length || deliveryContacts.length ? "דלת לדלת" : "נמל לנמל";
  const isDomestic = str(q.shipment_kind) === "domestic";

  const validityDays = payload.validityDays != null ? num(payload.validityDays) : 14;
  const createdAt = str(q.created_at);
  let expirationLabel = "—";
  if (createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      const exp = new Date(created.getTime() + validityDays * 24 * 60 * 60 * 1000);
      expirationLabel = exp.toLocaleDateString("he-IL");
    }
  }

  const accountManager = isRecord(payload.accountManager) ? payload.accountManager : null;

  const otherServices: { label: string; on: boolean }[] = [
    { label: "מטען מסוכן", on: bool(attrs.dangerous) },
    { label: "מטוס מטען ייעודי (Freighter)", on: bool(attrs.charter) },
    { label: "בקרת טמפרטורה", on: cargoType === "temperature" },
    { label: "משלוח דחוף (Express)", on: bool(attrs.nfo) || bool(attrs.timeCritical) },
    { label: "ניתן לערימה (Stackable)", on: !bool(attrs.noStack) },
  ];

  const checkedAttrsAll = ATTR_OPTIONS.filter((a) => bool(attrs[a.id]));
  const checkedAttrs = v.attrIds ? checkedAttrsAll.filter((a) => v.attrIds!.includes(a.id)) : checkedAttrsAll;

  const originIcon = <Truck className="h-3 w-3" />;
  const gatewayIcon = <Plane className="h-3 w-3" />;

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border bg-card shadow-sm print:border-0 print:shadow-none">
      {/* Header banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-primary px-6 py-4 text-primary-foreground">
        <img src="/afik-logo-white.png" alt="AFIK Logistics Platform" className="h-11 w-auto rounded-lg" />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold">
            {str(q.quote_code) || "—"} · {SHIPMENT_KIND_LABEL[str(q.shipment_kind)] ?? (str(q.shipment_kind) || "—")}
          </span>
          {displayStatusKey ? (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${QUOTE_STATUS_BADGE_DARK[displayStatusKey] ?? "border-white/20 bg-white/10 text-white/80"}`}
            >
              {QUOTE_STATUS_LABELS[displayStatusKey] ?? displayStatusKey}
            </span>
          ) : null}
          <span>תאריך הצעה: {fmtDate(q.created_at)}</span>
          <span>בתוקף עד: {expirationLabel}</span>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* Route + customer */}
        {v.route && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]" style={{ breakInside: "avoid" }}>
            <div className="rounded-xl border p-4">
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-[12%] top-[54px] h-0.5 bg-border" />
                <div className={`grid gap-1 ${isDomestic ? "grid-cols-2" : "grid-cols-4"}`}>
                  <RouteStop
                    icon={originIcon}
                    label="איסוף"
                    value={pickupAddress || "—"}
                    sub={pickupContacts[0] ? str(pickupContacts[0].name) : undefined}
                    flag={flagFor(pickupAddress || originPort)}
                  />
                  {!isDomestic && (
                    <>
                      <RouteStop icon={gatewayIcon} label="שער יציאה" value={originPort || "—"} />
                      <RouteStop icon={gatewayIcon} label="נמל יעד" value={destPort || "—"} />
                    </>
                  )}
                  <RouteStop
                    icon={originIcon}
                    label="מסירה"
                    value={deliveryAddress || "—"}
                    sub={deliveryContacts[0] ? str(deliveryContacts[0].name) : undefined}
                    flag={flagFor(deliveryAddress || destPort)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">לקוח</div>
              <div className="text-sm font-semibold">{str(q.customer_name) || "—"}</div>
              {str(q.customer_ref) && <div className="mt-1 text-xs text-muted-foreground">Ref: {str(q.customer_ref)}</div>}
            </div>
          </div>
        )}

        {/* Weight/volume summary */}
        {v.summary && (
          <div className="grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-4" style={{ breakInside: "avoid" }}>
            <DocField label="כמות" value={totalQty > 0 ? totalQty : "—"} />
            <DocField label="משקל ברוטו" value={grossWeight > 0 ? `${grossWeight.toFixed(2)} ק״ג` : "—"} />
            <DocField label="נפח" value={totalCbm > 0 ? `${totalCbm.toFixed(2)} CBM` : "—"} />
            <DocField label="משקל לחיוב" value={chargeableWeight > 0 ? `${chargeableWeight.toFixed(2)} ק״ג` : "—"} />
          </div>
        )}

        {/* Info icon row */}
        {v.info && (
          <div className={`grid grid-cols-2 gap-4 rounded-xl border p-4 ${isDomestic ? "sm:grid-cols-2" : "sm:grid-cols-3 lg:grid-cols-6"}`} style={{ breakInside: "avoid" }}>
            {!isDomestic && <DocField label="Incoterms" value={str(q.incoterm)} />}
            <DocField label="סוג העברה" value={moveType} />
            {!isDomestic && <DocField label="שיטת שילוח" value={SHIPMENT_MODE_LABEL[str(q.shipment_mode)] ?? str(q.shipment_mode)} />}
            <DocField label="זמן מעבר משוער" value={transitDaysLabel} />
            {!isDomestic && <DocField label="חברת תעופה" value={str(q.airline)} />}
            {!isDomestic && <DocField label="דרך" value={transitPorts.length > 0 ? transitPorts.join(" · ") : "ישיר"} />}
          </div>
        )}

        {/* Costs + other services */}
        {(v.costs || v.otherServices || v.attrs) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
          {v.costs && (
          <div className="rounded-xl border p-4" style={{ breakInside: "avoid" }}>
            <div className="mb-3 text-sm font-semibold">עלות שירותים</div>
            {pricingItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1.5 text-right font-medium">תיאור</th>
                      <th className="py-1.5 text-right font-medium">כמות</th>
                      <th className="py-1.5 text-right font-medium">מחיר יח&apos;</th>
                      <th className="py-1.5 text-left font-medium">סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricingItems.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5">{r.desc}</td>
                        <td className="py-1.5 text-muted-foreground">{r.qty || "—"}{r.unit ? ` ${r.unit}` : ""}</td>
                        <td className="py-1.5 text-muted-foreground">{r.unitPrice ? fmtMoney(r.unitPrice, r.currency) : "—"}</td>
                        <td className="py-1.5 text-left font-medium">{fmtMoney(r.total, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2">
                      <td colSpan={3} className="py-2 text-sm font-semibold text-primary">סה&quot;כ</td>
                      <td className="py-2 text-left text-sm font-bold text-primary">{fmtMoney(grandTotal, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">אין שורות תמחור להצעה זו.</div>
            )}
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>ביטוח</span><span>{bool(services.insurance) ? "כלול" : "לא כלול"}</span></div>
              <div className="flex justify-between"><span>עמילות מכס ביעד</span><span>{bool(services.clearance) ? "כלול" : "לא כלול"}</span></div>
              <div className="flex justify-between"><span>אחסון ודמי המתנה ביעד</span><span>לא כלול</span></div>
            </div>
          </div>
          )}

          {(v.otherServices || v.attrs) && (
          <div className="rounded-xl border p-4" style={{ breakInside: "avoid" }}>
            <div className="mb-3 text-sm font-semibold">מאפייני משלוח</div>
            {v.otherServices && (
            <div className="space-y-2">
              {otherServices.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <YesNoBadge on={s.on} />
                </div>
              ))}
            </div>
            )}
            {v.attrs && checkedAttrs.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <div className="mb-1.5 text-xs text-muted-foreground">מאפיינים נוספים</div>
                <div className="flex flex-wrap gap-1">
                  {checkedAttrs.map((a) => (
                    <span key={a.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        )}

        {/* Total price banner */}
        {v.costs && (
        <div className="flex items-center justify-between rounded-xl bg-primary px-5 py-3 text-primary-foreground" style={{ breakInside: "avoid" }}>
          <span className="text-sm font-medium">מחיר כולל</span>
          <span className="text-xl font-bold">{fmtMoney(grandTotal, currency)}</span>
        </div>
        )}

        {/* Packaging details */}
        {v.packaging && (packageCalcs.length > 0 || modelCalcs.length > 0) && (
          <div className="rounded-xl border p-4" style={{ breakInside: "avoid" }}>
            <div className="mb-3 text-sm font-semibold">פרטי אריזה</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1.5 text-right font-medium">כמות</th>
                    <th className="py-1.5 text-right font-medium">סוג אריזה</th>
                    <th className="py-1.5 text-right font-medium">מידות (ס״מ)</th>
                    <th className="py-1.5 text-right font-medium">משקל ברוטו</th>
                    <th className="py-1.5 text-right font-medium">נפח (CBM)</th>
                    <th className="py-1.5 text-left font-medium">משקל לחיוב</th>
                  </tr>
                </thead>
                <tbody>
                  {packageCalcs.map(({ pkg, calc, cbm }) => (
                    <tr key={pkg.id} className="border-b last:border-0">
                      <td className="py-1.5">{calc.qty || "—"}</td>
                      <td className="py-1.5">{palletLabel(pkg)}</td>
                      <td className="py-1.5 text-muted-foreground">
                        {calc.dims ? `${calc.dims.length}×${calc.dims.width}×${calc.dims.height}` : "—"}
                      </td>
                      <td className="py-1.5">{calc.grossWeight > 0 ? `${calc.grossWeight.toFixed(2)} ק״ג` : "—"}</td>
                      <td className="py-1.5">{cbm > 0 ? cbm.toFixed(2) : "—"}</td>
                      <td className="py-1.5 text-left">{Math.max(calc.grossWeight, calc.volumetricWeight) > 0 ? `${Math.max(calc.grossWeight, calc.volumetricWeight).toFixed(2)} ק״ג` : "—"}</td>
                    </tr>
                  ))}
                  {modelCalcs.map(({ sel, calc, cbm }, i) => (
                    <tr key={`${sel.key}-${i}`} className="border-b last:border-0">
                      <td className="py-1.5">{sel.qty}</td>
                      <td className="py-1.5">{selectionLabel(sel)}</td>
                      <td className="py-1.5 text-muted-foreground">
                        {calc.dims ? `${calc.dims.length}×${calc.dims.width}×${calc.dims.height}` : "—"}
                      </td>
                      <td className="py-1.5">{calc.grossWeight > 0 ? `${calc.grossWeight.toFixed(2)} ק״ג` : "—"}</td>
                      <td className="py-1.5">{cbm > 0 ? cbm.toFixed(2) : "—"}</td>
                      <td className="py-1.5 text-left">{Math.max(calc.grossWeight, calc.volumetricWeight) > 0 ? `${Math.max(calc.grossWeight, calc.volumetricWeight).toFixed(2)} ק״ג` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td className="py-2 text-sm font-semibold text-primary">{totalQty}</td>
                    <td colSpan={4} />
                    <td className="py-2 text-left text-sm font-semibold text-primary">
                      {chargeableWeight > 0 ? `${chargeableWeight.toFixed(2)} ק״ג` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Shipper / consignee */}
        {v.shipperConsignee && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ breakInside: "avoid" }}>
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold">שולח (Shipper)</div>
            <div className="space-y-1 text-xs">
              <div><span className="text-muted-foreground">שם: </span><span className="font-medium">{str(q.customer_name) || "—"}</span></div>
              <div><span className="text-muted-foreground">Ref: </span>{str(q.customer_ref) || "—"}</div>
              <div><span className="text-muted-foreground">כתובת איסוף: </span>{pickupAddress || "—"}</div>
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="mb-2 text-sm font-semibold">נמען (Consignee)</div>
            <div className="space-y-1 text-xs">
              <div><span className="text-muted-foreground">שם: </span><span className="font-medium">{deliveryContacts[0] ? str(deliveryContacts[0].name) : "—"}</span></div>
              <div><span className="text-muted-foreground">כתובת מסירה: </span>{deliveryAddress || "—"}</div>
            </div>
          </div>
        </div>
        )}

        {/* Terms & conditions */}
        {v.terms && (
        <div className="rounded-xl border p-4 text-xs leading-relaxed text-muted-foreground" style={{ breakInside: "avoid" }}>
          <div className="mb-2 text-sm font-semibold text-foreground">הצעה זו אינה כוללת</div>
          <ul className="mb-4 list-inside list-disc space-y-1">
            <li>אגרות, מיסים, מע״מ, היטלים ורישיונות רגולטוריים.</li>
            <li>ביטוח מטען, אלא אם צוין אחרת מפורשות בטבלת עלות השירותים לעיל.</li>
            <li>אחסון בישראל וביעד, דמי המתנה (Demurrage) ודמי איחור.</li>
            <li>בדיקות מכס פיזיות, איסוף/מסירה מיוחדים מחוץ לכתובת שצוינה.</li>
            <li>אגרות נמל/שדה תעופה בפועל, ככל שיחולו מעבר לאמור לעיל.</li>
          </ul>
          <div className="mb-2 text-sm font-semibold text-foreground">תנאים כלליים</div>
          <ul className="list-inside list-disc space-y-1">
            <li>ההצעה כפופה לזמינות מקום וציוד אצל חברות התעופה/הספנות במועד ההזמנה.</li>
            <li>לוחות הזמנים המוצגים הם משוערים בלבד ואינם מהווים התחייבות למועד יציאה/הגעה מדויק.</li>
            <li>יחס נפח/משקל בהובלה אווירית מחושב לפי 1:6 (1 CBM = 167 ק״ג), אלא אם צוין אחרת.</li>
            <li>ההצעה מתייחסת למטען כללי בלבד; מטען מסוכן, חריג או שאינו ניתן לערימה עשוי לחייב תמחור נפרד.</li>
            <li>AFIK Logistics Platform פועלת כמתאם שירותים מול ספקים חיצוניים ואינה אחראית לעיכובים, אובדן או נזק במטען בעת החזקתו בידי צד ג׳.</li>
            <li>אלא אם צוין אחרת, הצעה זו בתוקף למשך {validityDays} יום ממועד ההנפקה.</li>
          </ul>
        </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span>מספר הצעה: {str(q.quote_code) || "—"}</span>
          <span>
            איש קשר: {accountManager ? str(accountManager.name) : "—"}
            {accountManager && str(accountManager.email) ? ` · ${str(accountManager.email)}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
