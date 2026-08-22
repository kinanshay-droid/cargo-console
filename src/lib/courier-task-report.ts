// Builds a standalone, printable HTML document for the courier task report
// ("דוח משימה לבלדר") — styled like a waybill (שטר מטען) so the courier gets
// every relevant detail (pickup/delivery address + contacts, cargo details,
// temperature/dry ice/logger info, special instructions) on one page, with
// signature lines at the bottom for physical handoff confirmation.

export type CourierTaskReportContact = { name: string; phone: string };

// One physical pickup or delivery point. Most shipments have exactly one of
// each, but drop-shipments (Multi Pickup / Multi Drop / Milk Run etc.) can
// have several — each with its own address and contact — so the report
// always works off a list rather than a single address+contact pair.
export type CourierTaskReportPoint = {
  label?: string;
  address: string;
  contacts: CourierTaskReportContact[];
  plannedTime?: string;
  notes?: string;
};

export type CourierTaskReportData = {
  caseCode: string;
  customerName: string;
  customerRef: string;
  shipmentKindLabel: string;
  courierName: string;
  pickupDate: string;
  deliveryDate: string;
  pickupPoints: CourierTaskReportPoint[];
  deliveryPoints: CourierTaskReportPoint[];
  hubPoints: CourierTaskReportPoint[];
  packagingLines: string[];
  grossWeight: string;
  volumetricWeight: string;
  chargeableWeight: string;
  tempRangeLabel: string;
  dryIceLabel: string;
  loggerLabels: string[];
  attrLabels: string[];
  specialInstructions: string;
  notes: string;
  generatedAt: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function contactLines(contacts: CourierTaskReportContact[]): string {
  if (contacts.length === 0) return '<div class="muted">— אין איש קשר —</div>';
  return contacts
    .map((c) => `<div class="contact-line"><strong>${esc(c.name) || "—"}</strong>${c.phone ? ` · ${esc(c.phone)}` : ""}</div>`)
    .join("");
}

function listOrDash(items: string[]): string {
  return items.length ? items.map((i) => `<div>${esc(i)}</div>`).join("") : "—";
}

// Renders one column of stacked point-boxes (all pickups, or all deliveries).
// When there's more than one point, each box is numbered so the courier can
// tell them apart at a glance.
function pointColumn(title: string, points: CourierTaskReportPoint[]): string {
  if (points.length === 0) {
    return `<div class="point-col">
      <div class="box-title">${esc(title)}</div>
      <div class="point-box"><div class="address">—</div><div class="muted">— אין פרטי כתובת —</div></div>
    </div>`;
  }
  const boxes = points
    .map((p, i) => {
      const numberLabel = points.length > 1 ? ` ${i + 1}` : "";
      return `<div class="point-box">
        ${points.length > 1 || p.label ? `<div class="point-label">${esc(p.label || `נקודה${numberLabel}`)}</div>` : ""}
        <div class="address">${esc(p.address) || "—"}</div>
        ${contactLines(p.contacts)}
        ${p.plannedTime ? `<div class="contact-line muted">חלון זמן: ${esc(p.plannedTime)}</div>` : ""}
        ${p.notes ? `<div class="contact-line muted">${esc(p.notes)}</div>` : ""}
      </div>`;
    })
    .join("");
  return `<div class="point-col">
    <div class="box-title">${esc(title)}${points.length > 1 ? ` (${points.length})` : ""}</div>
    ${boxes}
  </div>`;
}

export function buildCourierTaskReportHtml(data: CourierTaskReportData): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>דוח משימה — ${esc(data.caseCode)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; direction: rtl; background: #eef1f5; }
  .sheet { max-width: 820px; margin: 0 auto; border: 2px solid #1a1a1a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 2px solid #1a1a1a; background: #0f2d52; color: #fff; }
  .header .brand { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
  .header .doc-title { text-align: left; }
  .header .doc-title .title { font-size: 16px; font-weight: 700; }
  .header .doc-title .sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
  .meta-bar { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #999; }
  .meta-bar .cell { padding: 8px 12px; border-left: 1px solid #ccc; }
  .meta-bar .cell:last-child { border-left: none; }
  .meta-bar .label { font-size: 10px; color: #666; }
  .meta-bar .value { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .boxes { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #999; }
  .point-col { padding: 12px 16px; border-left: 1px solid #ccc; }
  .point-col:last-child { border-left: none; }
  .box-title { font-size: 12px; font-weight: 700; color: #0f2d52; margin-bottom: 6px; text-transform: uppercase; }
  .point-box { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ddd; }
  .point-box:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .point-label { font-size: 11px; font-weight: 700; color: #555; margin-bottom: 2px; }
  .address { font-size: 13px; margin-bottom: 4px; min-height: 18px; }
  .contact-line { font-size: 12px; margin-top: 2px; }
  .muted { font-size: 12px; color: #888; }
  .section { padding: 12px 16px; border-bottom: 1px solid #999; }
  .section-title { font-size: 12px; font-weight: 700; color: #0f2d52; margin-bottom: 8px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  table th, table td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; vertical-align: top; }
  table th { background: #f2f4f7; font-weight: 700; }
  .weights { display: flex; gap: 24px; margin-top: 10px; font-size: 12px; }
  .weights strong { display: block; font-size: 14px; margin-top: 2px; }
  .notes-box { min-height: 32px; font-size: 12px; white-space: pre-wrap; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; }
  .sig { padding: 20px 16px 12px; border-left: 1px solid #ccc; }
  .sig:last-child { border-left: none; }
  .sig .line { border-top: 1px solid #333; margin-top: 36px; padding-top: 4px; font-size: 11px; color: #555; }
  .footer-note { padding: 8px 16px; font-size: 10px; color: #999; text-align: center; }
  @media print {
    body { padding: 0; background: #fff; }
    .sheet { border: none; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">AFIK LOGISTICS</div>
      <div class="doc-title">
        <div class="title">דוח משימה לבלדר</div>
        <div class="sub">הופק: ${esc(data.generatedAt)}</div>
      </div>
    </div>

    <div class="meta-bar">
      <div class="cell"><div class="label">מספר משלוח</div><div class="value">${esc(data.caseCode) || "—"}</div></div>
      <div class="cell"><div class="label">לקוח</div><div class="value">${esc(data.customerName) || "—"}</div></div>
      <div class="cell"><div class="label">Ref לקוח</div><div class="value">${esc(data.customerRef) || "—"}</div></div>
      <div class="cell"><div class="label">סוג משלוח</div><div class="value">${esc(data.shipmentKindLabel) || "—"}</div></div>
    </div>
    <div class="meta-bar">
      <div class="cell"><div class="label">בלדר</div><div class="value">${esc(data.courierName) || "—"}</div></div>
      <div class="cell"><div class="label">תאריך איסוף</div><div class="value">${esc(data.pickupDate) || "—"}</div></div>
      <div class="cell"><div class="label">תאריך מסירה</div><div class="value">${esc(data.deliveryDate) || "—"}</div></div>
      <div class="cell"><div class="label">מס' תיק</div><div class="value">${esc(data.caseCode) || "—"}</div></div>
    </div>

    <div class="boxes">
      ${pointColumn("איסוף מ־", data.pickupPoints)}
      ${pointColumn("מסירה ל־", data.deliveryPoints)}
    </div>

    ${
      data.hubPoints.length > 0
        ? `<div class="boxes" style="grid-template-columns: 1fr;">
      ${pointColumn("תחנת מעבר", data.hubPoints)}
    </div>`
        : ""
    }

    <div class="section">
      <div class="section-title">פרטי מטען</div>
      <table>
        <thead><tr><th>אריזה</th><th>טווח טמפרטורה</th><th>קרח יבש</th><th>רשם טמפרטורה</th></tr></thead>
        <tbody>
          <tr>
            <td>${listOrDash(data.packagingLines)}</td>
            <td>${esc(data.tempRangeLabel) || "—"}</td>
            <td>${esc(data.dryIceLabel) || "—"}</td>
            <td>${listOrDash(data.loggerLabels)}</td>
          </tr>
        </tbody>
      </table>
      <div class="weights">
        <div>משקל ברוטו<strong>${esc(data.grossWeight)}</strong></div>
        <div>משקל נפחי<strong>${esc(data.volumetricWeight)}</strong></div>
        <div>משקל לחיוב<strong>${esc(data.chargeableWeight)}</strong></div>
      </div>
    </div>

    ${
      data.attrLabels.length > 0
        ? `<div class="section">
      <div class="section-title">מאפייני מטען</div>
      <div>${listOrDash(data.attrLabels)}</div>
    </div>`
        : ""
    }

    <div class="section">
      <div class="section-title">הוראות מיוחדות</div>
      <div class="notes-box">${esc(data.specialInstructions) || "אין הוראות מיוחדות"}</div>
    </div>

    ${
      data.notes
        ? `<div class="section">
      <div class="section-title">הערות נוספות</div>
      <div class="notes-box">${esc(data.notes)}</div>
    </div>`
        : ""
    }

    <div class="signatures">
      <div class="sig">
        <div class="line">חתימת מוסר / שעת איסוף בפועל</div>
      </div>
      <div class="sig">
        <div class="line">חתימת מקבל / שעת מסירה בפועל</div>
      </div>
    </div>

    <div class="footer-note">מסמך זה הופק אוטומטית ממערכת AFIK Logistics Platform</div>
  </div>
</body>
</html>`;
}
