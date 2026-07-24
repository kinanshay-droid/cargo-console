import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const completeSignupSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    organizationName: z.string().trim().min(2).max(80),
    organizationCode: z
      .string()
      .trim()
      .min(3)
      .max(16)
      .regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers"),
    fullName: z.string().trim().min(1).max(120),
  }),
  z.object({
    mode: z.literal("join"),
    organizationCode: z.string().trim().min(3).max(16),
    fullName: z.string().trim().min(1).max(120),
  }),
]);

/**
 * Completes signup after `supabase.auth.signUp`. The auth-trigger creates a
 * blank profile row; this fn either creates a new org (making the caller its
 * admin) or joins an existing org by code (as member). Runs with service role
 * because `user_roles` writes are locked to service_role via RLS.
 */
export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeSignupSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

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

    let organizationId: string;
    let role: "admin" | "member";

    if (data.mode === "create") {
      // Ensure code isn't taken.
      const { data: taken, error: takenErr } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("code", data.organizationCode)
        .maybeSingle();
      if (takenErr) throw new Error(takenErr.message);
      if (taken) throw new Error("That organization code is already in use. Try another.");

      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .insert({ name: data.organizationName, code: data.organizationCode })
        .select("id")
        .single();
      if (orgErr || !org) throw new Error(orgErr?.message ?? "Couldn't create organization");
      organizationId = org.id;
      role = "admin";
    } else {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("code", data.organizationCode)
        .maybeSingle();
      if (orgErr) throw new Error(orgErr.message);
      if (!org) throw new Error("No organization matches that code.");
      organizationId = org.id;
      role = "member";
    }

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: organizationId, full_name: data.fullName })
      .eq("id", userId);
    if (profileErr) throw new Error(profileErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role, organization_id: organizationId });
    if (roleErr) throw new Error(roleErr.message);

    return { organizationId, role };
  });
