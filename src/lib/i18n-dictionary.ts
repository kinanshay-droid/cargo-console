// Central translation dictionary for the app-wide language toggle.
// Only screens that have been wired up to useI18n()/t() so far pull from
// here (currently: the dashboard sidebar chrome + the Overview page). The
// rest of the app is still hardcoded Hebrew/English text and unaffected by
// the toggle until it's migrated the same way, key by key.

export type Locale = "he" | "en";

export const DICTIONARY = {
  // App-wide chrome
  "app.name": { he: "AFIK Logistics Platform", en: "AFIK Logistics Platform" },
  "app.tagline": { he: "The Intelligence Behind Every Shipment.", en: "The Intelligence Behind Every Shipment." },
  "common.loading": { he: "טוען...", en: "Loading…" },
  "common.member": { he: "חבר", en: "Member" },
  "common.admin": { he: "אדמין", en: "Admin" },
  "common.addShort": { he: "+ הוסף", en: "+ Add" },

  // Sidebar navigation
  "nav.overview": { he: "הלקוחות שלנו", en: "Our customers" },
  "nav.commercial": { he: "מסחרי", en: "Commercial" },
  "nav.operations": { he: "תפעול", en: "Operations" },
  "nav.shipments": { he: "משלוחים", en: "Shipments" },
  "nav.pickupDistribution": { he: "איסוף/הפצה", en: "Pickup / Distribution" },
  "nav.account": { he: "חשבון", en: "Account" },
  "nav.users": { he: "משתמשים", en: "Users" },
  "nav.roles": { he: "תפקידים", en: "Roles" },
  "nav.organization": { he: "ארגון", en: "Organization" },
  "nav.auditLog": { he: "יומן ביקורת", en: "Audit Log" },
  "nav.adminSection": { he: "אדמין", en: "ADMIN" },
  "sidebar.collapse": { he: "כווץ סרגל צד", en: "Collapse sidebar" },

  // Logout confirmation
  "logout.title": { he: "להתנתק?", en: "Log out?" },
  "logout.description": {
    he: "תצטרך להתחבר שוב כדי לגשת לארגון שלך.",
    en: "You'll need to sign in again to access your organization.",
  },
  "logout.confirm": { he: "התנתקות", en: "Log out" },
  "logout.button": { he: "התנתקות", en: "Log out" },

  // Language toggle button itself
  "lang.toggleTo": { he: "English", en: "עברית" },

  // Overview page (flagship translated screen)
  "overview.title": { he: "הלקוחות שלנו", en: "Our customers" },
  "overview.subtitle": {
    he: "ריכזו את כל הלקוחות שלכם במקום אחד",
    en: "All your customers, in one place",
  },
  "overview.newCustomer": { he: "לקוח חדש", en: "New customer" },
  "overview.newLead": { he: "לקוח פוטנציאלי", en: "New lead" },
  "overview.manageCustomers": { he: "ניהול תיקי לקוחות", en: "Manage customer records" },
  "overview.statTotalCustomers": { he: 'סה"כ לקוחות', en: "Total customers" },
  "overview.statActiveCustomers": { he: "לקוחות פעילים", en: "Active customers" },
  "overview.statNew30Days": { he: "לקוחות חדשים (30 ימים)", en: "New customers (30 days)" },
  "overview.statTotalQuotes": { he: 'סה"כ הצעות מחיר', en: "Total quotes" },
  "overview.recentCustomers": { he: "לקוחות חדשים (5 האחרונים)", en: "New customers (last 5)" },
  "overview.recentLeads": { he: "לקוחות פוטנציאליים (5 האחרונים)", en: "Leads (last 5)" },
  "overview.statusBreakdown": { he: "פילוח לפי סטטוס לקוח", en: "Breakdown by customer status" },
  "overview.noCustomersYet": { he: "אין לקוחות עדיין", en: "No customers yet" },
  "overview.noLeadsYet": { he: "אין לקוחות פוטנציאליים עדיין", en: "No leads yet" },
  "overview.noDataYet": { he: "אין נתונים להצגה", en: "No data to show" },
  "status.active": { he: "פעיל", en: "Active" },
  "status.inactive": { he: "לא פעיל", en: "Inactive" },
  "status.frozen": { he: "בהקפאה", en: "Frozen" },
} as const satisfies Record<string, Record<Locale, string>>;

export type TranslationKey = keyof typeof DICTIONARY;
