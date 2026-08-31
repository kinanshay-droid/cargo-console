-- Courier mobile portal: gives a courier (who is not a Supabase Auth user
-- and never logs in) a stable identity plus a personal link
-- (afiklog.com/courier/<token>) that shows their assigned tasks for today,
-- lets them mark pickup/delivery status, and upload a photo/signature as
-- proof of delivery.
--
-- Security model mirrors api_partners (see 20260807.. partner migration):
-- we never store the plaintext token, only a SHA-256 hash
-- (courier-token.server.ts). Every courier-portal server function is public
-- (no requireSupabaseAuth) and does its own token -> hash -> lookup, then
-- uses the service-role client scoped by courier.id/organization_id. There
-- is deliberately no RLS policy here granting the "anon" role any access —
-- the courier never talks to Postgres directly, only through those
-- server functions, so normal RLS (which assumes a Supabase Auth caller)
-- doesn't apply to the courier's own reads/writes at all.

CREATE TABLE public.couriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  access_token_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Staff (any org member) can see the courier list to assign cases; only
-- admins can create/edit/deactivate couriers or see their access link.
DROP POLICY IF EXISTS "Members can view org couriers" ON public.couriers;
CREATE POLICY "Members can view org couriers"
  ON public.couriers FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Admins manage org couriers" ON public.couriers;
CREATE POLICY "Admins manage org couriers"
  ON public.couriers FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP TRIGGER IF EXISTS couriers_set_updated_at ON public.couriers;
CREATE TRIGGER couriers_set_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS couriers_org_idx ON public.couriers (organization_id);

-- Everything else (which case is assigned to which courier, pickup/delivery
-- status, proof-of-delivery file paths) is stored on the case itself, under
-- payload.critilog.courierId and payload.courierTask, so no further schema
-- change to operations_cases is needed. Server functions read/write those
-- JSONB paths directly via the service-role client.
