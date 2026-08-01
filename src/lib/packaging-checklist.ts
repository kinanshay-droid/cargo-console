// Data model + section definitions for the packaging checklist
// ("AFIK Logistics Platform Checklist -- הכנת מארז מבוקר טמפרטורה"), sourced
// verbatim from the AFIK_Professional_Packaging_Checklist.docx the user
// attached. Each numbered section is a list of items; each item gets a
// pass/fail toggle plus a free-text notes field (mirrors the original
// document's three data columns: תקין ✔ / לא תקין ✖ / הערות).
//
// Filled-in data is persisted into the case's own payload as
// payload.packagingChecklist (see saveCaseChecklist in operations.functions.ts),
// following this codebase's migration-free JSONB read-modify-write pattern —
// no new table/columns needed.

export type ChecklistItemStatus = "unset" | "ok" | "not_ok";

export type ChecklistSection = {
  key: string;
  title: string;
  items: { key: string; label: string }[];
};

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    key: "shipment_data",
    title: "1. אימות נתוני המשלוח",
    items: [
      { key: "shipment_number", label: "מספר משלוח נכון" },
      { key: "temp_range", label: "טווח טמפרטורה מאושר" },
      { key: "destination", label: "יעד המשלוח נכון" },
      { key: "transit_time", label: "זמן שינוע נדרש" },
      { key: "product_type", label: "סוג המוצר תואם" },
      { key: "special_instructions", label: "הוראות אריזה מיוחדות נבדקו" },
    ],
  },
  {
    key: "packaging_check",
    title: "2. בדיקת המארז",
    items: [
      { key: "box_type", label: "סוג המארז נכון" },
      { key: "box_size", label: "מידת המארז תואמת" },
      { key: "box_clean_dry", label: "המארז נקי ויבש" },
      { key: "no_damage", label: "ללא נזק" },
      { key: "seals_ok", label: "אטמים תקינים" },
    ],
  },
  {
    key: "coolants",
    title: "3. חומרי קירור",
    items: [
      { key: "coolant_qty", label: "כמות קרח יבש / Ice Packs נכונה" },
      { key: "coolant_prepped", label: "חומרי הקירור הוכנו מראש" },
      { key: "weight_checked", label: "משקל נבדק" },
      { key: "arrangement", label: "סידור נכון" },
    ],
  },
  {
    key: "cargo_prep",
    title: "4. הכנת המטען",
    items: [
      { key: "inner_packing", label: "אריזה פנימית" },
      { key: "void_fill", label: "מילוי חללים" },
      { key: "cargo_secured", label: "קיבוע המטען" },
      { key: "absorbent", label: "Absorbent (במידת הצורך)" },
    ],
  },
  {
    key: "data_logger",
    title: "5. Data Logger",
    items: [
      { key: "activated", label: "הופעל" },
      { key: "serial_recorded", label: "מס' סידורי נרשם" },
      { key: "placement", label: "מיקום נכון" },
      { key: "battery_ok", label: "סוללה תקינה" },
    ],
  },
  {
    key: "closing",
    title: "6. סגירת המארז",
    items: [
      { key: "lid_closed", label: "המכסה נסגר" },
      { key: "tape_ok", label: "סרט הדבקה תקין" },
      { key: "seal_number", label: "Seal Number" },
      { key: "final_weight", label: "משקל סופי" },
      { key: "dimensions", label: "מידות" },
    ],
  },
  {
    key: "labels",
    title: "7. תוויות",
    items: [
      { key: "awb", label: "AWB" },
      { key: "dest_address", label: "כתובת יעד" },
      { key: "un1845", label: "UN1845" },
      { key: "un3373", label: "UN3373 (אם נדרש)" },
      { key: "biohazard", label: "Biohazard (אם נדרש)" },
    ],
  },
  {
    key: "qa",
    title: "8. בקרת איכות",
    items: [
      { key: "photo_inside", label: "צילום פנים" },
      { key: "photo_outside", label: "צילום חוץ" },
      { key: "photo_labels", label: "צילום תוויות" },
      { key: "qa_approval", label: "אישור QA" },
    ],
  },
  {
    key: "documents",
    title: "9. מסמכים",
    items: [
      { key: "packing_list", label: "Packing List" },
      { key: "commercial_invoice", label: "Commercial Invoice" },
      { key: "chain_of_custody", label: "Chain of Custody" },
      { key: "sds", label: "SDS (אם נדרש)" },
    ],
  },
];

export type ChecklistItemState = { status: ChecklistItemStatus; note: string };

export type ChecklistData = {
  shipmentNumber: string;
  customer: string;
  destination: string;
  date: string;
  items: Record<string, ChecklistItemState>;
  packedBy: string;
  qaBy: string;
  signedDate: string;
  savedAt: string | null;
};

export function emptyChecklistItems(): Record<string, ChecklistItemState> {
  const out: Record<string, ChecklistItemState> = {};
  for (const section of CHECKLIST_SECTIONS) {
    for (const item of section.items) {
      out[item.key] = { status: "unset", note: "" };
    }
  }
  return out;
}

export function emptyChecklistData(): ChecklistData {
  return {
    shipmentNumber: "",
    customer: "",
    destination: "",
    date: "",
    items: emptyChecklistItems(),
    packedBy: "",
    qaBy: "",
    signedDate: "",
    savedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function toStatus(value: unknown): ChecklistItemStatus {
  return value === "ok" || value === "not_ok" ? value : "unset";
}

export function parseChecklistData(raw: unknown): ChecklistData {
  const base = emptyChecklistData();
  if (!isRecord(raw)) return base;
  const rawItems = isRecord(raw.items) ? raw.items : {};
  const items = emptyChecklistItems();
  for (const key of Object.keys(items)) {
    const entry = rawItems[key];
    if (isRecord(entry)) {
      items[key] = { status: toStatus(entry.status), note: toText(entry.note) };
    }
  }
  return {
    shipmentNumber: toText(raw.shipmentNumber),
    customer: toText(raw.customer),
    destination: toText(raw.destination),
    date: toText(raw.date),
    items,
    packedBy: toText(raw.packedBy),
    qaBy: toText(raw.qaBy),
    signedDate: toText(raw.signedDate),
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
  };
}

export function checklistProgress(data: ChecklistData): { done: number; total: number } {
  const values = Object.values(data.items);
  return { done: values.filter((v) => v.status !== "unset").length, total: values.length };
}

// A snapshot of already-known case data, handed in by the case detail page.
// Item keys below (shipment_number, temp_range, destination, transit_time,
// product_type, special_instructions, awb, dest_address) match item.key
// values in CHECKLIST_SECTIONS above — wherever a match exists, the dialog
// shows the case's own value next to the checklist row as a reference to
// compare the physical shipment against, instead of leaving it a blind
// checkbox.
export type ChecklistCaseSnapshot = {
  shipmentNumber?: string;
  tempRange?: string;
  destination?: string;
  transitTime?: string;
  productType?: string;
  specialInstructions?: string;
  awb?: string;
  destAddress?: string;
  boxType?: string;
  boxSize?: string;
};

export function buildCaseReferenceValues(snap: ChecklistCaseSnapshot): Record<string, string> {
  const out: Record<string, string> = {};
  if (snap.shipmentNumber) out.shipment_number = snap.shipmentNumber;
  if (snap.tempRange) out.temp_range = snap.tempRange;
  if (snap.destination) out.destination = snap.destination;
  if (snap.transitTime) out.transit_time = snap.transitTime;
  if (snap.productType) out.product_type = snap.productType;
  if (snap.specialInstructions) out.special_instructions = snap.specialInstructions;
  if (snap.awb) out.awb = snap.awb;
  if (snap.destAddress) out.dest_address = snap.destAddress;
  if (snap.boxType) out.box_type = snap.boxType;
  if (snap.boxSize) out.box_size = snap.boxSize;
  return out;
}

// A single physical box/packaging unit selected on the case (a checked
// CoolGuard/BioTherm model, or — for cargo with no temperature packaging —
// a pallet row). Each box gets its own independently-saved checklist, keyed
// by this id, since a shipment can go out in more than one box and each one
// needs to be verified on its own.
export type ChecklistBox = { id: string; label: string; boxType: string; boxSize?: string };

// The id used when the case has no identifiable packaging yet — a single,
// generic checklist with no box-type reference value.
export const GENERAL_BOX_ID = "general";
