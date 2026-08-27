-- The date stock actually entered/left the warehouse, distinct from
-- created_at (when the record was entered into the system — often the
-- next day, or backfilled). Defaults to today so existing call sites that
-- don't pass it keep working.
ALTER TABLE public.warehouse_movements
  ADD COLUMN movement_date DATE NOT NULL DEFAULT CURRENT_DATE;
