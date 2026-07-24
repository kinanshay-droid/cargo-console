
-- Add 'lost' to customer_status enum (lead already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'customer_status'::regtype AND enumlabel = 'lost') THEN
    ALTER TYPE public.customer_status ADD VALUE 'lost';
  END IF;
END $$;

-- CRM activities timeline
CREATE TABLE IF NOT EXISTS public.customer_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  activity_type TEXT NOT NULL,
  subject TEXT,
  notes TEXT,
  outcome TEXT,
  next_task TEXT,
  due_at TIMESTAMPTZ,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_activities_customer_time_idx
  ON public.customer_activities (customer_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_activities TO authenticated;
GRANT ALL ON public.customer_activities TO service_role;

ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read activities" ON public.customer_activities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "org members can insert activities" ON public.customer_activities
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "org members can update activities" ON public.customer_activities
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "org members can delete activities" ON public.customer_activities
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE TRIGGER trg_customer_activities_updated
  BEFORE UPDATE ON public.customer_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
