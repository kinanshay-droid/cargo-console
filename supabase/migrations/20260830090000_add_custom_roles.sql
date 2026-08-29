-- Custom roles: a second, softer permission layer on top of the app's real
-- security model. public.app_role stays a fixed "admin"|"member" enum (see
-- the very first migration) and keeps governing actual RLS/data access —
-- that doesn't change here. custom_roles is purely organizational/UI-level:
-- an admin can name a role (e.g. "נציג מכירות"), tag it with a set of
-- module permissions, and assign it to team members so the sidebar shows
-- only the modules relevant to their job. Losing/bypassing a custom role
-- never grants a member more DB access than their admin/member level
-- already allows — worth keeping in mind since this is not a full
-- per-table RLS rewrite.

CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'primary'
    CHECK (color IN ('primary', 'accent', 'success', 'warning', 'destructive', 'muted')),
  -- Boolean flags keyed by module: commercial / operations / shipments /
  -- pickup_distribution / warehouse. Missing key = no access to that
  -- module's nav item. See dashboard.tsx's NAV_SECTIONS permissionKey wiring.
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org custom roles" ON public.custom_roles;
CREATE POLICY "Members can view org custom roles"
  ON public.custom_roles FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

DROP POLICY IF EXISTS "Admins manage org custom roles" ON public.custom_roles;
CREATE POLICY "Admins manage org custom roles"
  ON public.custom_roles FOR ALL
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

DROP TRIGGER IF EXISTS custom_roles_set_updated_at ON public.custom_roles;
CREATE TRIGGER custom_roles_set_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS custom_roles_org_idx ON public.custom_roles (organization_id);

-- Each profile may optionally hold one custom role, in addition to their
-- real admin/member level in user_roles. Unassigned (NULL) = no extra
-- restriction, sees every module (today's behavior, unchanged).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_custom_role_idx ON public.profiles (custom_role_id);
