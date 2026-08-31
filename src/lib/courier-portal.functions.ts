import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Public, no-login courier mobile portal (see
// supabase/migrations/20260831090000_add_couriers.sql and
// src/lib/courier-token.server.ts). The courier is never a Supabase Auth
// user — every function here takes the personal-link token as an explicit
// input and validates it itself, deliberately with NO requireSupabaseAuth
// middleware. All reads/writes go through the service-role client
// (supabaseAdmin) scoped by the resolved courier's id/organizationId,
// mirroring how src/integrations/supabase/partner-api-middleware.ts +
// src/lib/partner-api.server.ts handle the external-partner API — a caller
// with no RLS principal, so every query must filter itself.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function toText(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

async function resolveCourier(token: string | undefined | null) {
  if (!token || !token.trim()) throw new Error("קישור לא תקין");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hashCourierToken } = await import("@/lib/courier-token.server");
  const hash = await hashCourierToken(token.trim());
  const { data: courier, error } = await supabaseAdmin
    .from("couriers")
    .select("id, organization_id, name, is_active")
    .eq("access_token_hash", hash)
    .maybeSingle();
  if (error) throw new Error("שגיאה באימות הקישור");
  if (!courier || !courier.is_active) throw new Error("קישור לא תקין או אינו פעיל יותר");

  // Best-effort — a failure here shouldn't block the actual request.
  void supabaseAdmin
    .from("couriers")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", courier.id);

  return courier;
}

export type CourierTaskStatus = "pending" | "picked_up" | "delivered";

// A staff-placed marker on the signature document (see documentPath below):
// "sign here" at a specific spot, with a short label like "איסוף" or
// "הפצה" so a document can carry more than one required signature.
// Percent-based (0–100) so it's independent of the document's actual pixel
// size — the same field works whether it's rendered as a small thumbnail or
// full-screen on a phone.
export type SignatureField = { id: string; label: string; xPercent: number; yPercent: number };

// A field's *kind* isn't stored explicitly — it's inferred from its label,
// so staff mark a "date" or "time" stamp spot the same way they mark a
// signature spot (click, type a label), just naming it "תאריך" / "שעה".
// Those spots are never tapped/signed by the courier: they're auto-filled
// with the timestamp of the nearest earlier *signature* field (see
// findLinkedSignatureField below) both in the courier's live view and in
// the composited signed document.
export type SignatureFieldKind = "signature" | "date" | "time";

export function inferSignatureFieldKind(label: string): SignatureFieldKind {
  const t = label.trim();
  if (t.startsWith("תאריך")) return "date";
  if (t.startsWith("שעה") || t.startsWith("שעת")) return "time";
  return "signature";
}

// A "תאריך"/"שעה" field is stamped from whichever real signature field
// comes right before it in placement order — matching the natural pattern
// staff use (e.g. איסוף, תאריך, שעה, מסירה, תאריך, שעה).
export function findLinkedSignatureField(
  fields: SignatureField[],
  index: number,
): SignatureField | null {
  for (let i = index - 1; i >= 0; i--) {
    if (inferSignatureFieldKind(fields[i].label) === "signature") return fields[i];
  }
  return null;
}

function formatDateHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTimeHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

// Pure — safe to call from both the server (Cloudflare Workers) and the
// browser (this is a .functions.ts file, which ships to the client bundle
// too), so the linking/formatting logic lives in exactly one place instead
// of being duplicated between the courier's auto-compose flow and staff's
// manual regenerate flow. Callers each resolve `path` (a signature field's
// raw storage path) to a real signed URL themselves, since that requires
// different auth depending on who's asking.
export type ComposeFieldMeta = SignatureField & {
  kind: SignatureFieldKind;
  path: string | null;
  displayText: string | null;
};

export function buildComposeFieldMeta(
  fields: SignatureField[],
  fieldSignaturePaths: Record<string, string>,
  fieldSignedAt: Record<string, string>,
): ComposeFieldMeta[] {
  return fields.map((f, i) => {
    const kind = inferSignatureFieldKind(f.label);
    if (kind === "signature") {
      return { ...f, kind, path: fieldSignaturePaths[f.id] ?? null, displayText: null };
    }
    const linked = findLinkedSignatureField(fields, i);
    const signedAt = linked ? fieldSignedAt[linked.id] : undefined;
    const displayText = signedAt
      ? kind === "date"
        ? formatDateHe(signedAt)
        : formatTimeHe(signedAt)
      : null;
    return { ...f, kind, path: null, displayText };
  });
}

type CourierTaskState = {
  status: CourierTaskStatus;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  proofPhotoPath: string | null;
  proofSignaturePath: string | null;
  // "Document to sign" — a file staff attaches to this specific case (see
  // uploadCaseSignatureDocument below), fresh per case. The courier views it
  // in the app; if signatureFields below is non-empty, the courier signs at
  // each marked spot (fieldSignaturePaths), otherwise they just confirm
  // with the generic proof-of-delivery signature pad above.
  documentPath: string | null;
  documentName: string | null;
  signatureFields: SignatureField[];
  fieldSignaturePaths: Record<string, string>;
  // When each signature field was actually captured — used to auto-fill
  // any linked "תאריך"/"שעה" fields (see findLinkedSignatureField above)
  // rather than requiring the courier to fill those in separately.
  fieldSignedAt: Record<string, string>;
  // A flattened copy of documentPath with every captured field signature
  // composited onto it at its marked spot — built client-side (see
  // src/lib/signed-document-composer.ts) once every field is signed, then
  // uploaded via uploadSignedDocument below. Cleared whenever the document
  // or the marker positions change, since it would no longer be accurate.
  signedDocumentPath: string | null;
  // Set when staff sends the printable "דוח משימה" (task report) into the
  // courier's app (see sendCourierTaskReport below) — an HTML snapshot of
  // the same report built by src/lib/courier-task-report.ts.
  reportPath: string | null;
  reportSentAt: string | null;
};

function isSignatureField(v: unknown): v is SignatureField {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.label === "string" &&
    typeof v.xPercent === "number" &&
    typeof v.yPercent === "number"
  );
}

function getCourierTaskState(payload: unknown): CourierTaskState {
  const p = isRecord(payload) ? payload : {};
  const raw = isRecord(p.courierTask) ? p.courierTask : {};
  const status: CourierTaskStatus =
    raw.status === "picked_up" || raw.status === "delivered" ? raw.status : "pending";
  const fieldSignaturePaths: Record<string, string> = {};
  if (isRecord(raw.fieldSignaturePaths)) {
    for (const [k, v] of Object.entries(raw.fieldSignaturePaths)) {
      if (typeof v === "string") fieldSignaturePaths[k] = v;
    }
  }
  const fieldSignedAt: Record<string, string> = {};
  if (isRecord(raw.fieldSignedAt)) {
    for (const [k, v] of Object.entries(raw.fieldSignedAt)) {
      if (typeof v === "string") fieldSignedAt[k] = v;
    }
  }
  return {
    status,
    pickedUpAt: typeof raw.pickedUpAt === "string" ? raw.pickedUpAt : null,
    deliveredAt: typeof raw.deliveredAt === "string" ? raw.deliveredAt : null,
    proofPhotoPath: typeof raw.proofPhotoPath === "string" ? raw.proofPhotoPath : null,
    proofSignaturePath: typeof raw.proofSignaturePath === "string" ? raw.proofSignaturePath : null,
    documentPath: typeof raw.documentPath === "string" ? raw.documentPath : null,
    documentName: typeof raw.documentName === "string" ? raw.documentName : null,
    signatureFields: Array.isArray(raw.signatureFields)
      ? raw.signatureFields.filter(isSignatureField)
      : [],
    fieldSignaturePaths,
    fieldSignedAt,
    signedDocumentPath: typeof raw.signedDocumentPath === "string" ? raw.signedDocumentPath : null,
    reportPath: typeof raw.reportPath === "string" ? raw.reportPath : null,
    reportSentAt: typeof raw.reportSentAt === "string" ? raw.reportSentAt : null,
  };
}

function getCritilog(payload: unknown): Record<string, unknown> {
  const p = isRecord(payload) ? payload : {};
  return isRecord(p.critilog) ? p.critilog : {};
}

const SHIP_KIND_LABEL_HE: Record<string, string> = {
  import: "ייבוא",
  export: "ייצוא",
  distribution: "דרופ",
  domestic: "פנים ארצי",
};

export type CourierTaskSummary = {
  caseId: string;
  code: string;
  customerName: string;
  kindLabel: string;
  pickupIsrael: string;
  route: string;
  status: CourierTaskStatus;
};

// The courier's own task list — cases assigned to them (payload.critilog.courierId)
// that are due today, or still open (not yet delivered) regardless of date so
// nothing a courier hasn't finished yet silently disappears from their list.
export const getCourierTasks = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => {
    if (!input?.token) throw new Error("token is required");
    return input;
  })
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, case_code, customer_name, shipment_kind, payload")
      .eq("organization_id", courier.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const tasks = (rows ?? [])
      .filter((r) => getCritilog(r.payload).courierId === courier.id)
      .map((r) => {
        const cl = getCritilog(r.payload);
        const state = getCourierTaskState(r.payload);
        const pickupIsrael = toText(cl.pickupIsrael);
        return {
          caseId: r.id,
          code: toText(cl.name) || r.case_code,
          customerName: toText(cl.customer) || r.customer_name || "—",
          kindLabel: r.shipment_kind
            ? (SHIP_KIND_LABEL_HE[r.shipment_kind] ?? r.shipment_kind)
            : "",
          pickupIsrael,
          route: toText(cl.route),
          status: state.status,
          _today: isToday(pickupIsrael),
        };
      })
      .filter((t) => t._today || t.status !== "delivered")
      .sort((a, b) => {
        if (a._today !== b._today) return a._today ? -1 : 1;
        return a.pickupIsrael.localeCompare(b.pickupIsrael);
      })
      .map(({ _today, ...t }): CourierTaskSummary => t);

    return { courierName: courier.name, tasks };
  });

export type CourierTaskPoint = {
  label?: string;
  address: string;
  contacts: { name: string; phone: string }[];
};

export type CourierTaskDetail = {
  caseId: string;
  code: string;
  customerName: string;
  kindLabel: string;
  pickupIsrael: string;
  pickupPoints: CourierTaskPoint[];
  deliveryPoints: CourierTaskPoint[];
  tempRangeLabel: string;
  dryIceLabel: string;
  blNumber: string;
  specialInstructions: string;
  notes: string;
  status: CourierTaskStatus;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  hasProofPhoto: boolean;
  hasProofSignature: boolean;
  hasDocument: boolean;
  documentName: string | null;
  documentIsPdf: boolean;
  hasReport: boolean;
  signatureFields: SignatureField[];
  signedFieldIds: string[];
  hasSignedDocument: boolean;
};

export const getCourierTaskDetail = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string; caseId: string }) => {
    if (!input?.token) throw new Error("token is required");
    if (!input?.caseId) throw new Error("caseId is required");
    return input;
  })
  .handler(async ({ data }): Promise<CourierTaskDetail> => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, case_code, customer_name, shipment_kind, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const p = isRecord(row.payload) ? row.payload : {};
    const state = getCourierTaskState(row.payload);

    function toContacts(raw: unknown): { name: string; phone: string }[] {
      if (!Array.isArray(raw)) return [];
      return raw
        .map((c) => (isRecord(c) ? { name: toText(c.name), phone: toText(c.phone) } : null))
        .filter((c): c is { name: string; phone: string } => !!c && (!!c.name || !!c.phone));
    }

    const stops = Array.isArray(p.stops) ? p.stops : [];
    const hasStops = !!p.dropType && stops.length > 0;
    function stopPoint(s: unknown, label?: string): CourierTaskPoint {
      const rec = isRecord(s) ? s : {};
      const contactName = toText(rec.contact) || toText(rec.company);
      const phone = toText(rec.phone);
      return {
        label,
        address:
          [toText(rec.company), toText(rec.address)].filter(Boolean).join(" — ") ||
          toText(rec.address),
        contacts: contactName || phone ? [{ name: contactName, phone }] : [],
      };
    }
    const pickupPoints: CourierTaskPoint[] = hasStops
      ? stops
          .filter((s) => isRecord(s) && s.kind === "Pickup")
          .map((s, i, arr) => stopPoint(s, arr.length > 1 ? `נקודת איסוף ${i + 1}` : undefined))
      : [{ address: toText(p.pickupAddress), contacts: toContacts(p.pickupContacts) }];
    const deliveryPoints: CourierTaskPoint[] = hasStops
      ? stops
          .filter((s) => isRecord(s) && s.kind === "Drop")
          .map((s, i, arr) => stopPoint(s, arr.length > 1 ? `נקודת מסירה ${i + 1}` : undefined))
      : [{ address: toText(p.deliveryAddress), contacts: toContacts(p.deliveryContacts) }];

    const tempSeriesList = Array.isArray(p.tempSeriesList)
      ? p.tempSeriesList.filter((v): v is string => typeof v === "string")
      : [];
    const tempRangeLabel = p.tempSeriesNone
      ? "ללא בקרת טמפרטורה"
      : tempSeriesList.length > 0
        ? tempSeriesList.join(", ")
        : "—";
    const packSelections = Array.isArray(p.packSelections) ? p.packSelections : [];
    const dryIceTotal = packSelections.reduce((sum: number, sel: unknown) => {
      const rec = isRecord(sel) ? sel : {};
      const qty = typeof rec.qty === "number" ? rec.qty : 0;
      const dryIce = typeof rec.dryIceQty === "number" ? rec.dryIceQty : 0;
      return sum + (qty > 0 ? dryIce : 0);
    }, 0);

    return {
      caseId: row.id,
      code: toText(cl.name) || row.case_code,
      customerName: toText(cl.customer) || row.customer_name || "—",
      kindLabel: row.shipment_kind
        ? (SHIP_KIND_LABEL_HE[row.shipment_kind] ?? row.shipment_kind)
        : "",
      pickupIsrael: toText(cl.pickupIsrael),
      pickupPoints,
      deliveryPoints,
      tempRangeLabel,
      dryIceLabel: dryIceTotal > 0 ? `${dryIceTotal} ק"ג` : "—",
      blNumber: toText(p.blNumber) || toText(p.unifreightNumber),
      specialInstructions: toText(p.specialReq),
      notes: toText(p.extraNotes) || toText(cl.opsNotes),
      status: state.status,
      pickedUpAt: state.pickedUpAt,
      deliveredAt: state.deliveredAt,
      hasProofPhoto: !!state.proofPhotoPath,
      hasProofSignature: !!state.proofSignaturePath,
      hasDocument: !!state.documentPath,
      documentName: state.documentName,
      documentIsPdf: !!state.documentPath?.toLowerCase().endsWith(".pdf"),
      hasReport: !!state.reportPath,
      signatureFields: state.signatureFields,
      signedFieldIds: Object.keys(state.fieldSignaturePaths),
      hasSignedDocument: !!state.signedDocumentPath,
    };
  });

export const updateCourierTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; caseId: string; status: "picked_up" | "delivered" }) => {
    if (!input?.token) throw new Error("token is required");
    if (!input?.caseId) throw new Error("caseId is required");
    if (input.status !== "picked_up" && input.status !== "delivered") {
      throw new Error("status must be picked_up or delivered");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const p = isRecord(row.payload) ? row.payload : {};
    const state = getCourierTaskState(row.payload);
    const now = new Date().toISOString();
    const nextState: CourierTaskState = {
      ...state,
      status: data.status,
      pickedUpAt: data.status === "picked_up" ? now : state.pickedUpAt,
      deliveredAt: data.status === "delivered" ? now : state.deliveredAt,
    };

    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true, status: nextState.status };
  });

// Stores a photo or signature as proof of delivery. The courier has no
// Supabase session, so this can't go through client-side Storage RLS —
// instead the browser sends the captured image as a base64 data URL and
// this server function decodes it and uploads via the service-role client
// into a private bucket, then records the storage path (not a public URL)
// on the case's payload. Staff view it back via a signed URL generated by
// a separate authenticated server function.
const PROOF_BUCKET = "courier-proofs";

export const uploadCourierProof = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; caseId: string; kind: "photo" | "signature"; dataUrl: string }) => {
      if (!input?.token) throw new Error("token is required");
      if (!input?.caseId) throw new Error("caseId is required");
      if (input.kind !== "photo" && input.kind !== "signature") {
        throw new Error("kind must be photo or signature");
      }
      if (!input?.dataUrl?.startsWith("data:image/"))
        throw new Error("dataUrl must be an image data URL");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("פורמט תמונה לא נתמך");
    const [, mime, base64] = match;
    const ext = mime === "image/png" ? "png" : "jpg";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${courier.organization_id}/${data.caseId}/${data.kind}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(row.payload) ? row.payload : {};
    const state = getCourierTaskState(row.payload);
    const nextState: CourierTaskState = {
      ...state,
      proofPhotoPath: data.kind === "photo" ? path : state.proofPhotoPath,
      proofSignaturePath: data.kind === "signature" ? path : state.proofSignaturePath,
    };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Staff-only (real Supabase Auth session) — generates a short-lived signed
// URL so office staff can view a courier's uploaded proof photo/signature
// back on the case detail page. The bucket is private, so this is the only
// way to view the file. Proof paths are stored as "<organizationId>/...",
// so a staff member can only ever sign a URL for their own org's files.
export const getCourierProofUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => {
    if (!input?.path) throw new Error("path is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.organization_id || !data.path.startsWith(`${profile.organization_id}/`)) {
      throw new Error("אין הרשאה לצפות בקובץ זה");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

async function requireCaseInOrg(
  supabase: SupabaseClient<Database>,
  userId: string,
  caseId: string,
): Promise<{ organizationId: string; payload: unknown }> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.organization_id) throw new Error("User has no organization");

  const { data: row, error } = await supabase
    .from("operations_cases")
    .select("id, payload, organization_id")
    .eq("id", caseId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("התיק לא נמצא");
  return { organizationId: row.organization_id, payload: row.payload };
}

// Staff-side: attach a fresh document to this case that the courier will see
// in their app (e.g. a waybill that needs to be signed on delivery). Each
// upload replaces the previous one — "בכל תיק מחדש" — the old file is left
// orphaned in storage rather than deleted, which is fine for a private
// bucket nobody browses directly.
export const uploadCaseSignatureDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; fileName: string; dataUrl: string }) => {
    if (!input?.caseId) throw new Error("caseId is required");
    if (!input?.fileName?.trim()) throw new Error("fileName is required");
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("dataUrl must be a data URL");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organizationId, payload } = await requireCaseInOrg(supabase, userId, data.caseId);

    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("פורמט קובץ לא נתמך");
    const [, mime, base64] = match;
    const safeName = data.fileName.trim().replace(/[^\w.\-֐-׿ ]+/g, "_");
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${organizationId}/${data.caseId}/document-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(payload) ? payload : {};
    const state = getCourierTaskState(payload);
    // A fresh document invalidates any previously-placed signature markers
    // and whatever was signed against them — they pointed at spots on the
    // old file.
    const nextState: CourierTaskState = {
      ...state,
      documentPath: path,
      documentName: safeName,
      signatureFields: [],
      fieldSignaturePaths: {},
      fieldSignedAt: {},
      signedDocumentPath: null,
    };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Staff-side: overwrite the list of "sign here" markers placed on the
// current signature document (position + label, e.g. "איסוף" / "הפצה").
// Whole-list replace, called after every add/remove in the placement UI —
// simpler than a diff, and the list is always small.
export const updateCaseSignatureFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; fields: SignatureField[] }) => {
    if (!input?.caseId) throw new Error("caseId is required");
    if (!Array.isArray(input?.fields)) throw new Error("fields must be an array");
    for (const f of input.fields) {
      if (
        !f ||
        typeof f.id !== "string" ||
        typeof f.label !== "string" ||
        typeof f.xPercent !== "number" ||
        typeof f.yPercent !== "number"
      ) {
        throw new Error("invalid field");
      }
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { payload } = await requireCaseInOrg(supabase, userId, data.caseId);

    const p = isRecord(payload) ? payload : {};
    const state = getCourierTaskState(payload);
    // Drop any signature already captured for a field that no longer
    // exists (removed by staff).
    const keepIds = new Set(data.fields.map((f) => f.id));
    const fieldSignaturePaths = Object.fromEntries(
      Object.entries(state.fieldSignaturePaths).filter(([id]) => keepIds.has(id)),
    );
    const fieldSignedAt = Object.fromEntries(
      Object.entries(state.fieldSignedAt).filter(([id]) => keepIds.has(id)),
    );
    const nextState: CourierTaskState = {
      ...state,
      signatureFields: data.fields,
      fieldSignaturePaths,
      fieldSignedAt,
      // Marker positions changed, so any previously-composited signed copy
      // no longer lines up and must be rebuilt.
      signedDocumentPath: null,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Public, token-validated: the courier signs one specific marked field on
// the document (as opposed to uploadCourierProof's single generic
// proof-of-delivery signature). Same base64-data-URL-in, storage-path-out
// shape as uploadCourierProof.
export const uploadCourierFieldSignature = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; caseId: string; fieldId: string; dataUrl: string }) => {
    if (!input?.token) throw new Error("token is required");
    if (!input?.caseId) throw new Error("caseId is required");
    if (!input?.fieldId) throw new Error("fieldId is required");
    if (!input?.dataUrl?.startsWith("data:image/"))
      throw new Error("dataUrl must be an image data URL");
    return input;
  })
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const state = getCourierTaskState(row.payload);
    const targetField = state.signatureFields.find((f) => f.id === data.fieldId);
    if (!targetField) {
      throw new Error("שדה החתימה לא נמצא");
    }
    // "תאריך"/"שעה" fields are never signed directly — they're auto-filled
    // from the linked signature field's timestamp (see
    // findLinkedSignatureField). Reject an attempt to sign one directly.
    if (inferSignatureFieldKind(targetField.label) !== "signature") {
      throw new Error("שדה זה מתמלא אוטומטית ואינו דורש חתימה");
    }
    // Signing must follow the order the (real, signable) fields were
    // defined in on the document — reject any attempt to sign out of turn
    // (the client also hides/locks non-active pins, but the server is the
    // real gate).
    const nextField = state.signatureFields.find(
      (f) =>
        inferSignatureFieldKind(f.label) === "signature" && !(f.id in state.fieldSignaturePaths),
    );
    if (nextField && nextField.id !== data.fieldId) {
      throw new Error(`יש לחתום קודם על "${nextField.label}"`);
    }

    const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("פורמט תמונה לא נתמך");
    const [, mime, base64] = match;
    const ext = mime === "image/png" ? "png" : "jpg";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${courier.organization_id}/${data.caseId}/field-${data.fieldId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(row.payload) ? row.payload : {};
    const nextState: CourierTaskState = {
      ...state,
      fieldSignaturePaths: { ...state.fieldSignaturePaths, [data.fieldId]: path },
      fieldSignedAt: { ...state.fieldSignedAt, [data.fieldId]: new Date().toISOString() },
    };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Public, token-validated: for the courier's own client-side compositing
// step (see src/lib/signed-document-composer.ts) — returns every marked
// field with everything needed to draw it: for a signature field, a
// short-lived signed URL to its captured image (null if not yet signed);
// for a "תאריך"/"שעה" field, the formatted stamp text taken from its
// linked signature field's own signing time (see buildComposeFieldMeta).
// The browser never sees a raw storage path.
export type CourierFieldSignatureUrl = ComposeFieldMeta & { signedUrl: string | null };

export const getCourierFieldSignatureUrls = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string; caseId: string }) => {
    if (!input?.token) throw new Error("token is required");
    if (!input?.caseId) throw new Error("caseId is required");
    return input;
  })
  .handler(async ({ data }): Promise<{ fields: CourierFieldSignatureUrl[] }> => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const state = getCourierTaskState(row.payload);
    const meta = buildComposeFieldMeta(
      state.signatureFields,
      state.fieldSignaturePaths,
      state.fieldSignedAt,
    );
    const fields = await Promise.all(
      meta.map(async (m): Promise<CourierFieldSignatureUrl> => {
        if (!m.path) return { ...m, signedUrl: null };
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(PROOF_BUCKET)
          .createSignedUrl(m.path, 60 * 10);
        return { ...m, signedUrl: signErr ? null : signed.signedUrl };
      }),
    );
    return { fields };
  });

// Staff-side equivalent of uploadSignedDocument below — lets staff manually
// (re)compose the signed document from the case detail page (see
// src/lib/signed-document-composer.ts), for cases where the courier's
// browser closed before the automatic compositing step finished (a real
// risk on mobile — couriers tend to background/close the tab the instant
// they're done).
export const regenerateSignedDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; dataUrl: string }) => {
    if (!input?.caseId) throw new Error("caseId is required");
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("dataUrl must be a data URL");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organizationId, payload } = await requireCaseInOrg(supabase, userId, data.caseId);

    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("פורמט קובץ לא נתמך");
    const [, mime, base64] = match;
    const ext = mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : "png";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${organizationId}/${data.caseId}/signed-document-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(payload) ? payload : {};
    const state = getCourierTaskState(payload);
    const nextState: CourierTaskState = { ...state, signedDocumentPath: path };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Public, token-validated: stores the flattened "signed document" the
// courier's browser composites once every marked field has been signed —
// the original document with each captured signature drawn onto it at its
// marked spot (see src/lib/signed-document-composer.ts). Same
// data-URL-in/storage-path-out shape as the other courier uploads, except
// the mime type isn't constrained to images since a signed PDF stays a PDF.
export const uploadSignedDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; caseId: string; dataUrl: string }) => {
    if (!input?.token) throw new Error("token is required");
    if (!input?.caseId) throw new Error("caseId is required");
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("dataUrl must be a data URL");
    return input;
  })
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const match = /^data:([^;]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("פורמט קובץ לא נתמך");
    const [, mime, base64] = match;
    const ext = mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : "png";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${courier.organization_id}/${data.caseId}/signed-document-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(row.payload) ? row.payload : {};
    const state = getCourierTaskState(row.payload);
    const nextState: CourierTaskState = { ...state, signedDocumentPath: path };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Staff-side: push the same "דוח משימה" HTML the case page already builds
// (src/lib/courier-task-report.ts) into the courier's app for this specific
// case, so the courier can open the full task report on their phone instead
// of it only being printable from the office.
export const sendCourierTaskReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; html: string }) => {
    if (!input?.caseId) throw new Error("caseId is required");
    if (!input?.html?.trim()) throw new Error("html is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organizationId, payload } = await requireCaseInOrg(supabase, userId, data.caseId);

    const path = `${organizationId}/${data.caseId}/report-${Date.now()}.html`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .upload(path, new TextEncoder().encode(data.html), {
        contentType: "text/html; charset=utf-8",
        upsert: false,
      });
    if (uploadErr) throw new Error(uploadErr.message);

    const p = isRecord(payload) ? payload : {};
    const state = getCourierTaskState(payload);
    const nextState: CourierTaskState = {
      ...state,
      reportPath: path,
      reportSentAt: new Date().toISOString(),
    };
    const { error: updErr } = await supabaseAdmin
      .from("operations_cases")
      .update({ payload: { ...p, courierTask: nextState } })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Public, token-validated equivalent of getCourierProofUrl for the courier's
// own app — takes a "kind" instead of a raw storage path so the courier
// client never needs to see (or be able to guess) real storage paths; the
// path is resolved server-side from that case's own courierTask state after
// confirming the case really is assigned to this courier.
export const getCourierFileUrl = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      token: string;
      caseId: string;
      kind: "photo" | "signature" | "document" | "report" | "signed-document";
    }) => {
      if (!input?.token) throw new Error("token is required");
      if (!input?.caseId) throw new Error("caseId is required");
      if (!["photo", "signature", "document", "report", "signed-document"].includes(input.kind)) {
        throw new Error("invalid kind");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const courier = await resolveCourier(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operations_cases")
      .select("id, payload")
      .eq("id", data.caseId)
      .eq("organization_id", courier.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("המשימה לא נמצאה");
    const cl = getCritilog(row.payload);
    if (cl.courierId !== courier.id) throw new Error("המשימה אינה משויכת לבלדר זה");

    const state = getCourierTaskState(row.payload);
    const path =
      data.kind === "photo"
        ? state.proofPhotoPath
        : data.kind === "signature"
          ? state.proofSignaturePath
          : data.kind === "document"
            ? state.documentPath
            : data.kind === "signed-document"
              ? state.signedDocumentPath
              : state.reportPath;
    if (!path) throw new Error("הקובץ אינו זמין");

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (signErr) throw new Error(signErr.message);
    return { url: signed.signedUrl };
  });
