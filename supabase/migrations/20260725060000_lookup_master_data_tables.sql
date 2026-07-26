
-- ============================================
-- STAGE 2 — LOOKUP (MASTER DATA) TABLES
-- One generic row shape powers a single <Lookup type="..."/> component.
-- organization_id NULL  = shared/global row (seeded master data, visible to everyone).
-- organization_id set   = an org's own addition (created via "Quick Add", admin only).
-- ============================================

DO $$
DECLARE
  lookup_type TEXT;
  table_name TEXT;
  lookup_types TEXT[] := ARRAY[
    'airports', 'airlines', 'countries', 'cities', 'temperature_ranges',
    'packaging', 'couriers', 'vehicles', 'incoterms', 'currencies',
    'service_types', 'shipment_types', 'customer_groups', 'suppliers',
    'agents', 'dg', 'dry_ice', 'warehouses', 'locations', 'payment_terms',
    'credit_terms', 'tax', 'insurance', 'fuel_surcharge', 'sla', 'loggers',
    'departments'
  ];
BEGIN
  FOREACH lookup_type IN ARRAY lookup_types LOOP
    table_name := 'lookup_' || lookup_type;

    EXECUTE format($f$
      CREATE TABLE public.%1$I (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        name_en TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    $f$, table_name);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    -- Uniqueness: code must be unique among global rows, and unique per-org among org rows.
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (code) WHERE organization_id IS NULL', table_name || '_code_global_ux', table_name);
    EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (organization_id, code) WHERE organization_id IS NOT NULL', table_name || '_code_org_ux', table_name);
    EXECUTE format('CREATE INDEX %I ON public.%I (organization_id)', table_name || '_org_idx', table_name);
    EXECUTE format('CREATE INDEX %I ON public.%I (is_active, sort_order)', table_name || '_active_idx', table_name);
    EXECUTE format(
      $f$CREATE INDEX %I ON public.%I USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(name_en,'') || ' ' || code))$f$,
      table_name || '_search_idx', table_name
    );

    EXECUTE format(
      $f$CREATE POLICY "select global or own org" ON public.%I FOR SELECT TO authenticated
         USING (organization_id IS NULL OR organization_id = public.get_user_org(auth.uid()))$f$,
      table_name
    );
    EXECUTE format(
      $f$CREATE POLICY "admins quick-add in own org" ON public.%I FOR INSERT TO authenticated
         WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_org_admin(auth.uid(), organization_id))$f$,
      table_name
    );
    EXECUTE format(
      $f$CREATE POLICY "admins update own org rows" ON public.%I FOR UPDATE TO authenticated
         USING (organization_id = public.get_user_org(auth.uid()) AND public.is_org_admin(auth.uid(), organization_id))
         WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.is_org_admin(auth.uid(), organization_id))$f$,
      table_name
    );
    EXECUTE format(
      $f$CREATE POLICY "admins delete own org rows" ON public.%I FOR DELETE TO authenticated
         USING (organization_id = public.get_user_org(auth.uid()) AND public.is_org_admin(auth.uid(), organization_id))$f$,
      table_name
    );

    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      table_name || '_updated_at', table_name
    );
  END LOOP;
END $$;

-- ============================================
-- SEED DATA — global (organization_id NULL) starter values.
-- Airports are seeded separately by scripts/seed-lookup-airports.ts (imports
-- the existing src/lib/airports.ts dataset — too large for a SQL migration).
-- Tables not seeded here (airlines, cities, couriers, vehicles, customer_groups,
-- suppliers, agents, dry_ice, warehouses, locations, credit_terms, tax,
-- insurance, fuel_surcharge, sla, loggers, departments) are intentionally left
-- empty — they're organization-specific and populated via "Quick Add" in the UI.
-- ============================================

-- Incoterms 2020
INSERT INTO public.lookup_incoterms (code, name, name_en, sort_order, metadata) VALUES
  ('EXW', 'EXW — איסוף מהמפעל', 'Ex Works', 1, '{}'),
  ('FCA', 'FCA — חופשי למוביל', 'Free Carrier', 2, '{}'),
  ('FAS', 'FAS — חופשי לצד הספינה', 'Free Alongside Ship', 3, '{}'),
  ('FOB', 'FOB — חופשי על הסיפון', 'Free On Board', 4, '{}'),
  ('CFR', 'CFR — עלות והובלה', 'Cost and Freight', 5, '{}'),
  ('CIF', 'CIF — עלות, ביטוח והובלה', 'Cost, Insurance and Freight', 6, '{}'),
  ('CPT', 'CPT — הובלה שולמה עד', 'Carriage Paid To', 7, '{}'),
  ('CIP', 'CIP — הובלה וביטוח שולמו עד', 'Carriage and Insurance Paid To', 8, '{}'),
  ('DAP', 'DAP — נמסר במקום', 'Delivered At Place', 9, '{}'),
  ('DPU', 'DPU — נמסר במקום פרוק', 'Delivered At Place Unloaded', 10, '{}'),
  ('DDP', 'DDP — נמסר, מכס שולם', 'Delivered Duty Paid', 11, '{}');

-- Shipment types (matches existing SHIPMENT_MODE_LABEL used in the commercial dashboard)
INSERT INTO public.lookup_shipment_types (code, name, name_en, sort_order, metadata) VALUES
  ('direct', 'משלוח ישיר', 'Direct shipment', 1, '{}'),
  ('console', 'משלוח קונסול', 'Consolidated shipment', 2, '{}'),
  ('transship', 'שטעון', 'Transshipment', 3, '{}');

-- Service types
INSERT INTO public.lookup_service_types (code, name, name_en, sort_order, metadata) VALUES
  ('door_to_door', 'דלת לדלת', 'Door to Door', 1, '{}'),
  ('door_to_airport', 'דלת לנמל תעופה', 'Door to Airport', 2, '{}'),
  ('airport_to_airport', 'נמל תעופה לנמל תעופה', 'Airport to Airport', 3, '{}'),
  ('airport_to_door', 'נמל תעופה לדלת', 'Airport to Door', 4, '{}'),
  ('warehouse_to_warehouse', 'מחסן למחסן', 'Warehouse to Warehouse', 5, '{}');

-- Temperature ranges (cold-chain / pharma focus)
INSERT INTO public.lookup_temperature_ranges (code, name, name_en, sort_order, metadata) VALUES
  ('ambient', 'סביבתי (Ambient)', 'Ambient', 1, '{}'),
  ('crt', 'טמפרטורת חדר מבוקרת (15–25°C)', 'Controlled Room Temperature 15-25C', 2, '{"min_c": 15, "max_c": 25}'),
  ('cool', 'קירור (2–8°C)', 'Cool 2-8C', 3, '{"min_c": 2, "max_c": 8}'),
  ('frozen', 'קפוא (-20°C)', 'Frozen -20C', 4, '{"max_c": -20}'),
  ('deep_frozen', 'קפוא עמוק / קרח יבש (-70°C)', 'Deep Frozen / Dry Ice -70C', 5, '{"max_c": -70}');

-- Packaging types
INSERT INTO public.lookup_packaging (code, name, name_en, sort_order, metadata) VALUES
  ('pallet', 'משטח (Pallet)', 'Pallet', 1, '{}'),
  ('carton', 'קרטון', 'Carton', 2, '{}'),
  ('crate', 'ארגז עץ (Crate)', 'Crate', 3, '{}'),
  ('envelope', 'מעטפה / מסמכים', 'Envelope / Documents', 4, '{}'),
  ('drum', 'חבית (Drum)', 'Drum', 5, '{}'),
  ('cooler_box', 'קופסת קירור', 'Cooler Box', 6, '{}'),
  ('cryoshipper', 'Cryoshipper', 'Cryoshipper', 7, '{}');

-- Dangerous goods classes (IATA / UN hazard classes)
INSERT INTO public.lookup_dg (code, name, name_en, sort_order, metadata) VALUES
  ('class1', 'סוג 1 — חומרי נפץ', 'Class 1 - Explosives', 1, '{}'),
  ('class2', 'סוג 2 — גזים', 'Class 2 - Gases', 2, '{}'),
  ('class3', 'סוג 3 — נוזלים דליקים', 'Class 3 - Flammable Liquids', 3, '{}'),
  ('class4', 'סוג 4 — מוצקים דליקים', 'Class 4 - Flammable Solids', 4, '{}'),
  ('class5', 'סוג 5 — חומרים מחמצנים', 'Class 5 - Oxidizers and Organic Peroxides', 5, '{}'),
  ('class6', 'סוג 6 — חומרים רעילים ומדבקים', 'Class 6 - Toxic and Infectious Substances', 6, '{}'),
  ('class7', 'סוג 7 — חומרים רדיואקטיביים', 'Class 7 - Radioactive Material', 7, '{}'),
  ('class8', 'סוג 8 — חומרים קורוזיביים', 'Class 8 - Corrosives', 8, '{}'),
  ('class9', 'סוג 9 — שונות', 'Class 9 - Miscellaneous Dangerous Goods', 9, '{}');

-- Payment terms (matches the existing chips in the customer commercial tab)
INSERT INTO public.lookup_payment_terms (code, name, name_en, sort_order, metadata) VALUES
  ('cash', 'מזומן', 'Cash', 1, '{}'),
  ('cod', 'תשלום בעת מסירה (COD)', 'Cash on Delivery', 2, '{}'),
  ('net30', 'שוטף + 30', 'Net 30', 3, '{"days": 30}'),
  ('net45', 'שוטף + 45', 'Net 45', 4, '{"days": 45}'),
  ('net60', 'שוטף + 60', 'Net 60', 5, '{"days": 60}'),
  ('net90', 'שוטף + 90', 'Net 90', 6, '{"days": 90}'),
  ('prepaid', 'תשלום מראש', 'Prepayment', 7, '{}'),
  ('standing_order', 'הוראת קבע', 'Standing Order', 8, '{}'),
  ('bank_transfer', 'העברה בנקאית', 'Bank Transfer', 9, '{}'),
  ('credit_card', 'כרטיס אשראי', 'Credit Card', 10, '{}');

-- Currencies
INSERT INTO public.lookup_currencies (code, name, name_en, sort_order, metadata) VALUES
  ('USD', 'דולר אמריקאי', 'US Dollar', 1, '{"symbol": "$"}'),
  ('EUR', 'אירו', 'Euro', 2, '{"symbol": "€"}'),
  ('ILS', 'שקל חדש', 'Israeli New Shekel', 3, '{"symbol": "₪"}'),
  ('GBP', 'לירה שטרלינג', 'British Pound', 4, '{"symbol": "£"}'),
  ('CHF', 'פרנק שוויצרי', 'Swiss Franc', 5, '{"symbol": "CHF"}'),
  ('JPY', 'ין יפני', 'Japanese Yen', 6, '{"symbol": "¥"}'),
  ('CNY', 'יואן סיני', 'Chinese Yuan', 7, '{"symbol": "¥"}'),
  ('CAD', 'דולר קנדי', 'Canadian Dollar', 8, '{"symbol": "$"}'),
  ('AUD', 'דולר אוסטרלי', 'Australian Dollar', 9, '{"symbol": "$"}'),
  ('HKD', 'דולר הונג קונגי', 'Hong Kong Dollar', 10, '{"symbol": "$"}'),
  ('SGD', 'דולר סינגפורי', 'Singapore Dollar', 11, '{"symbol": "$"}'),
  ('INR', 'רופי הודי', 'Indian Rupee', 12, '{"symbol": "₹"}'),
  ('AED', 'דירהם איחוד האמירויות', 'UAE Dirham', 13, '{"symbol": "د.إ"}'),
  ('SAR', 'ריאל סעודי', 'Saudi Riyal', 14, '{"symbol": "﷼"}'),
  ('TRY', 'לירה טורקית', 'Turkish Lira', 15, '{"symbol": "₺"}'),
  ('ZAR', 'ראנד דרום אפריקאי', 'South African Rand', 16, '{"symbol": "R"}'),
  ('BRL', 'ריאל ברזילאי', 'Brazilian Real', 17, '{"symbol": "R$"}'),
  ('MXN', 'פזו מקסיקני', 'Mexican Peso', 18, '{"symbol": "$"}'),
  ('KRW', 'וון דרום קוריאני', 'South Korean Won', 19, '{"symbol": "₩"}'),
  ('SEK', 'קרונה שוודית', 'Swedish Krona', 20, '{"symbol": "kr"}');

-- Countries (starter set — extend via Quick Add as needed)
INSERT INTO public.lookup_countries (code, name, name_en, sort_order, metadata) VALUES
  ('IL', 'ישראל', 'Israel', 1, '{}'),
  ('US', 'ארצות הברית', 'United States', 2, '{}'),
  ('GB', 'בריטניה', 'United Kingdom', 3, '{}'),
  ('DE', 'גרמניה', 'Germany', 4, '{}'),
  ('FR', 'צרפת', 'France', 5, '{}'),
  ('IT', 'איטליה', 'Italy', 6, '{}'),
  ('ES', 'ספרד', 'Spain', 7, '{}'),
  ('NL', 'הולנד', 'Netherlands', 8, '{}'),
  ('BE', 'בלגיה', 'Belgium', 9, '{}'),
  ('CH', 'שווייץ', 'Switzerland', 10, '{}'),
  ('AT', 'אוסטריה', 'Austria', 11, '{}'),
  ('SE', 'שוודיה', 'Sweden', 12, '{}'),
  ('NO', 'נורווגיה', 'Norway', 13, '{}'),
  ('DK', 'דנמרק', 'Denmark', 14, '{}'),
  ('FI', 'פינלנד', 'Finland', 15, '{}'),
  ('PL', 'פולין', 'Poland', 16, '{}'),
  ('CZ', 'צ''כיה', 'Czech Republic', 17, '{}'),
  ('IE', 'אירלנד', 'Ireland', 18, '{}'),
  ('PT', 'פורטוגל', 'Portugal', 19, '{}'),
  ('GR', 'יוון', 'Greece', 20, '{}'),
  ('TR', 'טורקיה', 'Turkey', 21, '{}'),
  ('RU', 'רוסיה', 'Russia', 22, '{}'),
  ('UA', 'אוקראינה', 'Ukraine', 23, '{}'),
  ('CN', 'סין', 'China', 24, '{}'),
  ('JP', 'יפן', 'Japan', 25, '{}'),
  ('KR', 'דרום קוריאה', 'South Korea', 26, '{}'),
  ('IN', 'הודו', 'India', 27, '{}'),
  ('SG', 'סינגפור', 'Singapore', 28, '{}'),
  ('HK', 'הונג קונג', 'Hong Kong', 29, '{}'),
  ('TW', 'טייוואן', 'Taiwan', 30, '{}'),
  ('TH', 'תאילנד', 'Thailand', 31, '{}'),
  ('VN', 'וייטנאם', 'Vietnam', 32, '{}'),
  ('ID', 'אינדונזיה', 'Indonesia', 33, '{}'),
  ('MY', 'מלזיה', 'Malaysia', 34, '{}'),
  ('PH', 'פיליפינים', 'Philippines', 35, '{}'),
  ('AU', 'אוסטרליה', 'Australia', 36, '{}'),
  ('NZ', 'ניו זילנד', 'New Zealand', 37, '{}'),
  ('CA', 'קנדה', 'Canada', 38, '{}'),
  ('MX', 'מקסיקו', 'Mexico', 39, '{}'),
  ('BR', 'ברזיל', 'Brazil', 40, '{}'),
  ('AR', 'ארגנטינה', 'Argentina', 41, '{}'),
  ('ZA', 'דרום אפריקה', 'South Africa', 42, '{}'),
  ('EG', 'מצרים', 'Egypt', 43, '{}'),
  ('MA', 'מרוקו', 'Morocco', 44, '{}'),
  ('AE', 'איחוד האמירויות', 'United Arab Emirates', 45, '{}'),
  ('SA', 'ערב הסעודית', 'Saudi Arabia', 46, '{}'),
  ('QA', 'קטאר', 'Qatar', 47, '{}'),
  ('JO', 'ירדן', 'Jordan', 48, '{}'),
  ('CY', 'קפריסין', 'Cyprus', 49, '{}'),
  ('RO', 'רומניה', 'Romania', 50, '{}'),
  ('HU', 'הונגריה', 'Hungary', 51, '{}');
