-- Selling price per unit for warehouse items (separate from unit_cost).
ALTER TABLE public.warehouse_items
  ADD COLUMN sale_price NUMERIC,
  ADD COLUMN sale_price_currency TEXT NOT NULL DEFAULT 'ILS';
