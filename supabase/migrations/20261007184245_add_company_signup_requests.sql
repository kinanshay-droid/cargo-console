-- ============================================
-- Gated company onboarding: "request access" → AFIK platform-admin review
-- → approve (creates org + invites the requester) or reject.
-- Replaces the previously wide-open "anyone can create an organization at
-- signup" flow in src/routes/signup.tsx (that UI path is being removed in
-- the same change that adds this migration).
-- ============================================

-- A platform admin is an AFIK staff member who can see/approve requests
-- from *any* company — distinct from app_role's 'admin', which only
-- governs a user's own organization (see is_org_admin()). Stored on
-- profiles rather than a separate role table since it's a small, rarely
-- granted flag, not a per-organization membership.
ALTER TABLE public.profiles
  ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

CREATE TABLE public.company_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SELECT/UPDATE granted to authenticated so listCompanyRequests/
-- approve/rejectCompanyRequest (which read via the caller's own
-- user-scoped client to double-check admin status) can pass Postgres'
-- table-level grant check — RLS below still restricts actual row access
-- to platform admins. No INSERT grant to authenticated or anon: the
-- public request form always writes via the service-role client
-- (src/lib/company-requests.functions.ts), same pattern as user_roles
-- writes elsewhere in this schema.
GRANT SELECT, UPDATE ON public.company_signup_requests TO authenticated;
GRANT ALL ON public.company_signup_requests TO service_role;
ALTER TABLE public.company_signup_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER company_signup_requests_updated_at
  BEFORE UPDATE ON public.company_signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_company_signup_requests_status ON public.company_signup_requests(status, created_at DESC);

CREATE POLICY "Platform admins view company requests"
  ON public.company_signup_requests FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Platform admins update company requests"
  ON public.company_signup_requests FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Grant the first platform admin. Safe to re-run: no-op if the email
-- doesn't have a profile yet.
UPDATE public.profiles SET is_platform_admin = true WHERE email = 'kinanshay@gmail.com';

-- Close the self-serve org-creation loophole: completeSignup
-- (src/lib/auth.functions.ts) no longer offers a "create" mode, but this
-- permissive RLS policy would otherwise still let any authenticated user
-- insert an organizations row directly (e.g. from the browser console),
-- bypassing the request/approve flow entirely. Organization creation now
-- only happens via approveCompanyRequest, which uses the service-role
-- client and so isn't subject to RLS.
DROP POLICY IF EXISTS "Anyone can create an organization at signup" ON public.organizations;
