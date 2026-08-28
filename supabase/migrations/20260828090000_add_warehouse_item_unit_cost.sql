-- Optional per-unit cost, for tracking inventory value. Nullable — not
-- every item needs a tracked cost.
ALTER TABLE public.warehouse_items ADD COLUMN unit_cost NUMERIC;
