-- Customer portal: lets an external company's own users sign in (e.g. via
-- Microsoft Entra ID, once configured as an OAuth provider in the Supabase
-- Dashboard) and see only their own company's quotes and shipments, without
-- an AFIK staff account or organization membership.
--
-- Two tables:
--  - customer_portal_invites: AFIK staff invite an external user by email
--    (from the customer's detail page, "פורטל לקוח" tab). The row stays
--    'pending' until that exact email signs in for the first time.
--  - customer_portal_access: the real link between an authenticated user and
--    the customer they're allowed to see. Only ever created by the trigger
--    below (never written directly by app code), so there's no way to
--    fabricate access to a customer you weren't invited to.
--
-- get_portal_customer(uid) is the RLS building block every policy below
-- checks: NULL for staff/unlinked accounts, the customer's id for a linked
-- portal user.

CREATE TABLE public.customer_portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (customer_id, email)
);

CREATE INDEX customer_portal_invites_email_idx ON public.customer_portal_invites (lower(email));
CREATE INDEX customer_portal_invites_customer_idx ON public.customer_portal_invites (customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_invites TO authenticated;
GRANT ALL ON public.customer_portal_invites TO service_role;
ALTER TABLE public.customer_portal_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage invites for their org's customers"
  ON public.customer_portal_invites FOR ALL
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND invited_by = auth.uid());

CREATE TABLE public.customer_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_id UUID REFERENCES public.customer_portal_invites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX customer_portal_access_customer_idx ON public.customer_portal_access (customer_id);

GRANT SELECT, DELETE ON public.customer_portal_access TO authenticated;
GRANT ALL ON public.customer_portal_access TO service_role;
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view portal access for their org's customers"
  ON public.customer_portal_access FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Portal users view their own access row"
  ON public.customer_portal_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins revoke portal access for their org's customers"
  ON public.customer_portal_access FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE OR REPLACE FUNCTION public.get_portal_customer(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id FROM public.customer_portal_access WHERE user_id = _user_id
$$;

-- Read-only: no INSERT/UPDATE/DELETE policy is granted to portal users on
-- either table below, so a linked external user can never modify AFIK data,
-- only view their own company's rows.
CREATE POLICY "Portal users view their own quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (customer_id IS NOT NULL AND customer_id = public.get_portal_customer(auth.uid()));

CREATE POLICY "Portal users view their own cases"
  ON public.operations_cases FOR SELECT
  TO authenticated
  USING (
    (payload ->> 'customerId') IS NOT NULL
    AND (payload ->> 'customerId')::uuid = public.get_portal_customer(auth.uid())
  );

-- Extends the existing new-user trigger (on_auth_user_created, defined in
-- 20260721204010_...sql): if the signing-in email matches a pending invite,
-- atomically accept it and create the access row. Runs for every new
-- auth.users row (password signup, OAuth, magic link, ...) — staff signups
-- simply won't match any invite and fall through unchanged, same as before.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched public.customer_portal_invites%ROWTYPE;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  SELECT * INTO matched
  FROM public.customer_portal_invites
  WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF matched.id IS NOT NULL THEN
    INSERT INTO public.customer_portal_access (organization_id, customer_id, user_id, email, invite_id)
    VALUES (matched.organization_id, matched.customer_id, NEW.id, NEW.email, matched.id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.customer_portal_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = matched.id;
  END IF;

  RETURN NEW;
END;
$$;
