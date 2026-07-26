// Shared, client-safe registry of all lookup (master data) domains.
// Backs the generic <Lookup type="..."/> component and the lookups.functions.ts
// server functions — both key off the same LookupType union so a typo is a
// compile error instead of a silent empty table.

export type LookupType =
  | "airports"
  | "airlines"
  | "countries"
  | "cities"
  | "temperature_ranges"
  | "packaging"
  | "couriers"
  | "vehicles"
  | "incoterms"
  | "currencies"
  | "service_types"
  | "shipment_types"
  | "customer_groups"
  | "suppliers"
  | "agents"
  | "dg"
  | "dry_ice"
  | "warehouses"
  | "locations"
  | "payment_terms"
  | "credit_terms"
  | "tax"
  | "insurance"
  | "fuel_surcharge"
  | "sla"
  | "loggers"
  | "departments";

export const LOOKUP_LABELS: Record<LookupType, string> = {
  airports: "נמלי תעופה",
  airlines: "חברות תעופה",
  countries: "מדינות",
  cities: "ערים",
  temperature_ranges: "טווחי טמפרטורה",
  packaging: "סוגי אריזה",
  couriers: "שליחים",
  vehicles: "כלי רכב",
  incoterms: "Incoterms",
  currencies: "מטבעות",
  service_types: "סוגי שירות",
  shipment_types: "אופי משלוח",
  customer_groups: "קבוצות לקוחות",
  suppliers: "ספקים",
  agents: "סוכנים",
  dg: "חומרים מסוכנים (DG)",
  dry_ice: "קרח יבש",
  warehouses: "מחסנים",
  locations: "מיקומים",
  payment_terms: "תנאי תשלום",
  credit_terms: "תנאי אשראי",
  tax: "מיסים",
  insurance: "ביטוחים",
  fuel_surcharge: "היטל דלק",
  sla: "SLA",
  loggers: "לוגרים",
  departments: "מחלקות",
};

export const LOOKUP_TYPES = Object.keys(LOOKUP_LABELS) as LookupType[];

export function isLookupType(value: string): value is LookupType {
  return Object.prototype.hasOwnProperty.call(LOOKUP_LABELS, value);
}

// Return type is the literal template-union (`"lookup_airports" | "lookup_airlines" | ...`),
// not a widened `string` — that's what lets Supabase's typed `.from(table)` resolve to the
// real lookup_* row shape instead of falling back to its no-match `never` overload.
export function lookupTableName<T extends LookupType>(type: T): `lookup_${T}` {
  return `lookup_${type}`;
}
