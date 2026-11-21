-- Temperature series a box is suitable for (cryogenic, deepFrozen, frozen, chilled, ambient).
ALTER TABLE public.warehouse_items
  ADD COLUMN temp_series TEXT[] NOT NULL DEFAULT '{}';
