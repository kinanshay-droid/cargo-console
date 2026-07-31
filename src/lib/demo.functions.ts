import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEMO_CUSTOMERS_SEED } from "@/lib/demo-customers-seed";

const DEMO_EMAIL = "demo@demo.local";
const DEMO_PASSWORD = "demo-user-1234";
const DEMO_ORG_NAME = "Demo Organization";
const DEMO_ORG_CODE = "DEMO";
const DEMO_FULL_NAME = "Demo User";

/**
 * Ensures a demo user + demo organization exist, and returns credentials the
 * client can use to sign in. Idempotent: safe to call repeatedly.
 */
export const ensureDemoUser = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Ensure the org exists.
    let organizationId: string;
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("code", DEMO_ORG_CODE)
      .maybeSingle();
    if (org) {
      organizationId = org.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("organizations")
        .insert({ name: DEMO_ORG_NAME, code: DEMO_ORG_CODE })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "org create failed");
      organizationId = created.id;
    }

    // 2. Find or create the auth user.
    let userId: string | null = null;
    const { data: list, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const existing = list.users.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: DEMO_FULL_NAME },
      });
      if (error || !created.user) throw new Error(error?.message ?? "user create failed");
      userId = created.user.id;
    }

    // 3. Ensure profile is linked to the org.
    await supabaseAdmin
      .from("profiles")
      .update({ organization_id: organizationId, full_name: DEMO_FULL_NAME })
      .eq("id", userId);

    // 4. Ensure admin role exists.
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!roleRow) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin", organization_id: organizationId });
    }

    return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  },
);

/**
 * Seeds the 100 demo customers (from AFIK_Demo_Customers_100.xlsx) into
 * whichever organization the calling user belongs to — but only if that
 * organization's code is "DEMO". This intentionally uses the regular,
 * request-scoped Supabase client (requireSupabaseAuth), not the service-role
 * admin client ensureDemoUser() above uses, so it works even while that
 * admin-client Cloudflare env issue (see AGENTS/task notes) is unresolved,
 * and so it can never accidentally write demo rows into a real customer's
 * organization — a non-demo user's own org code will just never match.
 *
 * Idempotent: only inserts customer_codes that don't already exist in the
 * org, so it's safe to call on every demo login.
 */
export const seedDemoCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) return { inserted: 0, skipped: 0, reason: "no-organization" };

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("code")
      .eq("id", profile.organization_id)
      .maybeSingle();
    if (orgError) throw orgError;
    if (org?.code !== DEMO_ORG_CODE) {
      return { inserted: 0, skipped: 0, reason: "not-demo-organization" };
    }

    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("customer_code")
      .eq("organization_id", profile.organization_id);
    if (existingError) throw existingError;
    const existingCodes = new Set((existing ?? []).map((c) => c.customer_code));

    const toInsert = DEMO_CUSTOMERS_SEED.filter((c) => !existingCodes.has(c.customerCode)).map((c) => ({
      organization_id: profile.organization_id as string,
      created_by: userId,
      customer_code: c.customerCode,
      company_name: c.companyName,
      trade_name: c.tradeName,
      company_id: c.companyId,
      company_type: c.companyType,
      industry: c.industry,
      website: c.website,
      status: c.status,
    }));

    if (toInsert.length === 0) return { inserted: 0, skipped: DEMO_CUSTOMERS_SEED.length };

    const { error: insertError } = await supabase.from("customers").insert(toInsert);
    if (insertError) throw insertError;

    return { inserted: toInsert.length, skipped: DEMO_CUSTOMERS_SEED.length - toInsert.length };
  });
