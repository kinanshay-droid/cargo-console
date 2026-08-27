-- Seeds warehouse_items with the packaging models from the app's own
-- CoolGuard/BioTherm catalog (see COOLGUARD_MODELS / BIOTHERM_MODELS in
-- src/components/new-quote-dialog.tsx). The checklist's "box type" for a
-- case is always exactly one of these model names (see
-- checklistBoxes/calc.label in dashboard.shipments_.$id.tsx), so seeding a
-- warehouse_items.name that matches verbatim is what lets the packaging
-- checklist's "items consumed" picker auto-match/suggest the right stock
-- record for the box actually being packed.
--
-- Runs per existing organization, skipping any name that's already present
-- (so it's safe to re-run and won't clobber items the user already edited).
DO $$
DECLARE
  org RECORD;
  seeder UUID;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO seeder
    FROM public.profiles
    WHERE organization_id = org.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF seeder IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.warehouse_items (organization_id, name, category, sku, unit, created_by)
    SELECT org.id, v.name, 'packaging', v.name, 'יח׳', seeder
    FROM (VALUES
      ('CoolGuard Advance 96L'),
      ('CoolGuard Advance 56L'),
      ('CoolGuard Advance 28L'),
      ('CoolGuard Advance 12L'),
      ('CoolGuard Advance 4L'),
      ('BioTherm 7'),
      ('BioTherm 14'),
      ('BioTherm 15'),
      ('BioTherm 30')
    ) AS v(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.warehouse_items wi
      WHERE wi.organization_id = org.id AND wi.name = v.name
    );
  END LOOP;
END $$;
