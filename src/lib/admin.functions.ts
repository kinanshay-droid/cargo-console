import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Real Supabase-backed replacement for the dead src/lib/api.ts client (a
// leftover from the original Lovable scaffold that called a generic REST API
// which was never built — see dashboard.account/users/roles/organization/
// audit-log.tsx). Everything here talks directly to the real tables created
// in the very first migration (organizations, profiles, user_roles,
// audit_log), the same tables get_user_org()/is_org_admin() already gate
// via RLS everywhere else in the app.

export type OrgUserRole = "admin" | "member";

export type OrgUser = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: OrgUserRole | null;
  customRoleId: string | null;
  customRoleName: string | null;
  createdAt: string;
};

// Custom roles are a second, softer permission layer — see the comment at
// the top of the 20260830090000_add_custom_roles.sql migration. The real
// admin/member split above still governs actual data access; these are
// purely organizational (which sidebar modules a member sees).
export const CUSTOM_ROLE_PERMISSION_KEYS = [
  "commercial",
  "operations",
  "shipments",
  "pickup_distribution",
  "warehouse",
] as const;
export type CustomRolePermissionKey = (typeof CUSTOM_ROLE_PERMISSION_KEYS)[number];
export type CustomRolePermissions = Partial<Record<CustomRolePermissionKey, boolean>>;
export type CustomRoleColor =
  "primary" | "accent" | "success" | "warning" | "destructive" | "muted";
const CUSTOM_ROLE_COLORS: CustomRoleColor[] = [
  "primary",
  "accent",
  "success",
  "warning",
  "destructive",
  "muted",
];

export type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  color: CustomRoleColor;
  permissions: CustomRolePermissions;
  createdAt: string;
  updatedAt: string;
};

function normalizeCustomRoleColor(value: string): CustomRoleColor {
  return (CUSTOM_ROLE_COLORS as string[]).includes(value) ? (value as CustomRoleColor) : "primary";
}

function normalizeCustomRolePermissions(value: unknown): CustomRolePermissions {
  if (typeof value !== "object" || value === null) return {};
  const out: CustomRolePermissions = {};
  for (const key of CUSTOM_ROLE_PERMISSION_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (v === true) out[key] = true;
  }
  return out;
}

function toCustomRole(row: {
  id: string;
  name: string;
  description: string | null;
  color: string;
  permissions: unknown;
  created_at: string;
  updated_at: string;
}): CustomRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: normalizeCustomRoleColor(row.color),
    permissions: normalizeCustomRolePermissions(row.permissions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Throws a friendly error (instead of an opaque RLS-denied Postgres error)
// if the caller isn't an admin of their own organization. Returns the
// organization id for convenience, since almost every admin action needs it
// right after checking.
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

export const listOrgUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    const [{ data: profiles, error: profilesErr }, { data: roles, error: rolesErr }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, is_active, created_at, custom_role_id")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
        supabase.from("user_roles").select("user_id, role").eq("organization_id", organizationId),
      ]);
    if (profilesErr) throw new Error(profilesErr.message);
    if (rolesErr) throw new Error(rolesErr.message);

    const customRoleIds = Array.from(
      new Set((profiles ?? []).map((p) => p.custom_role_id).filter((v): v is string => !!v)),
    );
    const customRoleNameById = new Map<string, string>();
    if (customRoleIds.length > 0) {
      const { data: customRoles, error: customRolesErr } = await supabase
        .from("custom_roles")
        .select("id, name")
        .in("id", customRoleIds);
      if (customRolesErr) throw new Error(customRolesErr.message);
      for (const r of customRoles ?? []) customRoleNameById.set(r.id, r.name);
    }

    const roleByUser = new Map<string, OrgUserRole>();
    for (const r of roles ?? []) roleByUser.set(r.user_id, r.role);

    return (profiles ?? []).map<OrgUser>((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      isActive: p.is_active,
      role: roleByUser.get(p.id) ?? null,
      customRoleId: p.custom_role_id,
      customRoleName: p.custom_role_id ? (customRoleNameById.get(p.custom_role_id) ?? null) : null,
      createdAt: p.created_at,
    }));
  });

export const listCustomRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgId(supabase, userId);
    const { data, error } = await supabase
      .from("custom_roles")
      .select("id, name, description, color, permissions, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toCustomRole);
  });

export const createCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      description?: string | null;
      color?: CustomRoleColor;
      permissions: CustomRolePermissions;
    }) => {
      if (!input?.name?.trim()) throw new Error("name is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const organizationId = await requireOrgAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("custom_roles")
      .insert({
        organization_id: organizationId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color ?? "primary",
        permissions: data.permissions,
        created_by: context.userId,
      })
      .select("id, name, description, color, permissions, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toCustomRole(row);
  });

export const updateCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name: string;
      description?: string | null;
      color: CustomRoleColor;
      permissions: CustomRolePermissions;
    }) => {
      if (!input?.id) throw new Error("id is required");
      if (!input?.name?.trim()) throw new Error("name is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await requireOrgAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("custom_roles")
      .update({
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color,
        permissions: data.permissions,
      })
      .eq("id", data.id)
      .select("id, name, description, color, permissions, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toCustomRole(row);
  });

export const deleteCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireOrgAdmin(context.supabase, context.userId);
    // profiles.custom_role_id has ON DELETE SET NULL, so anyone holding this
    // role is simply unassigned rather than blocking the delete.
    const { error } = await context.supabase.from("custom_roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; customRoleId: string | null }) => {
    if (!input?.targetUserId) throw new Error("targetUserId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);
    if (data.customRoleId) {
      const { data: role, error: roleErr } = await supabase
        .from("custom_roles")
        .select("organization_id")
        .eq("id", data.customRoleId)
        .maybeSingle();
      if (roleErr) throw new Error(roleErr.message);
      if (!role || role.organization_id !== organizationId) {
        throw new Error("Custom role not found in your organization");
      }
    }
    const { error } = await supabase
      .from("profiles")
      .update({ custom_role_id: data.customRoleId })
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inviteOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { fullName: string; email: string; password: string; role?: OrgUserRole }) => {
      if (!input?.fullName?.trim()) throw new Error("fullName is required");
      if (!input?.email?.trim()) throw new Error("email is required");
      if (!input?.password || input.password.length < 8) {
        throw new Error("password must be at least 8 characters");
      }
      if (input.role !== undefined && input.role !== "admin" && input.role !== "member") {
        throw new Error('role must be "admin" or "member"');
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const organizationId = await requireOrgAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim() },
    });
    if (createErr) {
      const msg = /already registered|already exists/i.test(createErr.message)
        ? "That email address is already in use."
        : createErr.message;
      throw new Error(msg);
    }
    const newUserId = created.user.id;

    // The on_auth_user_created trigger already inserted a blank profile row
    // (organization_id null) — fill it in now with service role, since the
    // new user has no session of their own yet for RLS to work with.
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: organizationId, full_name: data.fullName.trim() })
      .eq("id", newUserId);
    if (profileErr) throw new Error(profileErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role ?? "member", organization_id: organizationId });
    if (roleErr) throw new Error(roleErr.message);

    return { id: newUserId };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; isActive: boolean }) => {
    if (!input?.targetUserId) throw new Error("targetUserId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOrgAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("You can't deactivate your own account here.");
    }
    // RLS's "Admins update profiles in their org" policy covers this —
    // no service role needed.
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: data.isActive })
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeOrgUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string }) => {
    if (!input?.targetUserId) throw new Error("targetUserId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("You can't remove your own account here.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm the target actually belongs to the caller's org before
    // deleting their whole auth account — deleteUser has no org scoping of
    // its own.
    const { data: target, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target || target.organization_id !== organizationId) {
      throw new Error("User not found in your organization");
    }

    // Deletes the auth user; profiles/user_roles rows cascade via FK.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; newPassword: string }) => {
    if (!input?.targetUserId) throw new Error("targetUserId is required");
    if (!input?.newPassword || input.newPassword.length < 8) {
      throw new Error("newPassword must be at least 8 characters");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const organizationId = await requireOrgAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("id", data.targetUserId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target || target.organization_id !== organizationId) {
      throw new Error("User not found in your organization");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string; role: OrgUserRole }) => {
    if (!input?.targetUserId) throw new Error("targetUserId is required");
    if (input.role !== "admin" && input.role !== "member") {
      throw new Error('role must be "admin" or "member"');
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);
    if (data.targetUserId === userId && data.role === "member") {
      throw new Error("You can't remove your own admin access here.");
    }
    // user_roles has no INSERT/UPDATE/DELETE RLS policy for regular
    // members — by design, writes go through service role only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.targetUserId)
      .eq("organization_id", organizationId);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.targetUserId, role: data.role, organization_id: organizationId });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export type OrganizationInfo = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
};

export const getMyOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgId(supabase, userId);
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, code, created_at")
      .eq("id", organizationId)
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      createdAt: data.created_at,
    } satisfies OrganizationInfo;
  });

export const updateMyOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => {
    if (!input?.name?.trim()) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);
    // RLS's "Admins update their organization" policy covers this directly.
    const { error } = await supabase
      .from("organizations")
      .update({ name: data.name.trim() })
      .eq("id", organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  createdAt: string;
  actorName: string | null;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { entityType?: string; from?: string; to?: string } | undefined) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const organizationId = await requireOrgAdmin(supabase, userId);

    let query = supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, changes, created_at, user_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.entityType?.trim()) query = query.ilike("entity_type", `%${data.entityType.trim()}%`);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter((v): v is string => !!v)),
    );
    const namesById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profiles ?? []) namesById.set(p.id, p.full_name || p.email);
    }

    return (rows ?? []).map<AuditLogRow>((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      changes: r.changes,
      createdAt: r.created_at,
      actorName: r.user_id ? (namesById.get(r.user_id) ?? null) : null,
    }));
  });
