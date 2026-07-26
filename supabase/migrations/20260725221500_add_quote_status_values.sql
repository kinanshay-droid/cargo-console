-- Extend quote_status with the statuses used by the quote status picker
-- (הועבר / ממתין לעדכון / מבוטלת / מושהת). Kept alongside the original
-- draft/sent/approved/rejected/expired values rather than replacing them,
-- since existing rows already default to 'draft'.
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'transferred';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'pending_update';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'suspended';
