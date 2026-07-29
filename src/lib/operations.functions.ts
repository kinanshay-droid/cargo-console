import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ShipmentModeInput } from "@/lib/quotes.functions";

export type CaseStatus = "new" | "in_progress" | "completed" | "cancelled";

export const CASE_STATUS_FLOW: Record<CaseStatus, { status: CaseStatus; label: string }[]> = {
  new: [
    { status: "in_progress", label: "העבר לטיפול" },
    { status: "cancelled", label: "בטל" },
  ],
  in_progress: [
    { status: "completed", label: "סמן כהושלם" },
    { status: "cancelled", label: "בטל" },
  ],
  completed: [],
  cancelled: [],
};

// Transferring a quote does three things in one call:
//  1. Snapshots the quote's data (including its full payload) into a new
//     row in operations_cases — a real, separate record with its own id and
//     case number, so later edits to the quote don't retroactively change
//     what the case shows (a frozen copy, not a live reference).
//  2. Marks the source quote's payload.opsStatus as "archived" and records
//     the case's id/number on it, so the quote screen can link forward to
//     the case that superseded it (documentation + traceability).
//  3. Is idempotent: re-transferring an already-transferred quote just
//     returns the existing case instead of creating a duplicate.
//
// Requires the operations_cases table (see
// supabase/migrations/20260725224500_add_operations_cases.sql) to exist on
// the live database.
export const createCaseFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => {
    if (!input?.quoteId || typeof input.quoteId !== "string") throw new Error("quoteId is required");
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

    const { data: existing, error: existingErr } = await supabase
      .from("operations_cases")
      .select("id, case_code, status")
      .eq("quote_id", data.quoteId)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return existing;

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (quoteErr) throw quoteErr;
    if (!quote) throw new Error("Quote not found");

    const { data: row, error } = await supabase
      .from("operations_cases")
      .insert({
        organization_id: profile.organization_id,
        created_by: userId,
        quote_id: quote.id,
        case_code: quote.quote_code,
        customer_ref: quote.customer_ref,
        customer_name: quote.customer_name,
        shipment_kind: quote.shipment_kind,
        shipment_mode: quote.shipment_mode,
        incoterm: quote.incoterm,
        origin_port: quote.origin_port,
        dest_port: quote.dest_port,
        transit_ports: quote.transit_ports ?? [],
        depart_date: quote.depart_date,
        arrive_date: quote.arrive_date,
        agent: quote.agent,
        airline: quote.airline,
        currency: quote.currency,
        total: quote.total,
        // Full copy of the quote's payload, frozen at the moment of transfer.
        payload: quote.payload as never,
      })
      .select("id, case_code, status")
      .single();
    if (error) throw error;

    // Archive the source quote and leave a trail back to the case.
    const sourcePayload =
      quote.payload && typeof quote.payload === "object" && !Array.isArray(quote.payload)
        ? (quote.payload as Record<string, unknown>)
        : {};
    const { error: archiveErr } = await supabase
      .from("quotes")
      .update({
        payload: {
          ...sourcePayload,
          opsStatus: "archived",
          caseId: row.id,
          caseNumber: row.case_code,
        } as never,
      })
      .eq("id", quote.id);
    if (archiveErr) throw archiveErr;

    return row;
  });

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("operations_cases")
      .select(
        "id, case_code, status, quote_id, customer_name, customer_ref, shipment_kind, shipment_mode, incoterm, origin_port, dest_port, transit_ports, currency, total, created_at, updated_at, arrive_date, payload",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("operations_cases")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Case not found");
    return row;
  });

export type UpdateCaseInput = {
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
    total?: number | null;
    payload?: Record<string, unknown>;
  };
};

// Cases are edited in place (unlike quotes, which fork a new revision) —
// there's no separate "case history" concept yet, just one live record.
export const updateCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateCaseInput) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const e = data.edits ?? {};
    const patch: Record<string, unknown> = {};
    if (e.customerName !== undefined) patch.customer_name = e.customerName;
    if (e.customerRef !== undefined) patch.customer_ref = e.customerRef;
    if (e.shipmentKind !== undefined) patch.shipment_kind = e.shipmentKind;
    if (e.shipmentMode !== undefined) patch.shipment_mode = e.shipmentMode;
    if (e.incoterm !== undefined) patch.incoterm = e.incoterm;
    if (e.originPort !== undefined) patch.origin_port = e.originPort;
    if (e.destPort !== undefined) patch.dest_port = e.destPort;
    if (e.departDate !== undefined) patch.depart_date = e.departDate;
    if (e.arriveDate !== undefined) patch.arrive_date = e.arriveDate;
    if (e.agent !== undefined) patch.agent = e.agent;
    if (e.airline !== undefined) patch.airline = e.airline;
    if (e.currency !== undefined) patch.currency = e.currency;
    if (e.total !== undefined) patch.total = e.total;
    if (e.payload !== undefined) patch.payload = e.payload as never;

    const { data: row, error } = await supabase
      .from("operations_cases")
      .update(patch)
      .eq("id", data.id)
      .select("id, case_code")
      .single();
    if (error) throw error;
    return row;
  });

export const updateCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: CaseStatus }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    const valid: CaseStatus[] = ["new", "in_progress", "completed", "cancelled"];
    if (!valid.includes(input.status)) throw new Error("status must be one of " + valid.join(", "));
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("operations_cases")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id, status")
      .single();
    if (error) throw error;
    return row;
  });

// The detailed shipment pipeline. This is intentionally NOT the
// operations_cases.status enum column (which only has 4 values and would
// need a migration to extend — the exact "unapplied migration" trap this
// project hit earlier). Instead the detailed status lives on the case's
// payload JSONB, same read-modify-write pattern as updateQuoteOpsStatus /
// assignCaseRep. Each pipeline status also maps to one of the 4 coarse
// statuses so the existing status column (and everything built on it —
// Shipments' status cards, Operations' open/in-progress counts) keeps
// working without changes.
export type CasePipelineStatus =
  | "new"
  | "pending_assignment"
  | "data_review"
  | "pending_documents"
  | "pending_customer_approval"
  | "pending_credit"
  | "ready_to_book"
  | "booked"
  | "preparing_shipment"
  | "ready_for_pickup"
  | "picked_up"
  | "in_transit_to_port"
  | "received_at_terminal"
  | "export_cleared"
  | "departed"
  | "in_transit"
  | "arrived"
  | "customs_clearance"
  | "ready_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export const CASE_PIPELINE_STATUS_META: Record<CasePipelineStatus, { label: string; description: string; coarse: CaseStatus }> = {
  new: { label: "חדש", description: "התיק נוצר ועדיין לא טופל", coarse: "new" },
  pending_assignment: { label: "ממתין לטיפול", description: "ממתין לנציג שירות", coarse: "in_progress" },
  data_review: { label: "בבדיקת נתונים", description: "אימות נתוני המשלוח", coarse: "in_progress" },
  pending_documents: { label: "ממתין למסמכים", description: "חסרים מסמכים מהלקוח", coarse: "in_progress" },
  pending_customer_approval: { label: "ממתין לאישור לקוח", description: "הצעה/עלות נשלחה לאישור", coarse: "in_progress" },
  pending_credit: { label: "ממתין לאשראי", description: "מחלקת כספים", coarse: "in_progress" },
  ready_to_book: { label: "מוכן להזמנה", description: "ניתן לבצע Booking", coarse: "in_progress" },
  booked: { label: "הוזמן", description: "Booking בוצע", coarse: "in_progress" },
  preparing_shipment: { label: "בהכנת משלוח", description: "המחסן מכין את המשלוח", coarse: "in_progress" },
  ready_for_pickup: { label: "מוכן לאיסוף", description: "ממתין לבלדר", coarse: "in_progress" },
  picked_up: { label: "נאסף", description: "נאסף מהלקוח", coarse: "in_progress" },
  in_transit_to_port: { label: "בדרך לשדה/נמל", description: "Transit פנימי", coarse: "in_progress" },
  received_at_terminal: { label: "התקבל במסוף", description: "Cargo Terminal", coarse: "in_progress" },
  export_cleared: { label: "שוחרר ליצוא", description: "Export Cleared", coarse: "in_progress" },
  departed: { label: "יצא לדרך", description: "Flight/Vessel Departed", coarse: "in_progress" },
  in_transit: { label: "במעבר", description: "Transit", coarse: "in_progress" },
  arrived: { label: "הגיע ליעד", description: "Arrival", coarse: "in_progress" },
  customs_clearance: { label: "בשחרור מכס", description: "Customs Clearance", coarse: "in_progress" },
  ready_for_delivery: { label: "מוכן למסירה", description: "Ready for Delivery", coarse: "in_progress" },
  delivered: { label: "נמסר", description: "Delivered", coarse: "in_progress" },
  completed: { label: "הושלם", description: "Closed", coarse: "completed" },
  cancelled: { label: "בוטל", description: "Cancelled", coarse: "cancelled" },
};

export const CASE_PIPELINE_STATUS_ORDER: CasePipelineStatus[] = [
  "new",
  "pending_assignment",
  "data_review",
  "pending_documents",
  "pending_customer_approval",
  "pending_credit",
  "ready_to_book",
  "booked",
  "preparing_shipment",
  "ready_for_pickup",
  "picked_up",
  "in_transit_to_port",
  "received_at_terminal",
  "export_cleared",
  "departed",
  "in_transit",
  "arrived",
  "customs_clearance",
  "ready_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

export const updateCasePipelineStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: CasePipelineStatus }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    if (!CASE_PIPELINE_STATUS_ORDER.includes(input.status)) {
      throw new Error("status must be one of " + CASE_PIPELINE_STATUS_ORDER.join(", "));
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing, error: getErr } = await supabase
      .from("operations_cases")
      .select("payload")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) throw new Error("Case not found");

    const payload =
      existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : {};
    const nextPayload = { ...payload, pipelineStatus: data.status };
    const coarse = CASE_PIPELINE_STATUS_META[data.status].coarse;

    const { data: row, error } = await supabase
      .from("operations_cases")
      .update({ payload: nextPayload as never, status: coarse })
      .eq("id", data.id)
      .select("id, status, payload")
      .single();
    if (error) throw error;
    return row;
  });

// The service department's employee roster. These people don't have app
// logins (they're not rows in `profiles`), so this is a plain static list
// rather than a DB-backed lookup — matches what was handed over directly.
export type ServiceRepOption = { id: string; name: string; role: string; department: string };

export const SERVICE_REPS: ServiceRepOption[] = [
  { id: "keren-ohana", name: "קרן אוחנה", role: "מנהלת שירות", department: "שירות לקוחות" },
  { id: "oren-levi", name: "אורן לוי", role: "Customer Service Representative", department: "שירות לקוחות" },
  { id: "maya-cohen", name: "מאיה כהן", role: "Customer Success Manager", department: "שירות לקוחות" },
  { id: "daniel-raphael", name: "דניאל רפאל", role: "מתאם שילוחים", department: "שירות לקוחות" },
  { id: "roni-shahar", name: "רוני שחר", role: "מומחה תמיכת לקוחות", department: "שירות לקוחות" },
];

// Kept as a server fn (rather than importing the const directly into route
// files) so the roster can move to a real table later without touching
// call sites.
export const listServiceReps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => SERVICE_REPS);

// Once an operator records the case's Unifreight number (payload.unifreightNumber,
// entered on the case detail page), that number becomes the case's displayed
// identifier everywhere in the UI instead of the internal AFIK case_code.
// The DB's case_code / id are still the real keys used for routing and
// lookups — this only changes what's shown as "case number" on screen.
export function getCaseDisplayCode(payload: unknown, fallbackCode: string): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const raw = (payload as Record<string, unknown>).unifreightNumber;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return fallbackCode;
}

export type CaseRep = { id: string; name: string; role: string } | null;

// Migration-free: the assigned rep is stored on the case's payload JSONB
// (same read-modify-write pattern as updateQuoteOpsStatus), not a real
// column, so this works without touching the operations_cases schema.
export const assignCaseRep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; rep: CaseRep }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing, error: getErr } = await supabase
      .from("operations_cases")
      .select("payload")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) throw new Error("Case not found");

    const payload =
      existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : {};
    const nextPayload = { ...payload, assignedRep: data.rep };

    const { data: row, error } = await supabase
      .from("operations_cases")
      .update({ payload: nextPayload as never })
      .eq("id", data.id)
      .select("id, payload")
      .single();
    if (error) throw error;
    return row;
  });
