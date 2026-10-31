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
  email: z.string().trim().toLowerCase().email().max(255),
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

    // Same address already waiting for review → don't pile up duplicates
    // (double-clicks, repeat submissions). The visitor just sees success.
    const { data: dup, error: dupErr } = await supabaseAdmin
      .from("company_signup_requests")
      .select("id")
      .eq("email", data.email)
      .eq("status", "pending")
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if ((dup ?? []).length > 0) return { ok: true as const };

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

export const countPendingCompanyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { count, error } = await context.supabase
      .from("company_signup_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return count ?? 0;
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

    // An invite can only create a *new* account. If this email already has
    // one (e.g. a test request filed with a staff member's own address),
    // fail up front with a clear message instead of creating an org we'd
    // then have to throw away.
    const { data: existingProfile, error: existingErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      // eq on the lowercased address: ilike would treat "_" / "%" in an
      // email as wildcards and could match a different person's account.
      .eq("email", reqRow.email.toLowerCase())
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existingProfile) {
      throw new Error("כבר קיים משתמש עם כתובת המייל הזו — לא ניתן לשלוח לה הזמנה חדשה");
    }

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: reqRow.company_name })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Couldn't create organization");

    // Everything after org creation is rolled back on failure so a failed
    // approval never leaves an orphan organization (or half-set-up user)
    // behind — the request simply stays pending and can be retried.
    let newUserId: string | null = null;
    // Set only when the automatic invite email could not be sent.
    let inviteLink: string | null = null;
    try {
      const redirectTo = `${getOrigin()}/reset-password`;
      const userMeta = { full_name: reqRow.contact_name };
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        reqRow.email,
        { data: userMeta, redirectTo },
      );
      if (invited?.user && !inviteErr) {
        newUserId = invited.user.id;
      } else {
        // Supabase's built-in mailer only delivers to the project team's own
        // addresses (and is heavily rate limited) until custom SMTP is
        // configured, so inviting an outside company's email commonly fails.
        // Fall back to generating the same invite link without sending any
        // email — the platform admin hands it to the company manually.
        const { data: generated, error: genErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email: reqRow.email,
          options: { data: userMeta, redirectTo },
        });
        if (genErr || !generated?.user || !generated.properties?.action_link) {
          throw new Error(inviteErr?.message ?? genErr?.message ?? "Couldn't create the invite");
        }
        newUserId = generated.user.id;
        inviteLink = generated.properties.action_link;
      }

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
    } catch (err) {
      if (newUserId) await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      throw err;
    }

    return { organizationId: org.id as string, inviteLink };
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

export type PlatformOrganization = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  userCount: number;
  admins: { id: string; fullName: string; email: string; hasSignedIn: boolean }[];
};

/**
 * Every organization on the platform, for AFIK staff. The regular
 * "משתמשים"/"ארגון" pages are deliberately scoped to the caller's own
 * organization, so an approved company never shows up there — this is the
 * cross-organization view. Service-role reads, gated by requirePlatformAdmin.
 */
export const listAllOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orgsRes, profilesRes, adminRolesRes, authUsersRes] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("id, name, code, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email, full_name, organization_id"),
      supabaseAdmin.from("user_roles").select("user_id, organization_id").eq("role", "admin"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (orgsRes.error) throw new Error(orgsRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (adminRolesRes.error) throw new Error(adminRolesRes.error.message);
    if (authUsersRes.error) throw new Error(authUsersRes.error.message);

    const signedIn = new Set(
      authUsersRes.data.users.filter((u) => !!u.last_sign_in_at).map((u) => u.id),
    );
    const profilesByOrg = new Map<string, typeof profilesRes.data>();
    for (const p of profilesRes.data ?? []) {
      if (!p.organization_id) continue;
      const list = profilesByOrg.get(p.organization_id) ?? [];
      list.push(p);
      profilesByOrg.set(p.organization_id, list);
    }
    const adminKeys = new Set(
      (adminRolesRes.data ?? []).map((r) => `${r.organization_id}:${r.user_id}`),
    );

    return (orgsRes.data ?? []).map<PlatformOrganization>((o) => {
      const members = profilesByOrg.get(o.id) ?? [];
      return {
        id: o.id,
        name: o.name,
        code: o.code,
        createdAt: o.created_at,
        userCount: members.length,
        admins: members
          .filter((m) => adminKeys.has(`${o.id}:${m.id}`))
          .map((m) => ({
            id: m.id,
            fullName: m.full_name,
            email: m.email,
            hasSignedIn: signedIn.has(m.id),
          })),
      };
    });
  });

const updateOrgSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,16}$/, "הקוד חייב להכיל 3-16 אותיות באנגלית או ספרות"),
});

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateOrgSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: clash, error: clashErr } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("code", data.code)
      .neq("id", data.id)
      .maybeSingle();
    if (clashErr) throw new Error(clashErr.message);
    if (clash) throw new Error("קוד הארגון כבר בשימוש בארגון אחר");

    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ name: data.name, code: data.code })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Permanently deletes an organization and — through the schema's
 * ON DELETE CASCADE foreign keys — its data (shipments, cases, quotes, roles…).
 * Its users' accounts are kept but detached (profiles.organization_id is set
 * to NULL). The caller's own organization can't be deleted, so a platform
 * admin can never lock themselves out.
 */
export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requirePlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    if (me?.organization_id === data.id) {
      throw new Error("אי אפשר למחוק את הארגון שלך");
    }

    const { error } = await supabaseAdmin.from("organizations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
