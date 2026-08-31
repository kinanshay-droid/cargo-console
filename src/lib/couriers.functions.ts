import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Admin-facing management of couriers (see
// supabase/migrations/20260831090000_add_couriers.sql). Any org member can
// list couriers (needed to assign one to a case from the case detail page);
// only admins can create/edit/deactivate them or see a courier's personal
// link, since that link is effectively a bearer credential for that
// courier's tasks. Mirrors src/lib/api-partners.functions.ts's shape.

async function requireOrgAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.organization_id) throw new Error("User has no organization");

  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", profile.organization_id);
  if (rolesErr) throw new Error(rolesErr.message);
  if (!(roles ?? []).some((r) => r.role === "admin")) {
    throw new Error("Admins only");
  }
  return profile.organization_id;
}

async function requireOrgId(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile?.organization_id) throw new Error("User has no organization");
  return profile.organization_id;
}

export type Courier = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

// Any org member — used to populate the courier-assignment picker on the
// case detail page. Does not expose the access token in any form.
export const listCouriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgId(supabase, userId);

    const { data, error } = await supabase
      .from("couriers")
      .select("id, name, phone, is_active, created_at, last_used_at")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    return (data ?? []).map<Courier>((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      isActive: c.is_active,
      createdAt: c.created_at,
      lastUsedAt: c.last_used_at,
    }));
  });

// Returns the plaintext personal link token exactly once — it is never
// stored and can't be retrieved again after this call returns. The admin UI
// must show it in a "copy this now" dialog.
export const createCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; phone?: string | null }) => {
    if (!input?.name?.trim()) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { generateCourierTokenPlaintext, hashCourierToken } =
      await import("@/lib/courier-token.server");
    const plaintext = generateCourierTokenPlaintext();
    const hash = await hashCourierToken(plaintext);

    const { data: row, error } = await supabase
      .from("couriers")
      .insert({
        organization_id: organizationId,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        access_token_hash: hash,
        created_by: userId,
      })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, name: row.name, createdAt: row.created_at, token: plaintext };
  });

export const updateCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string; phone?: string | null }) => {
    if (!input?.id) throw new Error("id is required");
    if (!input?.name?.trim()) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { error } = await supabase
      .from("couriers")
      .update({ name: data.name.trim(), phone: data.phone?.trim() || null })
      .eq("id", data.id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCourierActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => {
    if (!input?.id) throw new Error("id is required");
    if (typeof input.active !== "boolean") throw new Error("active must be a boolean");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { error } = await supabase
      .from("couriers")
      .update({ is_active: data.active })
      .eq("id", data.id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Persists the case↔courier assignment immediately, separately from the
// case detail page's big "save" button. The courier Select used to only
// update local form state, so an assignment made right before some other
// action refetched the case (uploading a document, sending the report,
// placing signature fields — anything that invalidates the case query)
// got silently wiped: the page re-derives its whole form from the
// freshly-fetched payload, which still had the old, unsaved courierId.
// Also updates the free-text courier name to match, but only when
// assigning (courierId set) — clearing the assignment leaves any manually
// typed name alone rather than blanking it.
export const assignCaseCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; courierId: string | null }) => {
    if (!input?.caseId) throw new Error("caseId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgId(supabase, userId);

    const { data: existing, error: getErr } = await supabase
      .from("operations_cases")
      .select("payload")
      .eq("id", data.caseId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!existing) throw new Error("התיק לא נמצא");

    const payload =
      existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : {};
    const critilog =
      payload.critilog && typeof payload.critilog === "object" && !Array.isArray(payload.critilog)
        ? (payload.critilog as Record<string, unknown>)
        : {};

    let courierName: string | null = null;
    if (data.courierId) {
      const { data: courier, error: courierErr } = await supabase
        .from("couriers")
        .select("name")
        .eq("id", data.courierId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (courierErr) throw new Error(courierErr.message);
      if (!courier) throw new Error("בלדר לא נמצא");
      courierName = courier.name;
    }

    const nextCritilog = {
      ...critilog,
      courierId: data.courierId ?? "",
      ...(courierName !== null ? { courier: courierName } : {}),
    };
    const nextPayload = { ...payload, critilog: nextCritilog };

    const { error: updErr } = await supabase
      .from("operations_cases")
      .update({ payload: nextPayload as never })
      .eq("id", data.caseId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

// Invalidates the courier's existing personal link and issues a new one —
// for when a link leaks or a phone is lost. Returns the new plaintext token
// exactly once, same as createCourier.
export const regenerateCourierToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { generateCourierTokenPlaintext, hashCourierToken } =
      await import("@/lib/courier-token.server");
    const plaintext = generateCourierTokenPlaintext();
    const hash = await hashCourierToken(plaintext);

    const { error } = await supabase
      .from("couriers")
      .update({ access_token_hash: hash })
      .eq("id", data.id)
      .eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
    return { token: plaintext };
  });
