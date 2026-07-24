import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "member";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  role: UserRole | null;
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
          .select("full_name, organization_id")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId),
      ]);

      const role: UserRole | null = roles?.some((r) => r.role === "admin")
        ? "admin"
        : roles && roles.length > 0
          ? "member"
          : null;

      return {
        id: userId,
        email,
        fullName: profile?.full_name ?? "",
        organizationId: profile?.organization_id ?? null,
        role,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const demoRole =
    typeof window !== "undefined" ? window.localStorage.getItem("demo_role") : null;
  const dbIsAdmin = query.data?.role === "admin";
  // When impersonating a non-admin demo role, hide admin surfaces in the UI.
  const isAdmin = demoRole && demoRole !== "admin" ? false : dbIsAdmin;

  return {
    user: query.data ?? null,
    role: query.data?.role ?? null,
    isAdmin,
    isLoading: query.isLoading,
  };
}
