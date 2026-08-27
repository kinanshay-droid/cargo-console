-- Splits the generic "packaging" category into two more specific groups
-- that match how the checklist actually uses warehouse stock:
--   'boxes'   — the CoolGuard/BioTherm packaging models themselves
--               (previously seeded as 'packaging' — see
--               20260827100000_seed_warehouse_packaging_catalog.sql)
--   'loggers' — temperature recorder devices (Tive, Sensitech, ELPRO, ...
--               same catalog as TEMP_LOGGERS in new-quote-dialog.tsx)
-- 'packaging' remains for other consumables (tape, absorbent, etc.) and
-- 'equipment' is unchanged.

ALTER TABLE public.warehouse_items DROP CONSTRAINT warehouse_items_category_check;
ALTER TABLE public.warehouse_items ADD CONSTRAINT warehouse_items_category_check
  CHECK (category IN ('packaging', 'equipment', 'boxes', 'loggers'));

-- Re-tag the box models seeded earlier under 'packaging' as 'boxes'.
UPDATE public.warehouse_items
SET category = 'boxes'
WHERE category = 'packaging'
  AND name IN (
    'CoolGuard Advance 96L',
    'CoolGuard Advance 56L',
    'CoolGuard Advance 28L',
    'CoolGuard Advance 12L',
    'CoolGuard Advance 4L',
    'BioTherm 7',
    'BioTherm 14',
    'BioTherm 15',
    'BioTherm 30'
  );

-- Seed the temperature-logger catalog per organization, same
-- skip-if-exists pattern as the box-catalog seed.
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
    SELECT org.id, v.name, 'loggers', v.name, 'יח׳', seeder
    FROM (VALUES
      ('Tive Solo Pro'),
      ('Tive Solo 5G'),
      ('Tive Tag'),
      ('Sensitech TempTale Ultra / TT4'),
      ('ELPRO LIBERO CS / CB / CL'),
      ('LogTag TRIX-8 / SRIC / Dry Ice'),
      ('Berlinger Q-tag / Fridge-tag'),
      ('Testo 174 / 175 / 176'),
      ('Dickson One / Data Loggers'),
      ('DeltaTrak FlashLink / ColdTrak'),
      ('SpotSee WarmMark / ColdMark'),
      ('tempmate S1 / M1 / S2'),
      ('Blulog NFC / Real-Time'),
      ('Eupry Sensors'),
      ('TSS Weblogger')
    ) AS v(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.warehouse_items wi
      WHERE wi.organization_id = org.id AND wi.name = v.name
    );
  END LOOP;
END $$;
