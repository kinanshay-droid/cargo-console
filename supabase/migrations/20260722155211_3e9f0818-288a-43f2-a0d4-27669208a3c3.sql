
-- Quote status enum
DO $$ BEGIN
  CREATE TYPE public.quote_status AS ENUM ('draft','sent','approved','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipment_mode AS ENUM ('direct','console','transship');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  quote_code TEXT NOT NULL,
  customer_ref TEXT,
  customer_name TEXT,
  status public.quote_status NOT NULL DEFAULT 'draft',
  shipment_kind TEXT,
  shipment_mode public.shipment_mode NOT NULL DEFAULT 'direct',
  incoterm TEXT,
  origin_port TEXT,
  dest_port TEXT,
  transit_ports TEXT[] NOT NULL DEFAULT '{}',
  depart_date DATE,
  arrive_date DATE,
  agent TEXT,
  airline TEXT,
  currency TEXT,
  margin_pct NUMERIC,
  total NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, quote_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Members can insert org quotes"
  ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update org quotes"
  ON public.quotes FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Admins can delete org quotes"
  ON public.quotes FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX quotes_org_created_idx ON public.quotes (organization_id, created_at DESC);
