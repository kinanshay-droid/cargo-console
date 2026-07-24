// Drop-shipment stops model: field spec per stop type,
// and which stop types / defaults belong to each drop type.

export type StopKind = "Pickup" | "Drop" | "Hub";

export type DropTypeId =
  | "Direct"
  | "Multi Pickup"
  | "Multi Drop"
  | "Multi Pickup & Drop"
  | "Hub Transfer"
  | "Cross Dock"
  | "Milk Run";

export type StopField =
  | "company"
  | "address"
  | "contact"
  | "phone"
  | "plannedTime"
  | "etaAt"
  | "ataAt"
  | "temperature"
  | "signature"
  | "photo"
  | "status"
  | "notes";

export const STOP_FIELD_LABEL: Record<StopField, string> = {
  company: "חברה / אתר",
  address: "כתובת",
  contact: "איש קשר",
  phone: "טלפון",
  plannedTime: "חלון זמן",
  etaAt: "ETA מתוכנן",
  ataAt: "ATA בפועל",
  temperature: "טמפ' במסירה",
  signature: "חתימה",
  photo: "תמונה (URL)",
  status: "סטטוס",
  notes: "הערות",
};

export const STOP_STATUS_OPTIONS = ["", "ממתין", "בדרך", "בוצע", "נכשל"] as const;

// Fields relevant per stop kind (only these are captured/edited/saved).
export const FIELDS_BY_KIND: Record<StopKind, StopField[]> = {
  Pickup: [
    "company",
    "address",
    "contact",
    "phone",
    "plannedTime",
    "etaAt",
    "ataAt",
    "temperature",
    "status",
    "notes",
  ],
  Drop: [
    "company",
    "address",
    "contact",
    "phone",
    "plannedTime",
    "etaAt",
    "ataAt",
    "temperature",
    "signature",
    "photo",
    "status",
    "notes",
  ],
  Hub: ["company", "address", "plannedTime", "etaAt", "ataAt", "status", "notes"],
};

export type DropTypeSpec = {
  desc: string;
  allowedKinds: StopKind[];
  // seed: initial stop kinds (in order) when the drop type is selected
  seed: StopKind[];
  // whether the user can add / remove stops beyond the seed
  addable: boolean;
};

export const DROP_TYPE_SPECS: Record<DropTypeId, DropTypeSpec> = {
  Direct: {
    desc: "איסוף אחד → מסירה אחת",
    allowedKinds: ["Pickup", "Drop"],
    seed: ["Pickup", "Drop"],
    addable: false,
  },
  "Multi Pickup": {
    desc: "מספר נקודות איסוף → יעד אחד",
    allowedKinds: ["Pickup", "Drop"],
    seed: ["Pickup", "Pickup", "Drop"],
    addable: true,
  },
  "Multi Drop": {
    desc: "איסוף אחד → מספר נקודות מסירה",
    allowedKinds: ["Pickup", "Drop"],
    seed: ["Pickup", "Drop", "Drop"],
    addable: true,
  },
  "Multi Pickup & Drop": {
    desc: "מספר נקודות איסוף ומספר נקודות מסירה",
    allowedKinds: ["Pickup", "Drop"],
    seed: ["Pickup", "Pickup", "Drop", "Drop"],
    addable: true,
  },
  "Hub Transfer": {
    desc: "מעבר דרך תחנת ביניים / HUB",
    allowedKinds: ["Pickup", "Hub", "Drop"],
    seed: ["Pickup", "Hub", "Drop"],
    addable: true,
  },
  "Cross Dock": {
    desc: "העברה בין כלי רכב או מחסן ללא אחסון",
    allowedKinds: ["Pickup", "Hub", "Drop"],
    seed: ["Pickup", "Hub", "Drop"],
    addable: true,
  },
  "Milk Run": {
    desc: "מסלול איסוף/חלוקה קבוע במספר תחנות",
    allowedKinds: ["Pickup", "Drop", "Hub"],
    seed: ["Pickup", "Drop", "Drop", "Drop"],
    addable: true,
  },
};

export type Stop = {
  id: string;
  kind: StopKind;
  company?: string;
  address?: string;
  contact?: string;
  phone?: string;
  plannedTime?: string;
  etaAt?: string;
  ataAt?: string;
  temperature?: string;
  signature?: string;
  photo?: string;
  status?: string;
  notes?: string;
};

export function makeStop(kind: StopKind, index: number): Stop {
  return { id: `stop-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`, kind };
}

export function seedStopsForDropType(dropType: DropTypeId): Stop[] {
  const spec = DROP_TYPE_SPECS[dropType];
  return spec.seed.map((k, i) => makeStop(k, i));
}

// Strip fields that are not relevant to the stop's kind before persisting.
export function normalizeStopForPersist(stop: Stop): Stop {
  const allowed = new Set<StopField>(FIELDS_BY_KIND[stop.kind]);
  const out: Stop = { id: stop.id, kind: stop.kind };
  for (const f of allowed) {
    const v = (stop as Record<string, unknown>)[f];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) (out as Record<string, unknown>)[f] = trimmed;
    }
  }
  return out;
}

export function normalizeStopsForPersist(stops: Stop[]): Stop[] {
  return stops.map(normalizeStopForPersist).filter((s) => {
    // keep the stop if it has any content besides id/kind
    return Object.keys(s).some((k) => k !== "id" && k !== "kind");
  });
}

export function isDropTypeId(value: unknown): value is DropTypeId {
  return typeof value === "string" && value in DROP_TYPE_SPECS;
}
