import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types ----------
export type PricingUnit = "kg" | "cbm" | "shipment";
export type PricingStatus = "draft" | "published" | "archived";

export type PricingRule = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  name: string;
  priority: number;
  currency: string;
  base_price: number;
  unit: PricingUnit;
  rate: number;
  minimum_charge: number;
  fuel_surcharge_pct: number;
  insurance_pct: number;
  tax_pct: number;
  service_type: string | null;
  temperature_range: string | null;
  packaging: string | null;
  shipment_type: string | null;
  incoterm: string | null;
  origin_country: string | null;
  destination_country: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  weight_from: number | null;
  weight_to: number | null;
  effective_from: string | null;
  effective_to: string | null;
  status: PricingStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PricingRuleInput = Partial<Omit<PricingRule, "id" | "organization_id" | "created_at" | "updated_at" | "published_at">> & {
  id?: string;
  name: string;
};

export type PricingInput = {
  customerId?: string | null;
  origin?: string | null;
  destination?: string | null;
  originAirport?: string | null;
  destinationAirport?: string | null;
  service?: string | null;
  temperatureRange?: string | null;
  packaging?: string | null;
  weight?: number | null;
  volume?: number | null;
  currency?: string | null;
  requestedPickupDate?: string | null;
  requestedDeliveryDate?: string | null;
  shipmentType?: string | null;
  incoterm?: string | null;
  additionalServices?: {
    insurance?: boolean;
    dangerousGoods?: boolean;
    dryIce?: boolean;
    dedicatedCourier?: boolean;
    priority?: boolean;
  };
  quotationId?: string | null;
};

export type PricingBreakdown = {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  minimumCharge: number;
  chargeableSubtotal: number;
  fuelSurcharge: number;
  insurance: number;
  tax: number;
  additionalCharges: number;
  discount: number;
  finalPrice: number;
};

export type PricingResult = {
  matched: boolean;
  error?: string;
  rule: PricingRule | null;
  ruleName: string | null;
  pricingVersion: number | null;
  currency: string;
  breakdown: PricingBreakdown;
  finalPrice: number;
  appliedRules: { id: string; name: string; priority: number; score: number }[];
  calculationTimeMs: number;
};

// ---------- Rule matching / scoring ----------
function scoreRule(rule: PricingRule, input: PricingInput): number | null {
  // hard rejects
  const eqOrSkip = (field: string | null | undefined, value: string | null | undefined) =>
    !field || !value || field.toLowerCase() === value.toLowerCase();

  if (rule.customer_id && rule.customer_id !== input.customerId) return null;
  if (!eqOrSkip(rule.service_type, input.service)) return null;
  if (!eqOrSkip(rule.temperature_range, input.temperatureRange)) return null;
  if (!eqOrSkip(rule.packaging, input.packaging)) return null;
  if (!eqOrSkip(rule.shipment_type, input.shipmentType)) return null;
  if (!eqOrSkip(rule.incoterm, input.incoterm)) return null;
  if (!eqOrSkip(rule.origin_country, input.origin)) return null;
  if (!eqOrSkip(rule.destination_country, input.destination)) return null;
  if (!eqOrSkip(rule.origin_airport, input.originAirport)) return null;
  if (!eqOrSkip(rule.destination_airport, input.destinationAirport)) return null;

  const w = input.weight ?? null;
  if (rule.weight_from != null && (w == null || w < rule.weight_from)) return null;
  if (rule.weight_to != null && (w == null || w > rule.weight_to)) return null;

  const date = input.requestedPickupDate ? new Date(input.requestedPickupDate) : new Date();
  if (rule.effective_from && date < new Date(rule.effective_from)) return null;
  if (rule.effective_to && date > new Date(rule.effective_to)) return null;

  // scoring: specificity in the priority order described in the spec
  let score = 0;
  if (rule.customer_id) score += 1_000_000;
  if (rule.destination_country) score += 100_000;
  if (rule.origin_country) score += 90_000;
  if (rule.destination_airport) score += 80_000;
  if (rule.origin_airport) score += 70_000;
  if (rule.service_type) score += 30_000;
  if (rule.temperature_range) score += 20_000;
  if (rule.packaging) score += 10_000;
  if (rule.weight_from != null || rule.weight_to != null) score += 5_000;
  if (rule.shipment_type) score += 2_000;
  if (rule.incoterm) score += 1_000;
  if (rule.effective_from || rule.effective_to) score += 500;
  score += rule.priority;
  return score;
}

function computeBreakdown(rule: PricingRule, input: PricingInput, customerDiscountPct: number): PricingBreakdown {
  const weight = input.weight ?? 0;
  const volume = input.volume ?? 0;
  const qty = rule.unit === "kg" ? weight : rule.unit === "cbm" ? volume : 1;
  const rateSubtotal = qty * Number(rule.rate);
  const subtotal = Number(rule.base_price) + rateSubtotal;
  const chargeableSubtotal = Math.max(subtotal, Number(rule.minimum_charge));
  const fuel = chargeableSubtotal * (Number(rule.fuel_surcharge_pct) / 100);

  // additional charges — flat, from services flags
  const svc = input.additionalServices ?? {};
  let additional = 0;
  if (svc.dangerousGoods) additional += 150;
  if (svc.dryIce) additional += 75;
  if (svc.dedicatedCourier) additional += 300;
  if (svc.priority) additional += 100;

  const insurance = svc.insurance ? chargeableSubtotal * (Number(rule.insurance_pct) / 100) : 0;
  const preTax = chargeableSubtotal + fuel + additional + insurance;
  const discount = preTax * (customerDiscountPct / 100);
  const taxable = preTax - discount;
  const tax = taxable * (Number(rule.tax_pct) / 100);
  const finalPrice = taxable + tax;

  return {
    unitPrice: Number(rule.rate),
    quantity: qty,
    subtotal,
    minimumCharge: Number(rule.minimum_charge),
    chargeableSubtotal,
    fuelSurcharge: round2(fuel),
    insurance: round2(insurance),
    tax: round2(tax),
    additionalCharges: additional,
    discount: round2(discount),
    finalPrice: round2(finalPrice),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------- Server functions ----------

export const listPricingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pricing_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PricingRule[];
  });

export const upsertPricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PricingRuleInput) => {
    if (!input?.name) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");

    const row = {
      organization_id: profile.organization_id,
      customer_id: data.customer_id ?? null,
      name: data.name,
      priority: data.priority ?? 100,
      currency: data.currency ?? "USD",
      base_price: data.base_price ?? 0,
      unit: data.unit ?? "shipment",
      rate: data.rate ?? 0,
      minimum_charge: data.minimum_charge ?? 0,
      fuel_surcharge_pct: data.fuel_surcharge_pct ?? 0,
      insurance_pct: data.insurance_pct ?? 0,
      tax_pct: data.tax_pct ?? 0,
      service_type: data.service_type ?? null,
      temperature_range: data.temperature_range ?? null,
      packaging: data.packaging ?? null,
      shipment_type: data.shipment_type ?? null,
      incoterm: data.incoterm ?? null,
      origin_country: data.origin_country ?? null,
      destination_country: data.destination_country ?? null,
      origin_airport: data.origin_airport ?? null,
      destination_airport: data.destination_airport ?? null,
      weight_from: data.weight_from ?? null,
      weight_to: data.weight_to ?? null,
      effective_from: data.effective_from ?? null,
      effective_to: data.effective_to ?? null,
      status: data.status ?? "draft",
      version: data.version ?? 1,
      created_by: userId,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("pricing_rules")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return updated as PricingRule;
    }
    const { data: inserted, error } = await supabase
      .from("pricing_rules")
      .insert(row)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return inserted as PricingRule;
  });

export const publishPricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: current, error: getErr } = await context.supabase
      .from("pricing_rules")
      .select("version")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw getErr;
    const nextVersion = (current?.version ?? 1) + 1;
    const { error } = await context.supabase
      .from("pricing_rules")
      .update({ status: "published", published_at: new Date().toISOString(), version: nextVersion })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const archivePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pricing_rules")
      .update({ status: "archived" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deletePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pricing_rules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const calculatePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PricingInput) => input ?? {})
  .handler(async ({ data, context }): Promise<PricingResult> => {
    const started = Date.now();
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");
    const orgId = profile.organization_id as string;

    // customer discount from customer_commercial (optional)
    let customerDiscountPct = 0;
    if (data.customerId) {
      const { data: cc } = await supabase
        .from("customer_commercial")
        .select("*")
        .eq("customer_id", data.customerId)
        .maybeSingle();
      const rawDiscount = (cc as unknown as { discount?: string | number } | null)?.discount;
      const parsed = typeof rawDiscount === "number" ? rawDiscount : parseFloat(String(rawDiscount ?? ""));
      if (!Number.isNaN(parsed)) customerDiscountPct = parsed;
    }

    const { data: rules, error } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("status", "published");
    if (error) throw error;

    const scored: { rule: PricingRule; score: number }[] = [];
    for (const r of (rules ?? []) as PricingRule[]) {
      const s = scoreRule(r, data);
      if (s != null) scored.push({ rule: r, score: s });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tiebreak: newest published version
      const av = a.rule.version, bv = b.rule.version;
      if (bv !== av) return bv - av;
      return (b.rule.published_at ?? "").localeCompare(a.rule.published_at ?? "");
    });

    const emptyBreakdown: PricingBreakdown = {
      unitPrice: 0, quantity: 0, subtotal: 0, minimumCharge: 0, chargeableSubtotal: 0,
      fuelSurcharge: 0, insurance: 0, tax: 0, additionalCharges: 0, discount: 0, finalPrice: 0,
    };

    if (!scored.length) {
      const elapsed = Date.now() - started;
      await supabase.from("pricing_calculation_log").insert({
        organization_id: orgId,
        quotation_id: data.quotationId ?? null,
        customer_id: data.customerId ?? null,
        rule_id: null,
        rule_used: null,
        pricing_version: null,
        inputs: (data ?? {}) as never,
        breakdown: {} as never,
        calculated_price: null,
        currency: data.currency ?? null,
        execution_time_ms: elapsed,
        created_by: userId,
      });
      return {
        matched: false,
        error: "No Pricing Rule Found",
        rule: null,
        ruleName: null,
        pricingVersion: null,
        currency: data.currency ?? "USD",
        breakdown: emptyBreakdown,
        finalPrice: 0,
        appliedRules: [],
        calculationTimeMs: elapsed,
      };
    }

    const winner = scored[0].rule;
    const breakdown = computeBreakdown(winner, data, customerDiscountPct);
    const elapsed = Date.now() - started;

    await supabase.from("pricing_calculation_log").insert({
      organization_id: orgId,
      quotation_id: data.quotationId ?? null,
      customer_id: data.customerId ?? null,
      rule_id: winner.id,
      rule_used: winner.name,
      pricing_version: winner.version,
      inputs: (data ?? {}) as never,
      breakdown: breakdown as never,
      calculated_price: breakdown.finalPrice,
      currency: winner.currency,
      execution_time_ms: elapsed,
      created_by: userId,
    });

    return {
      matched: true,
      rule: winner,
      ruleName: winner.name,
      pricingVersion: winner.version,
      currency: winner.currency,
      breakdown,
      finalPrice: breakdown.finalPrice,
      appliedRules: scored.slice(0, 5).map((s) => ({
        id: s.rule.id, name: s.rule.name, priority: s.rule.priority, score: s.score,
      })),
      calculationTimeMs: elapsed,
    };
  });

export type PricingLogRow = {
  id: string;
  created_at: string;
  rule_used: string | null;
  pricing_version: number | null;
  calculated_price: number | null;
  currency: string | null;
  execution_time_ms: number | null;
  customer_id: string | null;
  quotation_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breakdown: any;
};

export const listCalculationLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pricing_calculation_log")
      .select("id, created_at, rule_used, pricing_version, calculated_price, currency, execution_time_ms, customer_id, quotation_id, inputs, breakdown")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as PricingLogRow[];
  });
