// Server functions for the external customer portal.
//
// - getPortalSession / listPortalQuotes / listPortalCases run under
//   requirePortalAuth (see portal-auth-middleware.ts) — the middleware
//   already resolved the caller's customer_id via customer_portal_access,
//   and Postgres RLS (migration 20260814090000_customer_portal.sql) is the
//   real boundary limiting what rows come back, not application code.
// - invitePortalUser / listPortalUsers / revokePortalAccess /
//   revokePortalInvite are the AFIK-staff-side admin functions (used from
//   the customer detail page's "פורטל לקוח" tab), so they run under the
//   normal requireSupabaseAuth used everywhere else in the dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePortalAuth } from "@/integrations/supabase/portal-auth-middleware";

export const getPortalSession = createServerFn({ method: "GET" })
  .middleware([requirePortalAuth])
  .handler(async ({ context }) => {
    const { supabase, customerId, email } = context;
    const { data: customer, error } = await supabase
      .from("customers")
      .select("id, company_name, trade_name, customer_code, logo_url")
      .eq("id", customerId)
      .maybeSingle();
    if (error) throw error;
    return { customer, email };
  });

export const listPortalQuotes = createServerFn({ method: "GET" })
  .middleware([requirePortalAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quotes")
      .select(
        "id, quote_code, status, shipment_kind, shipment_mode, incoterm, origin_port, dest_port, depart_date, arrive_date, currency, total, created_at, payload",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    // opsStatus "archived" means this quote was transferred into a case —
    // the case (in listPortalCases) is the live record from here on, so
    // showing both would just be the same shipment twice.
    return (data ?? []).filter((q) => {
      const payload = q.payload && typeof q.payload === "object" && !Array.isArray(q.payload) ? (q.payload as Record<string, unknown>) : {};
      return payload.opsStatus !== "archived";
    });
  });

export const listPortalCases = createServerFn({ method: "GET" })
  .middleware([requirePortalAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("operations_cases")
      .select(
        "id, case_code, status, shipment_kind, shipment_mode, incoterm, origin_port, dest_port, transit_ports, depart_date, arrive_date, currency, total, created_at, updated_at, payload",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ---------- AFIK-staff admin functions ----------

export type PortalUserRow = {
  id: string;
  email: string;
  status: "invited" | "active" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
  accessId: string | null;
};

// Merges customer_portal_invites + customer_portal_access into one list for
// the admin UI — an accepted invite and its access row describe the same
// person, so they're shown as a single "active" entry rather than two rows.
export const listPortalUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: invites, error: invitesErr }, { data: access, error: accessErr }] = await Promise.all([
      supabase
        .from("customer_portal_invites")
        .select("id, email, status, created_at, accepted_at")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false }),
      supabase.from("customer_portal_access").select("id, email").eq("customer_id", data.customerId),
    ]);
    if (invitesErr) throw invitesErr;
    if (accessErr) throw accessErr;

    const accessByEmail = new Map((access ?? []).map((a) => [a.email.toLowerCase(), a.id]));

    const rows: PortalUserRow[] = (invites ?? []).map((inv) => {
      const accessId = accessByEmail.get(inv.email.toLowerCase()) ?? null;
      const status: PortalUserRow["status"] = inv.status === "revoked" ? "revoked" : accessId ? "active" : "invited";
      return {
        id: inv.id,
        email: inv.email,
        status,
        invitedAt: inv.created_at,
        acceptedAt: inv.accepted_at,
        accessId,
      };
    });
    return rows;
  });

export const invitePortalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; email: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    const email = input?.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("כתובת אימייל לא תקינה");
    return { customerId: input.customerId, email };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) throw new Error("User has no organization");

    // Re-inviting an email that was previously revoked resets it to
    // pending instead of hitting the (customer_id, email) unique
    // constraint — same "upsert, don't fail on retry" pattern used
    // elsewhere in this codebase.
    const { data: row, error } = await supabase
      .from("customer_portal_invites")
      .upsert(
        {
          organization_id: profile.organization_id,
          customer_id: data.customerId,
          email: data.email,
          invited_by: userId,
          status: "pending",
          accepted_at: null,
        },
        { onConflict: "customer_id,email" },
      )
      .select("id, email, status, created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const revokePortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string; accessId: string | null }) => {
    if (!input?.inviteId) throw new Error("inviteId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: inviteErr } = await supabase
      .from("customer_portal_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId);
    if (inviteErr) throw inviteErr;

    if (data.accessId) {
      // Requires org-admin under RLS (see migration) — a plain member can
      // revoke a still-pending invite above, but removing someone's already
      // -active login needs the stricter check.
      const { error: accessErr } = await supabase.from("customer_portal_access").delete().eq("id", data.accessId);
      if (accessErr) throw accessErr;
    }
    return { ok: true };
  });
