// Overlays case data onto the blank IATA-style Air Waybill (AWB) template
// (public/awb-template.svg) at hand-measured coordinates, so export and
// distribution cases can produce a mostly-filled AWB straight from what's
// already on file instead of starting from a blank form. Coordinates are in
// the template's own mm units (viewBox 0 0 210 297 — A4).
//
// Only fields we can confidently map from case data are filled in; anything
// we don't have a reliable source for (declared value, charges, IATA agent
// codes, insurance amount, etc.) is deliberately left blank for the user to
// complete by hand.

export type AwbFillData = {
  shipperName: string;
  shipperAddress: string;
  shipperContactLine: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeContactLine: string;
  issuedBy: string;
  originPort: string;
  destPort: string;
  referenceNumber: string;
  flightAndDate: string;
  handlingInfo: string;
  pieces: string;
  grossWeight: string;
  commodityLabel: string;
  chargeableWeight: string;
  goodsLines: string[];
  executedDate: string;
  executedPlace: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type TextSpec = { x: number; y: number; text: string; size?: number };

function textEl({ x, y, text, size = 3 }: TextSpec): string {
  if (!text) return "";
  return `<text x="${x}" y="${y}" style="font-family:Arial;font-size:${size}px;fill:#c0392b;">${esc(text)}</text>`;
}

function multiLine(x: number, startY: number, lines: string[], lineHeight = 4): string {
  return lines
    .filter(Boolean)
    .map((t, i) => textEl({ x, y: startY + i * lineHeight, text: t }))
    .join("\n");
}

export function buildAwbOverlaySvg(templateSvg: string, data: AwbFillData): string {
  const overlay = [
    // Shipper's Name and Address
    multiLine(17, 30, [data.shipperName, data.shipperAddress, data.shipperContactLine]),
    // Consignee's Name and Address
    multiLine(17, 55, [data.consigneeName, data.consigneeAddress, data.consigneeContactLine]),
    // Issuing Carrier's Agent Name and City (AFIK is always the issuing agent)
    textEl({ x: 17, y: 80, text: "AFIK Logistics Ltd., Tel Aviv" }),
    // Issued By
    textEl({ x: 108, y: 40, text: data.issuedBy }),
    // Airport of Departure (Addr. of First Carrier) and Requested Routing
    textEl({ x: 17, y: 104, text: data.originPort }),
    // Reference Number
    textEl({ x: 113, y: 104, text: data.referenceNumber }),
    // Airport of Destination
    textEl({ x: 17, y: 120.5, text: data.destPort }),
    // Requested Flight/Date
    textEl({ x: 72, y: 120.5, text: data.flightAndDate }),
    // Handling Information
    textEl({ x: 17, y: 129, text: data.handlingInfo }),
    // Cargo table first data row: No. of Pieces / Gross Weight / Rate Class /
    // Commodity / Chargeable Weight / Nature and Quantity of Goods
    textEl({ x: 18, y: 165, text: data.pieces }),
    textEl({ x: 33, y: 165, text: data.grossWeight }),
    textEl({ x: 49, y: 165, text: data.commodityLabel }),
    textEl({ x: 68, y: 165, text: data.chargeableWeight }),
    multiLine(145, 165, data.goodsLines),
    // Executed on (date) / at (place) — bottom signature block
    textEl({ x: 96, y: 270.5, text: data.executedDate }),
    textEl({ x: 130, y: 270.5, text: data.executedPlace }),
  ]
    .filter(Boolean)
    .join("\n");

  return templateSvg.replace("</svg>", `${overlay}\n</svg>`);
}
