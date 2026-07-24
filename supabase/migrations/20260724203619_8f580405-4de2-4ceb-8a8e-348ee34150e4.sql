
-- pricing_rules
CREATE TABLE public.pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  currency TEXT NOT NULL DEFAULT 'USD',
  base_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'shipment', -- 'kg' | 'cbm' | 'shipment'
  rate NUMERIC(14,4) NOT NULL DEFAULT 0,
  minimum_charge NUMERIC(14,2) NOT NULL DEFAULT 0,
  fuel_surcharge_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  insurance_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  service_type TEXT,
  temperature_range TEXT,
  packaging TEXT,
  shipment_type TEXT,
  incoterm TEXT,
  origin_country TEXT,
  destination_country TEXT,
  origin_airport TEXT,
  destination_airport TEXT,
  weight_from NUMERIC(12,3),
  weight_to NUMERIC(12,3),
  effective_from DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select pricing_rules"
  ON public.pricing_rules FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members insert pricing_rules"
  ON public.pricing_rules FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members update pricing_rules"
  ON public.pricing_rules FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members delete pricing_rules"
  ON public.pricing_rules FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pricing_rules_org_idx ON public.pricing_rules(organization_id);
CREATE INDEX pricing_rules_customer_idx ON public.pricing_rules(customer_id);
CREATE INDEX pricing_rules_status_priority_idx ON public.pricing_rules(status, priority DESC);

-- pricing_calculation_log
CREATE TABLE public.pricing_calculation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.pricing_rules(id) ON DELETE SET NULL,
  rule_used TEXT,
  pricing_version INTEGER,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_price NUMERIC(14,2),
  currency TEXT,
  execution_time_ms INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pricing_calculation_log TO authenticated;
GRANT ALL ON public.pricing_calculation_log TO service_role;
ALTER TABLE public.pricing_calculation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select pricing_log"
  ON public.pricing_calculation_log FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "org members insert pricing_log"
  ON public.pricing_calculation_log FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE INDEX pricing_log_org_created_idx ON public.pricing_calculation_log(organization_id, created_at DESC);
CREATE INDEX pricing_log_customer_idx ON public.pricing_calculation_log(customer_id);
