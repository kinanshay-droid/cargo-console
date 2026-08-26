// External-partner REST API: GET /api/v1/cases (list this partner's cases)
// and POST /api/v1/cases (create a full case, live immediately — no
// approval gate, same as a case created from the site). Auth is an
// X-API-Key header, checked by authenticatePartner (see
// src/integrations/supabase/partner-api-middleware.ts) — there is no
// Supabase Auth session here, so every DB call in partner-api.server.ts is
// explicitly scoped to this partner.
import { createFileRoute } from "@tanstack/react-router";
import { authenticatePartner } from "@/integrations/supabase/partner-api-middleware";
import {
  createPartnerCase,
  listPartnerCases,
  PartnerApiError,
  type CreatePartnerCaseInput,
} from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/v1/cases")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticatePartner(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const cases = await listPartnerCases(supabaseAdmin, auth.partner);
          return Response.json({ cases });
        } catch (err) {
          if (err instanceof PartnerApiError)
            return Response.json({ error: err.message }, { status: err.status });
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const auth = await authenticatePartner(request);
        if ("error" in auth) return auth.error;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let body: CreatePartnerCaseInput;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        try {
          const created = await createPartnerCase(supabaseAdmin, auth.partner, body);
          return Response.json({ case: created }, { status: 201 });
        } catch (err) {
          if (err instanceof PartnerApiError)
            return Response.json({ error: err.message }, { status: err.status });
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
