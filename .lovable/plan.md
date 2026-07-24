# Pricing Engine — תוכנית מלאה

מטרה: מנוע תמחור מרכזי (`PricingEngineService`) שישרת הצעות מחיר, הזמנות, תיקי משלוח, מחירוני לקוח/ספק/סוכן, מחשבון עלויות, אופטימיזציית מסלול וסימולציה. בשלב הראשון מקור הכללים = השדות המסחריים הקיימים על הלקוח (`customer_commercial`) + טבלת overrides קלה; בשלבים הבאים מרחיבים ל-Rule Engine מלא, Formula Engine ו-Lookups.

## מה יופיע בדף "ניהול מחירונים" (התוצר של שלב 1)

מעל רשימת המחירונים הקיימת יופיע **בסיס נתוני המחירונים הקיימים ללקוח** (per-customer):

- שם מחירון, גרסה, מטבע, תוקף, סטטוס (Draft / Published / Archived).
- כפתור **"חשב מחיר"** שפותח סרגל צד עם: לקוח, מוצא/יעד, שירות, טמפ', אריזה, משקל/נפח, מטבע, תאריך, שירותים נוספים.
- תוצאה מהמנוע: Matched Rule, Unit Price, Minimum Charge, Fuel, Discount, Insurance, Tax, Additional Charges, **Final Price**, גרסת תמחור, זמן חישוב, ורשימת Applied Rules.
- כל חישוב נשמר ב-`pricing_calculation_log` וניתן לצפייה בטאב "יומן חישובים".

## שלבים

### שלב 1 — סכימה + מנוע בסיסי + UI תצוגה (מוגש בסבב זה)

**DB** (מיגריישן אחד):
- `pricing_rules` — כללי-על ברמת ארגון/לקוח: `id, organization_id, customer_id (nullable=global), name, priority, currency, base_price, unit ('kg'|'cbm'|'shipment'), rate, minimum_charge, fuel_surcharge_pct, insurance_pct, tax_pct, service_type, temperature_range, packaging, shipment_type, incoterm, origin_country, destination_country, origin_airport, destination_airport, weight_from, weight_to, effective_from, effective_to, status ('draft'|'published'|'archived'), version, published_at, created_by, timestamps`.
- `pricing_calculation_log` — כפי שהוגדר: `id, organization_id, quotation_id, customer_id, pricing_version, rule_used, inputs jsonb, breakdown jsonb, calculated_price, currency, execution_time_ms, created_at, created_by`.
- GRANTs + RLS (organization-scoped) + טריגר `updated_at`.

**Service** (`src/lib/pricing-engine.functions.ts`):
- `calculatePrice(input)` — בוחר את הכלל המנצח לפי סדר עדיפות: Customer → Country → Airport → Service → Temperature → Packaging → Weight → Volume → Shipment Type → Incoterm → Date Range → Default. במידה ויש כמה — priority גבוה מנצח, ואז גרסת Published העדכנית. אם אין — מחזיר `{ error: "No Pricing Rule Found" }`.
- מבצע חישוב בסיסי: `unit * rate` או `base_price`, `MAX(subtotal, minimum_charge)`, מוסיף Fuel/Insurance/Tax באחוזים, מוריד Discount מ-`customer_commercial`, ומחזיר breakdown מלא.
- כל קריאה נכתבת ל-`pricing_calculation_log` עם זמן ריצה.
- `listPricingRules`, `upsertPricingRule`, `publishPricingRule`, `archivePricingRule`, `listCalculationLog`.

**UI** (`src/routes/dashboard.pricelists.tsx`):
- טאבים: **מחירונים ללקוחות** (הרשימה הקיימת) · **כללי תמחור** · **חשב מחיר** · **יומן חישובים**.
- טופס כלל: כל השדות + preview חישוב חי.
- Drawer "חשב מחיר" עם תוצאה מוצגת בכרטיסים.

### שלב 2 — Lookups (Master Data)

- טבלאות: `lookup_airports` (מייבא מ-`src/lib/airports.ts`), `lookup_airlines`, `lookup_countries`, `lookup_cities`, `lookup_temperature_ranges`, `lookup_packaging`, `lookup_couriers`, `lookup_vehicles`, `lookup_incoterms`, `lookup_currencies`, `lookup_service_types`, `lookup_shipment_types`, `lookup_customer_groups`, `lookup_suppliers`, `lookup_agents`, `lookup_dg`, `lookup_dry_ice`, `lookup_warehouses`, `lookup_locations`, `lookup_payment_terms`, `lookup_credit_terms`, `lookup_tax`, `lookup_insurance`, `lookup_fuel_surcharge`, `lookup_sla`, `lookup_loggers`, `lookup_departments`.
- רכיב React אחד `<Lookup type="airport"/>` עם: חיפוש, autocomplete, סינון, מיון, מועדפים, Active-only, Recently Used (localStorage), Quick Add (מותנה בהרשאות admin), ניווט מקלדת, וירטואליזציה, lazy loading.
- מחליף כל טקסט חופשי בטפסים הרלוונטיים.

### שלב 3 — Rule Engine מלא + היררכיה

- שדה `scope_level` על `pricing_rules` (customer/group/country/airport/service/…/default) + פונקציית DB `pick_pricing_rule(...)` שממדגת את סדר העדיפות.
- Customer Group (`lookup_customer_groups` + `customers.group_id`).
- Region/Country/Airport rules + Override flag.

### שלב 4 — Formula Engine

- שדה `formula` על כלל (טקסט).
- Parser קטן ל-JS-safe expressions עם: `+ - * / ()`, פונקציות `MIN, MAX, ROUND, IF`, משתנים (`BasePrice, Fuel, Weight, Volume, Rate, MinimumCharge, Temperature, DG, DryIce, Insurance, Discount`), נוסחאות מקוננות ונוסחאות לשימוש חוזר (`pricing_formulas` table).
- Preview חישוב + validation לפני שמירה.

### שלב 5 — אינטגרציה למסכים אחרים

- הצעות מחיר: כפתור "חשב אוטומטית" ב-Step 5 של `NewQuoteDialog` שמזמן `calculatePrice` וממלא את הטבלה.
- Shipment Orders / Cases (בהמשך).
- מחירוני ספק/סוכן: אותה סכימה עם `party_type ∈ {customer, supplier, agent}`.
- Cost Calculator, Route Optimizer, Simulation — צריכות למנוע קיים.

## הערות טכניות

- כל השירותים כ-`createServerFn` עם `requireSupabaseAuth` (`src/lib/pricing-engine.functions.ts`); סוד — RLS על `organization_id`.
- אין edge functions; אין free-text בשדות שמכוסים על ידי Lookup בשלב 2 ואילך.
- Types: `PricingInput`, `PricingResult`, `PricingBreakdown` ב-`src/lib/pricing-engine.types.ts` לשימוש חוזר.
- לא נוגעים ב-`customer_commercial` הקיים — הוא נשאר מקור לברירת מחדל של Discount/Currency; overrides לכלל ספציפי חיים ב-`pricing_rules`.

## סדר מסירה

מבקש אישור להתחיל **שלב 1** בסבב הבא: מיגריישן `pricing_rules` + `pricing_calculation_log`, שירות `pricing-engine.functions.ts`, וטאבים חדשים ב-`/dashboard/pricelists` (כללי תמחור · חשב מחיר · יומן חישובים). שלבים 2–5 יבואו לאחר מכן, כל אחד בסבב נפרד.
