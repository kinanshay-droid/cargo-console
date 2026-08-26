// External-partner REST API: GET /api/v1/cases/:id — a single case, scoped
// to the requesting partner (404s, not a permission error, if the case
// exists but belongs to someone else — see getPartnerCase).
import { createFileRoute } from "@tanstack/react-router";
import { authenticatePartner } from "@/integrations/supabase/partner-api-middleware";
import { getPartnerCase, PartnerApiError } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/v1/cases/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticatePartner(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const found = await getPartnerCase(supabaseAdmin, auth.partner, params.id);
          return Response.json({ case: found });
        } catch (err) {
          if (err instanceof PartnerApiError)
            return Response.json({ error: err.message }, { status: err.status });
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
