-- Per-organization logo shown in the dashboard sidebar. Stored in a public
-- bucket (logos aren't sensitive) under "<organization_id>/<file>"; only that
-- organization's admins may write to their own folder.
ALTER TABLE public.organizations ADD COLUMN logo_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org admins upload logo" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
    AND public.is_org_admin(auth.uid(), public.get_user_org(auth.uid()))
  );
CREATE POLICY "Org admins update logo" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
    AND public.is_org_admin(auth.uid(), public.get_user_org(auth.uid()))
  );
CREATE POLICY "Org admins delete logo" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
    AND public.is_org_admin(auth.uid(), public.get_user_org(auth.uid()))
  );
