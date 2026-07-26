// Export a customer's data as a Priority-ready onboarding form (PDF via browser print).
// Priority ERP standard fields (CUSTOMERS + CUSTCONTACTS + CUSTADDRESS) are laid out
// so an operator can key the record straight into the system.

type CustomerRow = {
  customer_code?: string | null;
  company_name?: string | null;
  trade_name?: string | null;
  company_id?: string | null;
  company_type?: string | null;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  status?: string | null;
  account_manager?: string | null;
  sales_rep?: string | null;
  service_rep?: string | null;
  ops_manager?: string | null;
  finance_manager?: string | null;
};

type AddressRow = {
  site_name?: string | null;
  type?: string | null;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postal?: string | null;
  floor?: string | null;
  room?: string | null;
  hours?: string | null;
  notes?: string | null;
};

type ContactRow = {
  full_name?: string | null;
  role?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  language?: string | null;
  is_primary?: boolean | null;
  notifications?: boolean | null;
};

type CommercialData = Record<string, string | number | boolean | null | undefined>;

const STATUS_HE: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
  frozen: "בהקפאה",
  lead: "פוטנציאלי",
  lost: "אבוד",
};

function esc(v: unknown): string {
  if (v === null || v === undefined || v === "") return "&mdash;";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function row(label: string, priorityField: string, value: unknown) {
  return `
    <tr>
      <td class="lbl">${esc(label)}</td>
      <td class="fld"><code>${esc(priorityField)}</code></td>
      <td class="val">${esc(value)}</td>
    </tr>`;
}

function section(title: string, rowsHtml: string) {
  return `
    <section>
      <h2>${esc(title)}</h2>
      <table class="kv">
        <thead>
          <tr><th style="width:34%">שדה</th><th style="width:22%">Priority</th><th>ערך</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </section>`;
}

export function exportCustomerToPriorityPdf(input: {
  customer: CustomerRow;
  addresses: AddressRow[];
  contacts: ContactRow[];
  commercial: CommercialData | null | undefined;
}) {
  const { customer, addresses, contacts, commercial } = input;
  const c = commercial ?? {};
  const cv = (k: string) => (c as Record<string, unknown>)[k];

  const primary =
    contacts.find((x) => x.is_primary) ?? contacts[0] ?? ({} as ContactRow);
  const mainAddr = addresses[0] ?? ({} as AddressRow);

  const generalRows =
    row("מספר לקוח", "CUSTNAME", customer.customer_code) +
    row("שם לקוח", "CUSTDES", customer.company_name) +
    row("שם מסחרי", "PRINTNAME", customer.trade_name) +
    row("ח.פ. / ע.מ.", "VATNUM", customer.company_id) +
    row("סוג תאגיד", "COMPANYTYPE", customer.company_type) +
    row("משפחת לקוחות", "FAMILYDES", customer.industry) +
    row("מגזר", "CUSTGROUP", customer.sector) +
    row("סטטוס", "STATDES", STATUS_HE[customer.status ?? ""] ?? customer.status) +
    row("אתר אינטרנט", "HTMLNAME", customer.website) +
    row("סוכן", "AGENTNAME", customer.sales_rep) +
    row("מנהל תיק", "ACCOUNTMGR", customer.account_manager);

  const addrRows =
    row("שם אתר", "ADDRESSNAME", mainAddr.site_name) +
    row("סוג כתובת", "ADDRESSTYPE", mainAddr.type) +
    row("רחוב", "ADDRESS", mainAddr.street) +
    row("קומה/חדר", "ADDRESS2", [mainAddr.floor, mainAddr.room].filter(Boolean).join(" / ")) +
    row("עיר", "STATE", mainAddr.city) +
    row("מיקוד", "ZIP", mainAddr.postal) +
    row("מדינה", "COUNTRYNAME", mainAddr.country) +
    row("שעות פעילות", "OPENHOURS", mainAddr.hours) +
    row("הערות", "SPECIFICATION", mainAddr.notes);

  const contactRows =
    row("איש קשר ראשי", "CONTACT", primary.full_name) +
    row("תפקיד", "POSITIONDES", primary.role) +
    row("מחלקה", "DEPARTMENT", primary.department) +
    row("טלפון", "PHONENUM", primary.phone) +
    row("נייד", "CELLPHONE", primary.mobile) +
    row("אימייל", "EMAIL", primary.email) +
    row("WhatsApp", "WHATSAPP", primary.whatsapp) +
    row("שפה", "LANGUAGE", primary.language);

  const commercialRows =
    row("תנאי תשלום", "PAYCODE", cv("paymentTerms")) +
    row("מטבע ברירת מחדל", "CURRENCY", cv("currency") ?? "ILS") +
    row("מסגרת אשראי", "OBLIGO", cv("creditLimit")) +
    row("דירוג פנימי", "CUSTRATING", cv("internalRating")) +
    row("BDI", "BDIRATING", cv("bdi")) +
    row("D&B", "DNBRATING", cv("dnb")) +
    row("Coface", "COFACERATING", cv("coface")) +
    row("ביטוח אשראי", "CREDITINS", cv("creditInsurer")) +
    row("סכום מבוטח", "INSAMOUNT", cv("insuredAmount")) +
    row("חשבון בנק", "BANKACCOUNT", cv("bankAccount")) +
    row("שם בנק", "BANKNAME", cv("bankName")) +
    row("SWIFT / IBAN", "SWIFT", cv("swift")) +
    row("הערות מסחריות", "REMARK", cv("notes"));

  const contactsListRows = contacts.length
    ? contacts
        .map(
          (x, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(x.full_name)}</td>
          <td>${esc(x.role)}</td>
          <td dir="ltr">${esc(x.phone)}</td>
          <td dir="ltr">${esc(x.mobile)}</td>
          <td dir="ltr">${esc(x.email)}</td>
          <td>${x.is_primary ? "✓" : ""}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">אין אנשי קשר</td></tr>`;

  const addressesListRows = addresses.length
    ? addresses
        .map(
          (a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(a.site_name)}</td>
          <td>${esc(a.type)}</td>
          <td>${esc(a.country)}</td>
          <td>${esc(a.city)}</td>
          <td>${esc(a.street)}</td>
          <td>${esc(a.postal)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">אין כתובות</td></tr>`;

  const now = new Date().toLocaleString("he-IL");
  const title = `Priority — פתיחת לקוח — ${customer.company_name ?? ""}`.trim();

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Heebo", "Arial", sans-serif; color: #0b1220; margin: 0; padding-top: 64px; }
  header { display:flex; justify-content:space-between; align-items:flex-end;
    border-bottom:2px solid #001F3F; padding-bottom:10px; margin-bottom:16px; }
  header .brand { font-size:12px; color:#64748b; }
  header h1 { margin:0; font-size:20px; color:#001F3F; }
  header h1 small { color:#64748b; font-weight:400; font-size:12px; margin-inline-start:8px; }
  section { break-inside: avoid; margin-bottom: 14px; }
  section h2 { font-size:13px; margin:14px 0 6px;
    background:#001F3F; color:#fff; padding:6px 10px; border-radius:6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  table.kv td, table.kv th { border:1px solid #e2e8f0; padding:5px 8px; vertical-align:top; }
  table.kv th { background:#f1f5f9; text-align:right; font-weight:600; }
  table.kv td.lbl { background:#f8fafc; font-weight:600; width:34%; }
  table.kv td.fld { width:22%; }
  table.kv td.fld code { font-family: "SFMono-Regular","Menlo",monospace; font-size:10px; color:#334155; }
  table.list { margin-top:4px; }
  table.list th, table.list td { border:1px solid #e2e8f0; padding:5px 8px; font-size:11px; }
  table.list th { background:#f1f5f9; text-align:right; }
  table.list td.empty { text-align:center; color:#94a3b8; padding:12px; }
  footer { margin-top:18px; padding-top:8px; border-top:1px solid #e2e8f0;
    font-size:10px; color:#64748b; display:flex; justify-content:space-between; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .grid-2 section { margin-bottom:0; }
  @media print { .noprint { display:none; } body { padding-top: 0; } }
  .toolbar { position:fixed; top:0; left:0; right:0; z-index:50;
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    padding:10px 16px; background:#ffffff; border-bottom:1px solid #e2e8f0;
    box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .toolbar .actions { display:flex; gap:8px; }
  .toolbar button { background:#001F3F; color:#fff; border:0; padding:8px 14px;
    border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; }
  .toolbar button.secondary { background:#e2e8f0; color:#0b1220; }
  .toolbar .banner { background:#fff7ed; color:#7c2d12;
    border:1px solid #fdba74; padding:6px 12px; border-radius:8px; font-size:12px;
    max-width:520px; }
</style>
</head>
<body>
  <div class="toolbar noprint">
    <div class="banner">
      תצוגה מקדימה — בדקו את הפרטים ולחצו על "שמור כ-PDF" כשמוכן.
    </div>
    <div class="actions">
      <button onclick="window.print()">שמור כ-PDF / הדפסה</button>
      <button class="secondary" onclick="window.close()">סגור</button>
    </div>
  </div>

  <header>
    <div>
      <h1>טופס פתיחת לקוח — Priority <small>${esc(customer.customer_code ?? "")}</small></h1>
      <div class="brand">AFIK Logistics Platform · יצוא לצורך הזנה למערכת Priority</div>
    </div>
    <div style="text-align:left">
      <div style="font-size:11px;color:#64748b">תאריך הפקה</div>
      <div style="font-weight:600">${esc(now)}</div>
    </div>
  </header>

  ${section("פרטי חברה (CUSTOMERS)", generalRows)}

  <div class="grid-2">
    ${section("כתובת ראשית (CUSTADDRESS)", addrRows)}
    ${section("איש קשר ראשי (CUSTCONTACTS)", contactRows)}
  </div>

  ${section("נתונים מסחריים (CUST/OBLIGO/PAYCODE)", commercialRows)}

  <section>
    <h2>רשימת כתובות (CUSTADDRESS)</h2>
    <table class="list">
      <thead>
        <tr><th style="width:28px">#</th><th>שם אתר</th><th>סוג</th><th>מדינה</th><th>עיר</th><th>רחוב</th><th>מיקוד</th></tr>
      </thead>
      <tbody>${addressesListRows}</tbody>
    </table>
  </section>

  <section>
    <h2>רשימת אנשי קשר (CUSTCONTACTS)</h2>
    <table class="list">
      <thead>
        <tr><th style="width:28px">#</th><th>שם</th><th>תפקיד</th><th>טלפון</th><th>נייד</th><th>אימייל</th><th>ראשי</th></tr>
      </thead>
      <tbody>${contactsListRows}</tbody>
    </table>
  </section>

  <footer>
    <span>הטופס מיועד לפתיחת לקוח במסך CUSTOMERS של Priority. שדות ה-Priority מסומנים בטבלה.</span>
    <span>${esc(customer.company_name ?? "")}</span>
  </footer>

  <!-- תצוגה מקדימה: הלחיצה על "שמור כ-PDF" מבוצעת ידנית לאחר בדיקת הפרטים -->
</body>
</html>`;

  const win = window.open("", "_blank", "width=980,height=1200");
  if (!win) {
    throw new Error("החלון נחסם על ידי הדפדפן. אפשרו חלונות קופצים ונסו שוב.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
