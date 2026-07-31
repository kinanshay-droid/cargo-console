// Color-coded shipment-type tags shown under "ב. תנאי מכר" in the New Quote
// wizard — mirrors an external reference sheet's own color-coded shipment
// type labels. Single-select, stored as payload.shipmentTypeTag (JSONB),
// same "migration-free" reasoning as everything else in this payload.
export type ShipmentTypeTagOption = {
  value: string;
  bg: string;
  fg: string;
};

export const SHIPMENT_TYPE_TAGS: ShipmentTypeTagOption[] = [
  { value: "Dry Shipper", bg: "#3b8fc4", fg: "#ffffff" },
  { value: "General", bg: "#5a5a5f", fg: "#ffffff" },
  { value: "קנאביס", bg: "#3fa172", fg: "#ffffff" },
  { value: "15° - 25°", bg: "#a8d84a", fg: "#2b3305" },
  { value: "DG", bg: "#e0607a", fg: "#ffffff" },
  { value: "2° - 8°", bg: "#3ddc84", fg: "#04331b" },
  { value: "Batteries", bg: "#b48ee0", fg: "#2b1a3a" },
  { value: "-20°", bg: "#7c94a8", fg: "#ffffff" },
  { value: "DG + Dry-Ice", bg: "#f28b82", fg: "#3a0f0c" },
  { value: "Dry-Ice", bg: "#7ec8e3", fg: "#0c2733" },
];

export function getShipmentTypeTagStyle(value: string): ShipmentTypeTagOption | null {
  return SHIPMENT_TYPE_TAGS.find((o) => o.value === value) ?? null;
}
