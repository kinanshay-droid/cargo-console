import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Gated onboarding: a company fills the public request form
// (submitCompanyRequest, no auth) instead of being able to self-create an
// organization. An AFIK platform admin (profiles.is_platform_admin) then
// reviews it (listCompanyRequests) and either approves it — which creates
// the organization and emails the requester an invite to set their
// password and sign in as that org's first admin — or rejects it.

export type CompanyRequestStatus = "pending" | "approved" | "rejected";

export type CompanyRequest = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: CompanyRequestStatus;
  organizationId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

async function requirePlatformAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_platform_admin) throw new Error("Platform admins only");
}

// Derives the site origin server-side (no `window` here) for the invite
// email's redirect link. Falls back to the known production domain — this
// flow only ever runs from the real deployment, not local dev.
function getOrigin(): string {
  try {
    const request = getRequest();
    const host = request?.headers?.get("host");
    if (host) return `https://${host}`;
  } catch {
    /* no live request context (e.g. local script) */
  }
  return "https://afiklog.com";
}

const submitSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  message: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
});

/**
 * Public endpoint (no auth) — the "request access" form on the marketing
 * site. Writes with the service-role client since anonymous visitors have
 * no table grants on company_signup_requests (see the migration).
 */
export const submitCompanyRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("company_signup_requests").insert({
      company_name: data.companyName,
      contact_name: data.contactName,
      email: data.email,
      phone: data.phone,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listCompanyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("company_signup_requests")
      .select(
        "id, company_name, contact_name, email, phone, message, status, organization_id, rejection_reason, created_at, reviewed_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map<CompanyRequest>((r) => ({
      id: r.id,
      companyName: r.company_name,
      contactName: r.contact_name,
      email: r.email,
      phone: r.phone,
      message: r.message,
      status: r.status as CompanyRequestStatus,
      organizationId: r.organization_id,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }));
  });

const approveSchema = z.object({ requestId: z.string().uuid() });

/**
 * Creates the organization, invites the requester by email as its first
 * admin (Supabase sends its built-in invite email; clicking it signs the
 * user in and lands them on /reset-password to choose a password — the
 * same page the "forgot password" flow uses), and marks the request
 * approved. Runs with service role: org creation + user_roles writes are
 * locked to service_role via RLS, and inviting a user requires the Auth
 * admin API.
 */
export const approveCompanyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from("company_signup_requests")
      .select("id, company_name, contact_name, email, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!reqRow) throw new Error("Request not found");
    if (reqRow.status !== "pending") throw new Error("This request was already reviewed");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: reqRow.company_name })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Couldn't create organization");

    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      reqRow.email,
      {
        data: { full_name: reqRow.contact_name },
        redirectTo: `${getOrigin()}/reset-password`,
      },
    );
    if (inviteErr || !invited?.user) {
      throw new Error(inviteErr?.message ?? "Couldn't send the invite email");
    }
    const newUserId = invited.user.id;

    // The on_auth_user_created trigger already inserted a blank profile row
    // for newUserId — fill in the org + name.
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: org.id, full_name: reqRow.contact_name })
      .eq("id", newUserId);
    if (profileErr) throw new Error(profileErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "admin", organization_id: org.id });
    if (roleErr) throw new Error(roleErr.message);

    const { error: updateReqErr } = await supabaseAdmin
      .from("company_signup_requests")
      .update({
        status: "approved",
        organization_id: org.id,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (updateReqErr) throw new Error(updateReqErr.message);

    return { organizationId: org.id as string };
  });

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const rejectCompanyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from("company_signup_requests")
      .select("status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!reqRow) throw new Error("Request not found");
    if (reqRow.status !== "pending") throw new Error("This request was already reviewed");

    const { error } = await supabaseAdmin
      .from("company_signup_requests")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
