
CREATE POLICY "Authenticated can read price lists" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'price-lists');
CREATE POLICY "Authenticated can upload price lists" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'price-lists');
CREATE POLICY "Authenticated can update price lists" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'price-lists');
CREATE POLICY "Authenticated can delete price lists" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'price-lists');
