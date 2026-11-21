-- Box dimensions (external + internal, cm) and weight (kg) for warehouse items.
ALTER TABLE public.warehouse_items
  ADD COLUMN ext_length_cm NUMERIC,
  ADD COLUMN ext_width_cm NUMERIC,
  ADD COLUMN ext_height_cm NUMERIC,
  ADD COLUMN int_length_cm NUMERIC,
  ADD COLUMN int_width_cm NUMERIC,
  ADD COLUMN int_height_cm NUMERIC,
  ADD COLUMN weight_kg NUMERIC;
