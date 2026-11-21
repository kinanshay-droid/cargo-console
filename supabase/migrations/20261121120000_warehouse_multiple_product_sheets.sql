-- Multiple manufacturer documents per warehouse item: a JSON array of
-- {"path": "...", "name": "..."} objects. Run AFTER
-- 20261121110000_add_warehouse_product_sheets.sql. Copies any single
-- document uploaded with that version into the new array, then drops the
-- old single-file columns.
ALTER TABLE public.warehouse_items
  ADD COLUMN product_sheets JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.warehouse_items
SET product_sheets = jsonb_build_array(
  jsonb_build_object('path', product_sheet_path, 'name', COALESCE(product_sheet_name, 'דף מוצר'))
)
WHERE product_sheet_path IS NOT NULL;

ALTER TABLE public.warehouse_items
  DROP COLUMN product_sheet_path,
  DROP COLUMN product_sheet_name;
