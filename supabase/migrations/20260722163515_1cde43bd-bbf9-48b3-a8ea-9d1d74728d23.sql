
CREATE TYPE public.customer_status AS ENUM ('active', 'inactive', 'frozen');

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  trade_name TEXT,
  company_id TEXT,
  company_type TEXT,
  industry TEXT,
  website TEXT,
  logo_url TEXT,
  status public.customer_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, customer_code)
);

CREATE INDEX customers_org_created_idx ON public.customers (organization_id, created_at DESC);
CREATE INDEX customers_org_name_idx ON public.customers (organization_id, company_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org customers" ON public.customers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Members can insert org customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update org customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Admins can delete org customers" ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quotes
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX quotes_customer_idx ON public.quotes (customer_id);
