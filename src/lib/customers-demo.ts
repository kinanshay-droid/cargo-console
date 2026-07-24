export type CustomerStatus = "active" | "inactive" | "frozen";

export type Customer = {
  id: string;
  name: string;
  status: CustomerStatus;
  totalShipments: number;
  openOps: number;
  owner: string;
};

export const CUSTOMERS: Customer[] = [
  { id: "c01", name: 'מתן שירותי תמיכה בע"מ', status: "active", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c02", name: 'אופטיקנה בע"מ', status: "active", totalShipments: 12, openOps: 3, owner: "כרמל בן צבי" },
  { id: "c03", name: 'אופטיקנה פלטינום בע"מ', status: "active", totalShipments: 4, openOps: 1, owner: "כרמל בן צבי" },
  { id: "c04", name: 'אופטיקנה שירותי אופטיקה בע"מ', status: "active", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c05", name: 'פוליבס בע"מ', status: "active", totalShipments: 22, openOps: 5, owner: "כרמל בן צבי" },
  { id: "c06", name: 'אלקום (ישראל) בע"מ', status: "active", totalShipments: 8, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c07", name: 'אקסלים בע"מ', status: "active", totalShipments: 3, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c08", name: 'ראמדה סל בע"מ', status: "inactive", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c09", name: 'פוריון בע"מ', status: "active", totalShipments: 6, openOps: 2, owner: "כרמל בן צבי" },
  { id: "c10", name: 'ראונדס (ישראל) 1996 בע"מ', status: "active", totalShipments: 1, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c11", name: 'פאראגון שירותי מערכות בע"מ', status: "active", totalShipments: 14, openOps: 4, owner: "כרמל בן צבי" },
  { id: "c12", name: 'כתר תוכנה בע"מ', status: "active", totalShipments: 9, openOps: 1, owner: "כרמל בן צבי" },
  { id: "c13", name: 'אלביטקס מערכות מיף בע"מ', status: "active", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c14", name: 'פליפר בע"מ', status: "frozen", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c15", name: 'בונוס דהרוף בע"מ', status: "active", totalShipments: 2, openOps: 0, owner: "כרמל בן צבי" },
  { id: "c16", name: 'קדימא בע"מ', status: "active", totalShipments: 5, openOps: 1, owner: "כרמל בן צבי" },
  { id: "c17", name: 'קמורי בע"מ', status: "active", totalShipments: 0, openOps: 0, owner: "כרמל בן צבי" },
];

export const SECTORS = [
  "Pharma",
  "Biotech",
  "Medical Device",
  "Hospital",
  "Laboratory",
  "CRO",
  "University",
  "Distribution",
] as const;

export const ADDRESS_TYPES = [
  "Headquarters",
  "Warehouse",
  "Laboratory",
  "Manufacturing",
  "Billing",
  "Collection",
  "Delivery",
] as const;

export const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  frozen: "בהקפאה",
};

export const STATUS_DOT: Record<CustomerStatus, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  frozen: "bg-sky-500",
};

const PALETTE = [
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
];

export function customerInitials(name: string) {
  const clean = name.replace(/["'()]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (first + second).slice(0, 2);
}

export function customerPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
