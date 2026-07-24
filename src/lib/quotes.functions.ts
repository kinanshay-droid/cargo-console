import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShipmentModeInput = "direct" | "console" | "transship";

export type CreateQuoteInput = {
  quoteCode: string;
  customerId?: string | null;
  customerRef?: string | null;
  customerName?: string | null;
  shipmentKind?: string | null;
  shipmentMode: ShipmentModeInput;
  incoterm?: string | null;
  originPort?: string | null;
  destPort?: string | null;
  transitPorts?: string[];
  departDate?: string | null;
  arriveDate?: string | null;
  agent?: string | null;
  airline?: string | null;
  currency?: string | null;
  marginPct?: number | null;
  total?: number | null;
  payload?: Record<string, unknown>;
};

function validate(input: CreateQuoteInput): CreateQuoteInput {
  if (!input || typeof input !== "object") throw new Error("Invalid input");
  if (!input.quoteCode || typeof input.quoteCode !== "string") {
    throw new Error("quoteCode is required");
  }
  const modes: ShipmentModeInput[] = ["direct", "console", "transship"];
  if (!modes.includes(input.shipmentMode)) {
    throw new Error("shipmentMode must be one of direct | console | transship");
  }
  return input;
}

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateQuoteInput) => validate(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) {
      throw new Error("User has no organization");
    }

    const { data: row, error } = await supabase
      .from("quotes")
      .insert({
        organization_id: profile.organization_id,
        created_by: userId,
        quote_code: data.quoteCode,
        customer_id: data.customerId ?? null,
        customer_ref: data.customerRef ?? null,
        customer_name: data.customerName ?? null,
        shipment_kind: data.shipmentKind ?? null,
        shipment_mode: data.shipmentMode,
        incoterm: data.incoterm ?? null,
        origin_port: data.originPort ?? null,
        dest_port: data.destPort ?? null,
        transit_ports: data.transitPorts ?? [],
        depart_date: data.departDate ?? null,
        arrive_date: data.arriveDate ?? null,
        agent: data.agent ?? null,
        airline: data.airline ?? null,
        currency: data.currency ?? null,
        margin_pct: data.marginPct ?? null,
        total: data.total ?? null,
        payload: (data.payload ?? {}) as never,
      })
      .select("id, quote_code, shipment_mode, created_at")
      .single();

    if (error) throw error;
    return row;
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id, quote_code, shipment_mode, customer_name, customer_ref, shipment_kind, incoterm, origin_port, dest_port, depart_date, arrive_date, agent, airline, currency, total, margin_pct, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Quote not found");
    return row;
  });

export type ReviseQuoteInput = {
  id: string;
  edits: {
    customerName?: string | null;
    customerRef?: string | null;
    shipmentKind?: string | null;
    shipmentMode?: ShipmentModeInput;
    incoterm?: string | null;
    originPort?: string | null;
    destPort?: string | null;
    departDate?: string | null;
    arriveDate?: string | null;
    agent?: string | null;
    airline?: string | null;
    currency?: string | null;
    marginPct?: number | null;
    total?: number | null;
    payload?: Record<string, unknown>;
  };
};

export const reviseQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReviseQuoteInput) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) throw new Error("User has no organization");

    const { data: original, error: origErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (origErr) throw origErr;
    if (!original) throw new Error("Quote not found");

    // Base code = original code stripped of trailing "-Rn"
    const baseCode = String(original.quote_code).replace(/-R\d+$/, "");
    const { data: siblings, error: sibErr } = await supabase
      .from("quotes")
      .select("quote_code")
      .eq("organization_id", profile.organization_id)
      .or(`quote_code.eq.${baseCode},quote_code.like.${baseCode}-R%`);
    if (sibErr) throw sibErr;
    let maxRev = 1;
    for (const s of siblings ?? []) {
      const m = /-R(\d+)$/.exec(s.quote_code ?? "");
      if (m) maxRev = Math.max(maxRev, parseInt(m[1], 10));
    }
    const newCode = `${baseCode}-R${maxRev + 1}`;

    const e = data.edits ?? {};
    const originalPayload =
      original.payload && typeof original.payload === "object" && !Array.isArray(original.payload)
        ? (original.payload as Record<string, unknown>)
        : {};
    const editedPayload =
      e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? e.payload : {};

    const { data: row, error } = await supabase
      .from("quotes")
      .insert({
        organization_id: profile.organization_id,
        created_by: userId,
        quote_code: newCode,
        customer_id: original.customer_id,
        customer_ref: e.customerRef ?? original.customer_ref,
        customer_name: e.customerName ?? original.customer_name,
        shipment_kind: e.shipmentKind ?? original.shipment_kind,
        shipment_mode: e.shipmentMode ?? original.shipment_mode,
        incoterm: e.incoterm ?? original.incoterm,
        origin_port: e.originPort ?? original.origin_port,
        dest_port: e.destPort ?? original.dest_port,
        transit_ports: original.transit_ports ?? [],
        depart_date: e.departDate ?? original.depart_date,
        arrive_date: e.arriveDate ?? original.arrive_date,
        agent: e.agent ?? original.agent,
        airline: e.airline ?? original.airline,
        currency: e.currency ?? original.currency,
        margin_pct: e.marginPct ?? original.margin_pct,
        total: e.total ?? original.total,
        payload: { ...originalPayload, ...editedPayload } as never,
      })
      .select("id, quote_code")
      .single();
    if (error) throw error;
    return row;
  });

