-- RLS policies for the "customer-documents" storage bucket, used by the
-- "מסמכים" quick action on leads/customers (see QuickActionsMenu in
-- dashboard.leads.index.tsx). Mirrors the existing "price-lists" bucket
-- policies (20260724200534_...): the bucket itself still needs to be
-- created manually in the Supabase Studio dashboard (Storage -> New bucket
-- -> "customer-documents", private) — these policies only take effect once
-- that bucket exists.
CREATE POLICY "Authenticated can read customer documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'customer-documents');
CREATE POLICY "Authenticated can upload customer documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer-documents');
CREATE POLICY "Authenticated can update customer documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'customer-documents');
CREATE POLICY "Authenticated can delete customer documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'customer-documents');
