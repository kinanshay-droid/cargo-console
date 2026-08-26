import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Admin-facing management of external-partner API keys (see
// supabase/migrations/20260826120000_add_api_partners.sql). Lives on the
// organization page (dashboard.organization.tsx) — same requireOrgAdmin
// gating pattern as admin.functions.ts.

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

export type ApiPartner = {
  id: string;
  name: string;
  apiKeyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export const listApiPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("api_partners")
      .select("id, name, api_key_prefix, active, created_at, last_used_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map<ApiPartner>((p) => ({
      id: p.id,
      name: p.name,
      apiKeyPrefix: p.api_key_prefix,
      active: p.active,
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at,
    }));
  });

// Returns the plaintext API key exactly once — it is never stored and can't
// be retrieved again after this call returns. The admin UI must show it in
// a "copy this now" dialog.
export const createApiPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    if (!input?.name?.trim()) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { generateApiKeyPlaintext, hashApiKey, apiKeyDisplayPrefix } =
      await import("@/lib/api-key.server");
    const plaintext = generateApiKeyPlaintext();
    const hash = await hashApiKey(plaintext);
    const prefix = apiKeyDisplayPrefix(plaintext);

    const { data: row, error } = await supabase
      .from("api_partners")
      .insert({
        organization_id: organizationId,
        name: data.name.trim(),
        api_key_hash: hash,
        api_key_prefix: prefix,
        created_by: userId,
      })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, name: row.name, createdAt: row.created_at, apiKey: plaintext };
  });

export const setApiPartnerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id is required");
    if (typeof input.active !== "boolean") throw new Error("active must be a boolean");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const { data: row, error } = await supabase
      .from("api_partners")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("organization_id", organizationId)
      .select("id, active")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
