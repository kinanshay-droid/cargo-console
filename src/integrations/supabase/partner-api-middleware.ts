// Auth for the external-partner REST API (src/routes/api.v1.*). A partner is
// not a Supabase Auth session — it presents a long-lived API key via the
// X-API-Key header instead of a Bearer JWT — so this is a plain helper
// called at the top of each server-route handler, not TanStack middleware:
// the exact response shape a thrown error produces inside request
// middleware isn't documented for raw server routes, and a public REST API
// needs a guaranteed, clean 401 JSON body rather than whatever the default
// SSR error page would render. Every handler does:
//
//   const auth = await authenticatePartner(request);
//   if ("error" in auth) return auth.error;
//   const { partner } = auth;
//
// Because there's no session, there's no RLS principal either: every
// partner-facing handler gets the service-role client and MUST filter every
// query by partner.id (api_partner_id) and partner.organizationId itself.
// See src/lib/partner-api.server.ts, which is the one place that's done, so
// route handlers never touch the database directly.
export type AuthenticatedPartner = {
  id: string;
  organizationId: string;
  name: string;
  // The admin who created this partner's API key. operations_cases.created_by
  // is a NOT NULL FK into auth.users, and a partner has no auth.users row of
  // its own, so cases created via the API are attributed to whichever admin
  // set up the integration — same idea as a "service account" owner.
  createdBy: string;
};

export async function authenticatePartner(
  request: Request,
): Promise<{ partner: AuthenticatedPartner } | { error: Response }> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || !apiKey.trim()) {
    return { error: Response.json({ error: "Missing X-API-Key header" }, { status: 401 }) };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { hashApiKey } = await import("@/lib/api-key.server");
  const hash = await hashApiKey(apiKey.trim());

  const { data: partner, error } = await supabaseAdmin
    .from("api_partners")
    .select("id, organization_id, name, active, created_by")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (error) {
    return {
      error: Response.json({ error: "Internal error validating API key" }, { status: 500 }),
    };
  }
  if (!partner || !partner.active) {
    return { error: Response.json({ error: "Invalid or inactive API key" }, { status: 401 }) };
  }

  // Best-effort — a failure here shouldn't block the actual request.
  void supabaseAdmin
    .from("api_partners")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", partner.id);

  return {
    partner: {
      id: partner.id,
      organizationId: partner.organization_id,
      name: partner.name,
      createdBy: partner.created_by,
    },
  };
}
