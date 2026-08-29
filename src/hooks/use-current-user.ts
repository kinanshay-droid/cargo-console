import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomRolePermissionKey, CustomRolePermissions } from "@/lib/admin.functions";

export type UserRole = "admin" | "member";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  role: UserRole | null;
  // Custom role assignment — a softer, UI-level permission layer on top of
  // the real admin/member split above (see the custom_roles migration).
  // Unassigned (both null, permissions {}) means "no extra restriction" —
  // same behavior as before this feature existed.
  customRoleId: string | null;
  customRoleName: string | null;
  permissions: CustomRolePermissions;
}

export function useCurrentUser() {
  const query = useQuery<CurrentUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return null;

      const userId = session.user.id;
      const email = session.user.email ?? "";

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, organization_id, custom_role_id")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const role: UserRole | null = roles?.some((r) => r.role === "admin")
        ? "admin"
        : roles && roles.length > 0
          ? "member"
          : null;

      let customRoleName: string | null = null;
      let permissions: CustomRolePermissions = {};
      if (profile?.custom_role_id) {
        const { data: customRole } = await supabase
          .from("custom_roles")
          .select("name, permissions")
          .eq("id", profile.custom_role_id)
          .maybeSingle();
        customRoleName = customRole?.name ?? null;
        if (customRole?.permissions && typeof customRole.permissions === "object") {
          permissions = customRole.permissions as CustomRolePermissions;
        }
      }

      return {
        id: userId,
        email,
        fullName: profile?.full_name ?? "",
        organizationId: profile?.organization_id ?? null,
        role,
        customRoleId: profile?.custom_role_id ?? null,
        customRoleName,
        permissions,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const demoRole = typeof window !== "undefined" ? window.localStorage.getItem("demo_role") : null;
  const dbIsAdmin = query.data?.role === "admin";
  // When impersonating a non-admin demo role, hide admin surfaces in the UI.
  const isAdmin = demoRole && demoRole !== "admin" ? false : dbIsAdmin;

  // No custom role assigned = unrestricted (today's behavior). Admins also
  // always see every module regardless of a custom role's permissions —
  // a custom role narrows a member's view, never an admin's.
  const hasPermission = (key: CustomRolePermissionKey): boolean => {
    if (isAdmin) return true;
    if (!query.data?.customRoleId) return true;
    return query.data.permissions[key] === true;
  };

  return {
    user: query.data ?? null,
    role: query.data?.role ?? null,
    isAdmin,
    isLoading: query.isLoading,
    customRoleName: query.data?.customRoleName ?? null,
    hasPermission,
  };
}
