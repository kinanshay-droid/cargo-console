import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    // Invite / password-recovery links land here when /reset-password isn't in
    // Supabase's allowed redirect URLs (it falls back to the Site URL). Send
    // those to the set-password page, keeping the token hash.
    const hash = window.location.hash;
    if (/type=(invite|recovery)|error_code=/.test(hash)) {
      window.location.replace(`/reset-password${hash}`);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setTarget(data.session ? "/dashboard/shipments" : "/login");
    });
  }, []);

  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  return <Navigate to={target} />;
}
