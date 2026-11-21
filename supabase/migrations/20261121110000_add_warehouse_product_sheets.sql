-- Manufacturer product sheet (PDF/image) per warehouse item, stored in a
-- private bucket. Files live under "<organization_id>/<uuid>.<ext>" and the
-- policies only allow access to the caller's own organization folder.
ALTER TABLE public.warehouse_items
  ADD COLUMN product_sheet_path TEXT,
  ADD COLUMN product_sheet_name TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-sheets', 'product-sheets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members read product sheets" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'product-sheets'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
  );
CREATE POLICY "Org members upload product sheets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'product-sheets'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
  );
CREATE POLICY "Org members update product sheets" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'product-sheets'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
  );
CREATE POLICY "Org members delete product sheets" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'product-sheets'
    AND (storage.foldername(name))[1] = public.get_user_org(auth.uid())::text
  );
