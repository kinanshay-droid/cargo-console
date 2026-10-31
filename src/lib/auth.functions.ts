import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const completeSignupSchema = z.object({
  organizationCode: z.string().trim().min(3).max(16),
  fullName: z.string().trim().min(1).max(120),
});

async function joinOrganizationByCode(userId: string, organizationCode: string, fullName: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Guard: user must not already belong to an org.
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);
  if (existing?.organization_id) {
    throw new Error("You already belong to an organization.");
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("code", organizationCode)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org) throw new Error("No organization matches that code.");
  const organizationId = org.id;
  const role = "member" as const;

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({ organization_id: organizationId, full_name: fullName })
    .eq("id", userId);
  if (profileErr) throw new Error(profileErr.message);

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role, organization_id: organizationId });
  if (roleErr) throw new Error(roleErr.message);

  return { organizationId, role };
}

/**
 * Completes signup after `supabase.auth.signUp`, joining an existing
 * organization by its code (as a member). Self-serve organization
 * *creation* was removed — new companies now go through the
 * request/approve flow in company-requests.functions.ts, which creates the
 * org and invites the first admin directly. Runs with service role because
 * `user_roles` writes are locked to service_role via RLS.
 */
export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeSignupSchema.parse(data))
  .handler(async ({ data, context }) => {
    return joinOrganizationByCode(context.userId, data.organizationCode, data.fullName);
  });

/**
 * When email confirmation is on, signUp() returns no session, so the join
 * can't be completed on the signup page. The org code + name are stashed in
 * the user's metadata instead (see signup.tsx); on their first signed-in
 * visit the dashboard calls this to finish the join. Returns { joined: false }
 * when there's nothing pending.
 */
export const completePendingJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const meta =
      (context.claims as { user_metadata?: Record<string, unknown> }).user_metadata ?? {};
    const code =
      typeof meta.join_org_code === "string" ? meta.join_org_code.trim().toUpperCase() : "";
    const name = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
    if (!code) return { joined: false as const };
    const result = await joinOrganizationByCode(context.userId, code, name || "משתמש");
    return { joined: true as const, ...result };
  });
