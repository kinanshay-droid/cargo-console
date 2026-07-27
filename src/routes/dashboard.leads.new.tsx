import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight, Sparkles, Building2, LineChart, Target, Users2,
  MapPin, Activity, Trash2, Plus, Save, Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createCustomer, saveCommercial, saveContacts, saveAddresses } from "@/lib/customers.functions";
import { createActivity } from "@/lib/customer-activities.functions";
import { Lookup } from "@/components/lookup";

export const Route = createFileRoute("/dashboard/leads/new")({
  head: () => ({
    meta: [
      { title: "לקוח פוטנציאלי חדש — AFIK Logistics Platform" },
      { name: "description", content: "פתיחת תיק לקוח פוטנציאלי (Lead) עם פרטי חברה, נתונים מסחריים ופוטנציאל עסקי." },
      { property: "og:title", content: "לקוח פוטנציאלי חדש" },
      { property: "og:description", content: "טופס מלא לפתיחת ליד — פרטי חברה, מסחרי, פוטנציאל, אנשי קשר, סניפים ופעילות." },
    ],
  }),
  component: NewLeadPage,
});

const SEGMENTS = ["Pharma", "Biotech", "CRO", "Hospital", "Medical Device", "Diagnostics", "Veterinary"];
const CAPABILITIES = [
  "משלוחים בינלאומיים", "משלוחים מקומיים", "שילוח אווירי", "שילוח יבשתי",
  "Dry Ice", "Liquid Nitrogen", "GDP", "GMP",
  "Clinical Trials", "Biological Samples", "Cell & Gene Therapy", "Commercial Pharma",
];
const LOCATION_TYPES = ["Headquarters", "Warehouse", "Manufacturing Plant", "QC Lab", "Distribution Center", "Hospital", "Clinic"];
const ACTIVITY_TYPES = [
  { v: "call", l: "שיחת טלפון" }, { v: "email", l: "Email" }, { v: "meeting", l: "Meeting" },
  { v: "visit", l: "Visit" }, { v: "quote", l: "Quote" }, { v: "demo", l: "Demo" },
  { v: "tender", l: "Tender" }, { v: "follow_up", l: "Follow Up" }, { v: "note", l: "Notes" },
];

type Contact = {
  fullName: string; role: string; department: string;
  phone: string; mobile: string; email: string;
  linkedin: string; decisionMaker: boolean;
};
type Location = {
  siteName: string; type: string; country: string; city: string; street: string;
  contact: string; hours: string; notes: string;
};

function NewLeadPage() {
  const navigate = useNavigate();
  const createCustomerFn = useServerFn(createCustomer);
  const saveCommercialFn = useServerFn(saveCommercial);
  const saveContactsFn = useServerFn(saveContacts);
  const saveAddressesFn = useServerFn(saveAddresses);
  const createActivityFn = useServerFn(createActivity);

  // Section 1
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState<"lead" | "active" | "inactive" | "lost">("lead");
  const [industry, setIndustry] = useState("");
  const [segment, setSegment] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [country, setCountry] = useState("");
  const [hq, setHq] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [employees, setEmployees] = useState("");
  const [revenue, setRevenue] = useState("");

  // Section 2 — commercial
  const [bdi, setBdi] = useState("");
  const [dnb, setDnb] = useState("");
  const [creditRating, setCreditRating] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [preferredSupplier, setPreferredSupplier] = useState("");
  const [strategic, setStrategic] = useState(false);
  const [potential, setPotential] = useState<"high" | "medium" | "low">("medium");

  // Section 3 — business potential
  const [monthlyVolume, setMonthlyVolume] = useState("");
  const [annualEstRevenue, setAnnualEstRevenue] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const toggleCap = (c: string) =>
    setCapabilities((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  // Section 4 — customer team
  const [contacts, setContacts] = useState<Contact[]>([
    { fullName: "", role: "", department: "", phone: "", mobile: "", email: "", linkedin: "", decisionMaker: false },
  ]);
  const updateContact = (i: number, patch: Partial<Contact>) =>
    setContacts((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addContact = () =>
    setContacts((p) => [...p, { fullName: "", role: "", department: "", phone: "", mobile: "", email: "", linkedin: "", decisionMaker: false }]);
  const removeContact = (i: number) => setContacts((p) => p.filter((_, idx) => idx !== i));

  // Section 5 — locations
  const [locations, setLocations] = useState<Location[]>([
    { siteName: "", type: "Headquarters", country: "", city: "", street: "", contact: "", hours: "", notes: "" },
  ]);
  const updateLocation = (i: number, patch: Partial<Location>) =>
    setLocations((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLocation = () =>
    setLocations((p) => [...p, { siteName: "", type: "", country: "", city: "", street: "", contact: "", hours: "", notes: "" }]);
  const removeLocation = (i: number) => setLocations((p) => p.filter((_, idx) => idx !== i));

  // Section 6 — first activity (optional)
  const [actType, setActType] = useState("");
  const [actSubject, setActSubject] = useState("");
  const [actNotes, setActNotes] = useState("");
  const [actOutcome, setActOutcome] = useState("");
  const [actNext, setActNext] = useState("");
  const [actDue, setActDue] = useState("");

  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!companyName.trim()) {
      toast.error("שם החברה חובה");
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomerFn({
        data: {
          companyName: companyName.trim(),
          companyId: companyId.trim() || null,
          industry: industry.trim() || null,
          website: website.trim() || null,
          status: status === "lost" ? "inactive" : status,
        },
      });
      if (!created?.id) throw new Error("Failed to create lead");

      const commercialData: Record<string, unknown> = {
        // company extras
        segment: segment || null,
        linkedin: linkedin || null,
        country: country || null,
        headquarters: hq || null,
        founded_year: foundedYear || null,
        employees: employees || null,
        annual_revenue: revenue || null,
        // status extension (lost is UI-only for now)
        ui_status: status,
        // commercial
        bdi_rating: bdi || null,
        dnb_rating: dnb || null,
        credit_rating: creditRating || null,
        credit_limit: creditLimit || null,
        payment_terms: paymentTerms || null,
        preferred_supplier: preferredSupplier || null,
        is_strategic: strategic,
        potential_level: potential,
        // business potential
        monthly_shipments_volume: monthlyVolume || null,
        estimated_annual_revenue: annualEstRevenue || null,
        capabilities,
      };
      await saveCommercialFn({ data: { customerId: created.id, data: commercialData } });

      const contactsToSave = contacts.filter((c) => c.fullName.trim() || c.email.trim() || c.phone.trim());
      if (contactsToSave.length > 0) {
        await saveContactsFn({
          data: {
            customerId: created.id,
            contacts: contactsToSave.map((c, i) => ({
              fullName: c.fullName || null,
              role: c.role || null,
              department: c.department || null,
              phone: c.phone || null,
              mobile: c.mobile || null,
              email: c.email || null,
              whatsapp: c.linkedin || null, // reuse: linkedin stored in whatsapp col
              language: c.decisionMaker ? "decision_maker" : null,
              isPrimary: i === 0,
            })),
          },
        });
      }

      const locsToSave = locations.filter((l) => l.siteName.trim() || l.city.trim() || l.street.trim());
      if (locsToSave.length > 0) {
        await saveAddressesFn({
          data: {
            customerId: created.id,
            addresses: locsToSave.map((l) => ({
              siteName: l.siteName || null,
              type: l.type || null,
              country: l.country || null,
              city: l.city || null,
              street: l.street || null,
              hours: l.hours || null,
              notes: l.contact ? `איש קשר: ${l.contact}\n${l.notes || ""}`.trim() : (l.notes || null),
            })),
          },
        });
      }

      if (actType) {
        await createActivityFn({
          data: {
            customerId: created.id,
            activityType: actType,
            subject: actSubject || null,
            notes: actNotes || null,
            outcome: actOutcome || null,
            nextTask: actNext || null,
            dueAt: actDue ? new Date(actDue).toISOString() : null,
          },
        });
      }

      toast.success(`ליד ${created.customer_code} נוצר`);
      navigate({ to: "/dashboard/customers/$id", params: { id: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/customers"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
            aria-label="חזרה"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/10 p-2 text-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">לקוח פוטנציאלי חדש</h1>
              <p className="text-sm text-muted-foreground">פתיחת תיק ליד מלא — פרטי חברה, מסחרי, פוטנציאל ופעילות</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link to="/dashboard/customers">ביטול</Link></Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "שומר..." : "שמור ליד"}
          </Button>
        </div>
      </div>

      {/* Quick action strip */}
      <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="text-xs text-muted-foreground">פעולות מהירות יופיעו לאחר שמירת הליד</div>
        <div className="flex flex-wrap gap-1.5 opacity-60">
          {["➕ הצעת מחיר", "📅 פגישה", "☎️ שיחה", "✉️ Email", "📄 תיק", "📎 מסמכים", "⭐ מועדפים", "📝 משימה", "🔔 תזכורת"].map((t) => (
            <span key={t} className="rounded-full border bg-muted px-2.5 py-1 text-xs">{t}</span>
          ))}
        </div>
      </Card>

      {/* Section 1 */}
      <Section icon={<Building2 className="h-5 w-5" />} title="1. פרטי החברה">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="שם החברה *"><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
          <Field label="מספר ח.פ."><Input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="514xxxxxx" /></Field>
          <Field label="סטטוס">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">פוטנציאלי</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
                <SelectItem value="lost">אבוד</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="תחום פעילות"><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="למשל: כימיה ותרופות" /></Field>
          <Field label="סגמנט">
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue placeholder="בחר סגמנט" /></SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="אתר אינטרנט"><Input dir="ltr" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
          <Field label="LinkedIn"><Input dir="ltr" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="linkedin.com/company/..." /></Field>
          <Field label="מדינה">
            <Lookup type="countries" matchBy="code" value={country || null}
              onChange={(item) => setCountry(item?.code ?? "")} placeholder="בחר מדינה..." />
          </Field>
          <Field label="מטה החברה"><Input value={hq} onChange={(e) => setHq(e.target.value)} /></Field>
          <Field label="שנת הקמה"><Input value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} type="number" /></Field>
          <Field label="מספר עובדים"><Input value={employees} onChange={(e) => setEmployees(e.target.value)} type="number" /></Field>
          <Field label="מחזור מכירות"><Input value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="למשל: 50M USD" /></Field>
        </div>
      </Section>

      {/* Section 2 */}
      <Section icon={<LineChart className="h-5 w-5" />} title="2. נתונים מסחריים" highlight>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="דירוג BDI"><Input value={bdi} onChange={(e) => setBdi(e.target.value)} /></Field>
          <Field label="דירוג D&B"><Input value={dnb} onChange={(e) => setDnb(e.target.value)} /></Field>
          <Field label="דירוג אשראי"><Input value={creditRating} onChange={(e) => setCreditRating(e.target.value)} /></Field>
          <Field label="מסגרת אשראי"><Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} /></Field>
          <Field label="תנאי תשלום">
            <Lookup type="payment_terms" matchBy="code" value={paymentTerms || null}
              onChange={(item) => setPaymentTerms(item?.code ?? "")} placeholder="בחר תנאי תשלום..." />
          </Field>
          <Field label="ספק מועדף"><Input value={preferredSupplier} onChange={(e) => setPreferredSupplier(e.target.value)} /></Field>
          <div className="md:col-span-3 flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={strategic} onCheckedChange={(v) => setStrategic(!!v)} />
              לקוח אסטרטגי
            </label>
            <div className="flex items-center gap-3">
              <Label className="text-sm">רמת פוטנציאל:</Label>
              <div className="flex gap-1.5">
                {(["high", "medium", "low"] as const).map((lvl) => (
                  <button
                    key={lvl} type="button" onClick={() => setPotential(lvl)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                      potential === lvl ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <Star className="h-3 w-3" />
                    {lvl === "high" ? "High ★★★★★" : lvl === "medium" ? "Medium ★★★★" : "Low ★★★"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 3 */}
      <Section icon={<Target className="h-5 w-5" />} title="3. פוטנציאל עסקי">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="נפח משלוחים חודשי"><Input value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value)} placeholder="למשל: 40 משלוחים" /></Field>
          <Field label="Estimated Annual Revenue"><Input value={annualEstRevenue} onChange={(e) => setAnnualEstRevenue(e.target.value)} placeholder="USD" /></Field>
        </div>
        <div className="mt-4">
          <Label className="mb-2 block text-sm">יכולות ודרישות</Label>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => {
              const on = capabilities.includes(c);
              return (
                <button
                  key={c} type="button" onClick={() => toggleCap(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Section 4 — Customer Team */}
      <Section icon={<Users2 className="h-5 w-5" />} title="4. Customer Team">
        <div className="space-y-3">
          {contacts.map((c, i) => (
            <div key={i} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-4">
              <Field label="שם"><Input value={c.fullName} onChange={(e) => updateContact(i, { fullName: e.target.value })} /></Field>
              <Field label="תפקיד"><Input value={c.role} onChange={(e) => updateContact(i, { role: e.target.value })} /></Field>
              <Field label="מחלקה"><Input value={c.department} onChange={(e) => updateContact(i, { department: e.target.value })} /></Field>
              <Field label="טלפון"><Input dir="ltr" value={c.phone} onChange={(e) => updateContact(i, { phone: e.target.value })} /></Field>
              <Field label="נייד"><Input dir="ltr" value={c.mobile} onChange={(e) => updateContact(i, { mobile: e.target.value })} /></Field>
              <Field label="Email"><Input dir="ltr" value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} /></Field>
              <Field label="LinkedIn"><Input dir="ltr" value={c.linkedin} onChange={(e) => updateContact(i, { linkedin: e.target.value })} /></Field>
              <div className="flex items-end justify-between gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={c.decisionMaker} onCheckedChange={(v) => updateContact(i, { decisionMaker: !!v })} />
                  מקבל החלטות
                </label>
                {contacts.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addContact} className="gap-2">
            <Plus className="h-4 w-4" /> הוסף איש קשר
          </Button>
        </div>
      </Section>

      {/* Section 5 — Locations */}
      <Section icon={<MapPin className="h-5 w-5" />} title="5. Locations">
        <div className="space-y-3">
          {locations.map((l, i) => (
            <div key={i} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-3">
              <Field label="שם הסניף"><Input value={l.siteName} onChange={(e) => updateLocation(i, { siteName: e.target.value })} /></Field>
              <Field label="סוג">
                <Select value={l.type} onValueChange={(v) => updateLocation(i, { type: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="מדינה">
                <Lookup type="countries" matchBy="code" value={l.country || null}
                  onChange={(item) => updateLocation(i, { country: item?.code ?? "" })} placeholder="בחר מדינה..." />
              </Field>
              <Field label="עיר"><Input value={l.city} onChange={(e) => updateLocation(i, { city: e.target.value })} /></Field>
              <Field label="רחוב"><Input value={l.street} onChange={(e) => updateLocation(i, { street: e.target.value })} /></Field>
              <Field label="איש קשר"><Input value={l.contact} onChange={(e) => updateLocation(i, { contact: e.target.value })} /></Field>
              <Field label="שעות פעילות"><Input value={l.hours} onChange={(e) => updateLocation(i, { hours: e.target.value })} placeholder="א'-ה' 08:00-17:00" /></Field>
              <Field label="הערות" className="md:col-span-2">
                <Textarea rows={2} value={l.notes} onChange={(e) => updateLocation(i, { notes: e.target.value })} />
              </Field>
              <div className="md:col-span-3 flex justify-end">
                {locations.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLocation(i)} className="gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" /> הסר סניף
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addLocation} className="gap-2">
            <Plus className="h-4 w-4" /> הוסף Location
          </Button>
        </div>
      </Section>

      {/* Section 6 — First CRM activity */}
      <Section icon={<Activity className="h-5 w-5" />} title="6. פעילות מסחרית ראשונה (אופציונלי)">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="סוג פעילות">
            <Select value={actType} onValueChange={setActType}>
              <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((a) => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="נושא"><Input value={actSubject} onChange={(e) => setActSubject(e.target.value)} /></Field>
          <Field label="תוצאה"><Input value={actOutcome} onChange={(e) => setActOutcome(e.target.value)} /></Field>
          <Field label="הערות" className="md:col-span-3">
            <Textarea rows={3} value={actNotes} onChange={(e) => setActNotes(e.target.value)} />
          </Field>
          <Field label="המשימה הבאה"><Input value={actNext} onChange={(e) => setActNext(e.target.value)} /></Field>
          <Field label="תאריך יעד"><Input type="datetime-local" value={actDue} onChange={(e) => setActDue(e.target.value)} /></Field>
        </div>
      </Section>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" asChild><Link to="/dashboard/customers">ביטול</Link></Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "שומר..." : "שמור ליד"}
        </Button>
      </div>
    </div>
  );
}

function Section({ icon, title, children, highlight }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; highlight?: boolean;
}) {
  return (
    <Card className={`p-5 ${highlight ? "border-primary/40 shadow-md" : ""}`}>
      <div className="mb-4 flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${highlight ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
