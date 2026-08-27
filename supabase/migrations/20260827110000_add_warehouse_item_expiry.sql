-- Optional expiry date per warehouse item (e.g. coolants/dry-ice packs with
-- a shelf life). Nullable — most equipment/packaging has none.
ALTER TABLE public.warehouse_items ADD COLUMN expiry_date DATE;
