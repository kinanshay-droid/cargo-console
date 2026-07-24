
-- Extend customers with organization-assignment fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS account_manager TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep TEXT,
  ADD COLUMN IF NOT EXISTS service_rep TEXT,
  ADD COLUMN IF NOT EXISTS ops_manager TEXT,
  ADD COLUMN IF NOT EXISTS finance_manager TEXT;

-- Addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_name TEXT,
  type TEXT,
  country TEXT,
  city TEXT,
  street TEXT,
  postal TEXT,
  floor TEXT,
  room TEXT,
  gps TEXT,
  hours TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read addresses" ON public.customer_addresses
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can insert addresses" ON public.customer_addresses
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can update addresses" ON public.customer_addresses
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can delete addresses" ON public.customer_addresses
  FOR DELETE TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE TRIGGER trg_customer_addresses_updated
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT,
  department TEXT,
  phone TEXT,
  mobile TEXT,
  email TEXT,
  whatsapp TEXT,
  language TEXT,
  availability TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notifications BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read contacts" ON public.customer_contacts
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can insert contacts" ON public.customer_contacts
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can update contacts" ON public.customer_contacts
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can delete contacts" ON public.customer_contacts
  FOR DELETE TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE TRIGGER trg_customer_contacts_updated
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Commercial (1:1 JSONB blob for the many fields)
CREATE TABLE IF NOT EXISTS public.customer_commercial (
  customer_id UUID NOT NULL PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_commercial TO authenticated;
GRANT ALL ON public.customer_commercial TO service_role;
ALTER TABLE public.customer_commercial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read commercial" ON public.customer_commercial
  FOR SELECT TO authenticated USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can insert commercial" ON public.customer_commercial
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members can update commercial" ON public.customer_commercial
  FOR UPDATE TO authenticated USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE TRIGGER trg_customer_commercial_updated
  BEFORE UPDATE ON public.customer_commercial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
