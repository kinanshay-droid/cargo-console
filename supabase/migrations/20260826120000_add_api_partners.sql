-- External partner API access: lets an outside shipping/freight company
-- create cases, push simple status updates, and pull case info through a
-- REST API, scoped to only the cases it created. Multiple partners are
-- supported, each with its own API key.
--
-- api_partners holds one row per external company. The real credential
-- (api_key_hash) is a SHA-256 hash computed server-side (see
-- src/lib/api-key.server.ts) — the plaintext key is shown to the admin
-- exactly once at creation time and is never stored. api_key_prefix keeps a
-- short, non-secret slice of the key around purely so the admin UI can show
-- "which key is this" without revealing the whole thing.
--
-- Partner requests authenticate via an X-API-Key header (see
-- src/integrations/supabase/partner-api-middleware.ts), not a Supabase Auth
-- session, so they can't rely on RLS the way logged-in staff do. The
-- partner-facing API routes always use the service-role client and enforce
-- scoping in application code by filtering on api_partner_id — RLS here just
-- protects the table from the regular authenticated-staff surface (the admin
-- UI on dashboard.organization.tsx).
CREATE TABLE public.api_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.api_partners TO authenticated;
GRANT ALL ON public.api_partners TO service_role;

ALTER TABLE public.api_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view org api partners"
  ON public.api_partners FOR SELECT TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can create org api partners"
  ON public.api_partners FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id) AND created_by = auth.uid());

CREATE POLICY "Admins can update org api partners"
  ON public.api_partners FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE INDEX api_partners_org_idx ON public.api_partners (organization_id);

-- Scopes each case to the partner that created it via the API (NULL for
-- every case created from the site itself, which is the vast majority).
-- Partner-facing routes filter every query on this column so one partner
-- can never see another partner's — or AFIK's own — cases.
ALTER TABLE public.operations_cases
  ADD COLUMN api_partner_id UUID REFERENCES public.api_partners(id) ON DELETE SET NULL;

CREATE INDEX operations_cases_api_partner_idx ON public.operations_cases (api_partner_id);
