-- Operations cases: when a quote's status is set to "transferred" (הועבר),
-- its full commercial detail is copied into an operational case that lives
-- in the Operations module (מודול שירות / dashboard.operations).
DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM ('new','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.operations_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  case_code TEXT NOT NULL,
  status public.case_status NOT NULL DEFAULT 'new',
  customer_ref TEXT,
  customer_name TEXT,
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
  total NUMERIC,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, case_code),
  UNIQUE (quote_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations_cases TO authenticated;
GRANT ALL ON public.operations_cases TO service_role;

ALTER TABLE public.operations_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org cases"
  ON public.operations_cases FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Members can insert org cases"
  ON public.operations_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update org cases"
  ON public.operations_cases FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Admins can delete org cases"
  ON public.operations_cases FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER operations_cases_set_updated_at
  BEFORE UPDATE ON public.operations_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX operations_cases_org_created_idx ON public.operations_cases (organization_id, created_at DESC);
CREATE INDEX operations_cases_org_status_idx ON public.operations_cases (organization_id, status);
