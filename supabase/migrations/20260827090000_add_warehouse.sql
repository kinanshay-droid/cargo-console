-- Warehouse module: inventory of packaging materials (boxes, coolants,
-- data loggers, etc.) and equipment used while building temperature-
-- controlled shipment packages. warehouse_movements is an append-only
-- audit log (stock in/out); warehouse_items.quantity_on_hand is kept in
-- sync via a trigger so the running total is always derived from the
-- movement history rather than written directly by app code.

CREATE TABLE public.warehouse_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'packaging' CHECK (category IN ('packaging', 'equipment')),
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'יח׳',
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  min_threshold NUMERIC,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_items TO authenticated;
GRANT ALL ON public.warehouse_items TO service_role;

ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org warehouse items"
  ON public.warehouse_items FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Members can insert org warehouse items"
  ON public.warehouse_items FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update org warehouse items"
  ON public.warehouse_items FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Admins can delete org warehouse items"
  ON public.warehouse_items FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER warehouse_items_set_updated_at
  BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX warehouse_items_org_idx ON public.warehouse_items (organization_id);

-- Append-only stock movement log. delta is positive for stock received,
-- negative for stock consumed (e.g. used up while packing a case).
CREATE TABLE public.warehouse_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.warehouse_items(id) ON DELETE CASCADE,
  delta NUMERIC NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  case_id UUID REFERENCES public.operations_cases(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.warehouse_movements TO authenticated;
GRANT ALL ON public.warehouse_movements TO service_role;

ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org warehouse movements"
  ON public.warehouse_movements FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Members can insert org warehouse movements"
  ON public.warehouse_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can delete org warehouse movements"
  ON public.warehouse_movements FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE INDEX warehouse_movements_org_item_idx ON public.warehouse_movements (organization_id, item_id, created_at DESC);
CREATE INDEX warehouse_movements_case_idx ON public.warehouse_movements (case_id);

CREATE OR REPLACE FUNCTION public.apply_warehouse_movement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.warehouse_items
  SET quantity_on_hand = quantity_on_hand + NEW.delta
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER warehouse_movements_apply
  AFTER INSERT ON public.warehouse_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_warehouse_movement();
