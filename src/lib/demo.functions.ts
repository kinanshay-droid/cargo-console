import { createServerFn } from "@tanstack/react-start";

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
