-- Currency for unit_cost — same 3-currency set used elsewhere in the app
-- (quote pricing items: USD/EUR/ILS). Defaults to ILS so existing rows with
-- a unit_cost already set stay meaningful.
ALTER TABLE public.warehouse_items
  ADD COLUMN unit_cost_currency TEXT NOT NULL DEFAULT 'ILS'
  CHECK (unit_cost_currency IN ('USD', 'EUR', 'ILS'));
