// Business logic behind the external-partner REST API (src/routes/api.v1.*).
// Every function here is called with an already-authenticated
// AuthenticatedPartner (see partner-api-middleware.ts) and the service-role
// client, and every query is explicitly scoped by organization_id AND
// api_partner_id — the partner's key carries no Supabase Auth session, so
// there is no RLS principal to fall back on; this scoping IS the access
// boundary.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AuthenticatedPartner } from "@/integrations/supabase/partner-api-middleware";
import { CASE_PIPELINE_STATUS_META } from "@/lib/operations.functions";
import type { ShipmentModeInput } from "@/lib/quotes.functions";

type Db = SupabaseClient<Database>;

const CASE_LIST_COLUMNS =
  "id, case_code, status, customer_name, customer_ref, shipment_kind, shipment_mode, incoterm, origin_port, dest_port, transit_ports, depart_date, arrive_date, agent, airline, currency, total, created_at, updated_at, payload";

function toPublicCase(row: Record<string, unknown>) {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id as string,
    caseCode: row.case_code as string,
    status: row.status as string,
    pipelineStatus: (payload.pipelineStatus as string | undefined) ?? null,
    customerName: row.customer_name ?? null,
    customerRef: row.customer_ref ?? null,
    shipmentKind: row.shipment_kind ?? null,
    shipmentMode: row.shipment_mode ?? null,
    incoterm: row.incoterm ?? null,
    originPort: row.origin_port ?? null,
    destPort: row.dest_port ?? null,
    transitPorts: row.transit_ports ?? [],
    departDate: row.depart_date ?? null,
    arriveDate: row.arrive_date ?? null,
    agent: row.agent ?? null,
    airline: row.airline ?? null,
    currency: row.currency ?? null,
    total: row.total ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreatePartnerCaseInput = {
  customerRef?: string | null;
  customerName?: string | null;
  shipmentKind?: string | null;
  shipmentMode?: ShipmentModeInput;
  incoterm?: string | null;
  originPort?: string | null;
  destPort?: string | null;
  transitPorts?: string[];
  departDate?: string | null;
  arriveDate?: string | null;
  agent?: string | null;
  airline?: string | null;
  currency?: string | null;
  total?: number | null;
  // Free-form: full commercial detail (pricing/costs breakdown, packages,
  // contacts, etc.), rides along exactly like a site-created case's payload.
  payload?: Record<string, unknown>;
};

export class PartnerApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function validateCreateInput(input: CreatePartnerCaseInput): CreatePartnerCaseInput {
  if (!input || typeof input !== "object") throw new PartnerApiError("Invalid request body");
  const modes: ShipmentModeInput[] = ["direct", "console", "transship"];
  if (input.shipmentMode !== undefined && !modes.includes(input.shipmentMode)) {
    throw new PartnerApiError("shipmentMode must be one of direct | console | transship");
  }
  if (input.total !== undefined && input.total !== null && typeof input.total !== "number") {
    throw new PartnerApiError("total must be a number");
  }
  return input;
}

// A full case, created immediately (no approval gate — same as one made
// from the site), tagged with this partner's id so it only ever shows up in
// that partner's own list/get calls. case_code uses its own "X-" (eXternal)
// numbering scheme, independent of the site's Q-/P- schemes, retrying on
// the rare collision — same approach as createPickupCase in
// operations.functions.ts.
export async function createPartnerCase(
  supabase: Db,
  partner: AuthenticatedPartner,
  rawInput: CreatePartnerCaseInput,
) {
  const input = validateCreateInput(rawInput);

  let newCode = "";
  for (let attempt = 0; attempt < 5 && !newCode; attempt++) {
    const now = new Date();
    const candidate = `X-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { data: clash, error: clashErr } = await supabase
      .from("operations_cases")
      .select("id")
      .eq("case_code", candidate)
      .maybeSingle();
    if (clashErr) throw new PartnerApiError(clashErr.message, 500);
    if (!clash) newCode = candidate;
  }
  if (!newCode) throw new PartnerApiError("Failed to generate a unique case number", 500);

  const { data: row, error } = await supabase
    .from("operations_cases")
    .insert({
      organization_id: partner.organizationId,
      created_by: partner.createdBy,
      api_partner_id: partner.id,
      case_code: newCode,
      customer_ref: input.customerRef ?? null,
      customer_name: input.customerName ?? null,
      shipment_kind: input.shipmentKind ?? null,
      shipment_mode: input.shipmentMode ?? "direct",
      incoterm: input.incoterm ?? null,
      origin_port: input.originPort ?? null,
      dest_port: input.destPort ?? null,
      transit_ports: input.transitPorts ?? [],
      depart_date: input.departDate ?? null,
      arrive_date: input.arriveDate ?? null,
      agent: input.agent ?? null,
      airline: input.airline ?? null,
      currency: input.currency ?? null,
      total: input.total ?? null,
      payload: (input.payload ?? {}) as never,
    })
    .select(CASE_LIST_COLUMNS)
    .single();
  if (error) throw new PartnerApiError(error.message, 500);

  return toPublicCase(row as unknown as Record<string, unknown>);
}

export async function listPartnerCases(supabase: Db, partner: AuthenticatedPartner) {
  const { data, error } = await supabase
    .from("operations_cases")
    .select(CASE_LIST_COLUMNS)
    .eq("organization_id", partner.organizationId)
    .eq("api_partner_id", partner.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new PartnerApiError(error.message, 500);
  return (data ?? []).map((row) => toPublicCase(row as unknown as Record<string, unknown>));
}

export async function getPartnerCase(supabase: Db, partner: AuthenticatedPartner, id: string) {
  const { data, error } = await supabase
    .from("operations_cases")
    .select(CASE_LIST_COLUMNS)
    .eq("id", id)
    .eq("organization_id", partner.organizationId)
    .eq("api_partner_id", partner.id)
    .maybeSingle();
  if (error) throw new PartnerApiError(error.message, 500);
  if (!data) throw new PartnerApiError("Case not found", 404);
  return toPublicCase(data as unknown as Record<string, unknown>);
}

export const PARTNER_STATUS_VALUES = ["picked_up", "in_transit", "delivered"] as const;
export type PartnerStatus = (typeof PARTNER_STATUS_VALUES)[number];

// The 3-state push a partner can report, distinct from the internal
// 22-stage pipeline (CASE_PIPELINE_STATUS_META in operations.functions.ts).
// All three values happen to already exist as pipeline stages, so this
// reuses that same enum and the same read-modify-write + coarse-status
// pattern as updateCasePipelineStatus, rather than inventing a parallel
// status system.
export async function updatePartnerCaseStatus(
  supabase: Db,
  partner: AuthenticatedPartner,
  id: string,
  status: PartnerStatus,
) {
  if (!PARTNER_STATUS_VALUES.includes(status)) {
    throw new PartnerApiError("status must be one of " + PARTNER_STATUS_VALUES.join(", "));
  }

  const { data: existing, error: getErr } = await supabase
    .from("operations_cases")
    .select("payload")
    .eq("id", id)
    .eq("organization_id", partner.organizationId)
    .eq("api_partner_id", partner.id)
    .maybeSingle();
  if (getErr) throw new PartnerApiError(getErr.message, 500);
  if (!existing) throw new PartnerApiError("Case not found", 404);

  const payload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};
  const nextPayload = { ...payload, pipelineStatus: status };
  const coarse = CASE_PIPELINE_STATUS_META[status].coarse;

  const { data: row, error } = await supabase
    .from("operations_cases")
    .update({ payload: nextPayload as never, status: coarse })
    .eq("id", id)
    .select(CASE_LIST_COLUMNS)
    .single();
  if (error) throw new PartnerApiError(error.message, 500);
  return toPublicCase(row as unknown as Record<string, unknown>);
}
