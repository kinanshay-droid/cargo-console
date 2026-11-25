import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

/** Public URL of the signed-in user's organization logo, or null if none. */
export function useOrgLogo() {
  const { user } = useCurrentUser();
  const orgId = user?.organizationId ?? null;
  const query = useQuery({
    queryKey: ["org-logo", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("logo_path")
        .eq("id", orgId!)
        .maybeSingle();
      if (error || !data?.logo_path) return null;
      return supabase.storage.from("org-logos").getPublicUrl(data.logo_path).data.publicUrl;
    },
  });
  return query.data ?? null;
}
