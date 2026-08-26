// External-partner REST API: PATCH /api/v1/cases/:id/status — the simple
// 3-state push (picked_up | in_transit | delivered) a partner reports back,
// distinct from the internal 22-stage pipeline. See
// updatePartnerCaseStatus in src/lib/partner-api.server.ts.
import { createFileRoute } from "@tanstack/react-router";
import { authenticatePartner } from "@/integrations/supabase/partner-api-middleware";
import {
  updatePartnerCaseStatus,
  PartnerApiError,
  type PartnerStatus,
} from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/v1/cases/$id/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const auth = await authenticatePartner(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let body: { status?: PartnerStatus };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        if (!body?.status) {
          return Response.json({ error: "status is required" }, { status: 400 });
        }

        try {
          const updated = await updatePartnerCaseStatus(
            supabaseAdmin,
            auth.partner,
            params.id,
            body.status,
          );
          return Response.json({ case: updated });
        } catch (err) {
          if (err instanceof PartnerApiError)
            return Response.json({ error: err.message }, { status: err.status });
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
