import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, Trash2, Building2, Users, MapPin, Save, FileText, Upload, Briefcase, Loader2, FileDown } from "lucide-react";
import { exportCustomerToPriorityPdf } from "@/lib/priority-export";
import { CustomerCommercialTab, type CommercialHandle } from "@/components/customer-commercial-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCustomer,
  updateCustomer,
  listAddresses,
  saveAddresses,
  listContacts,
  saveContacts,
  getCommercial,
  saveCommercial,
} from "@/lib/customers.functions";
import {
  ADDRESS_TYPES,
  SECTORS,
  customerInitials,
  customerPalette,
} from "@/lib/customers-demo";

export const Route = createFileRoute("/dashboard/customers/$id")({
  head: () => ({
    meta: [
      { title: "תיק לקוח — AFIK Logistics Platform" },
      { name: "description", content: "פרטי תיק לקוח: שיוך ארגוני, כתובות ואנשי קשר." },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground" dir="rtl">
      הלקוח לא נמצא.{" "}
      <Link to="/dashboard/customers" className="text-primary underline">
        חזרה לרשימה
      </Link>
    </div>
  ),
  errorComponent: () => (
    <div className="p-8 text-center text-muted-foreground" dir="rtl">
      אירעה שגיאה בטעינת התיק.
    </div>
  ),
  component: CustomerDetail,
});

type Address = {
  id: string;
  siteName: string;
  type: string;
  country: string;
  city: string;
  street: string;
  postal: string;
  floor: string;
  room: string;
  gps: string;
  hours: string;
  notes: string;
};

type Contact = {
  id: string;
  fullName: string;
  role: string;
  department: string;
  phone: string;
  mobile: string;
  email: string;
  whatsapp: string;
  language: string;
  availability: string;
  primary: boolean;
  notifications: boolean;
};

const emptyAddress = (): Address => ({
  id: crypto.randomUUID(),
  siteName: "",
  type: ADDRESS_TYPES[0],
  country: "",
  city: "",
  street: "",
  postal: "",
  floor: "",
  room: "",
  gps: "",
  hours: "",
  notes: "",
});

const emptyContact = (): Contact => ({
  id: crypto.randomUUID(),
  fullName: "",
  role: "",
  department: "",
  phone: "",
  mobile: "",
  email: "",
  whatsapp: "",
  language: "עברית",
  availability: "",
  primary: false,
  notifications: false,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  // Lets callers deep-link straight to a tab (e.g. the "quote" quick action
  // navigating here with hash="commercial") instead of always landing on
  // "פרטי חברה" — the Tabs below previously used an uncontrolled
  // defaultValue, so the hash was silently ignored.
  const [activeTab, setActiveTab] = useState(
    () => (typeof window !== "undefined" && window.location.hash ? window.location.hash.slice(1) : "company"),
  );

  const getCustomerFn = useServerFn(getCustomer);
  const listAddressesFn = useServerFn(listAddresses);
  const listContactsFn = useServerFn(listContacts);
  const getCommercialFn = useServerFn(getCommercial);
  const updateCustomerFn = useServerFn(updateCustomer);
  const saveAddressesFn = useServerFn(saveAddresses);
  const saveContactsFn = useServerFn(saveContacts);
  const saveCommercialFn = useServerFn(saveCommercial);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomerFn({ data: { id } }),
  });
  const { data: addressesData } = useQuery({
    queryKey: ["customer-addresses", id],
    queryFn: () => listAddressesFn({ data: { customerId: id } }),
  });
  const { data: contactsData } = useQuery({
    queryKey: ["customer-contacts", id],
    queryFn: () => listContactsFn({ data: { customerId: id } }),
  });
  const { data: commercialData } = useQuery({
    queryKey: ["customer-commercial", id],
    queryFn: () => getCommercialFn({ data: { customerId: id } }),
  });

  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [companyStatus, setCompanyStatus] = useState<"active" | "inactive" | "frozen">("active");
  const [taxId, setTaxId] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<string | null>(null);

  const [sector, setSector] = useState<string>("Pharma");
  const [accountManager, setAccountManager] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [serviceRep, setServiceRep] = useState("");
  const [opsManager, setOpsManager] = useState("");
  const [financeManager, setFinanceManager] = useState("");

  const [addresses, setAddresses] = useState<Address[]>([emptyAddress()]);
  const [contacts, setContacts] = useState<Contact[]>([emptyContact()]);
  const [saving, setSaving] = useState(false);
  const commercialRef = useRef<CommercialHandle>(null);

  useEffect(() => {
    if (!customer) return;
    const c = customer as Record<string, string | null>;
    setCompanyName((c.company_name ?? "") as string);
    setTradeName(c.trade_name ?? "");
    setCompanyStatus(((c.status ?? "active") as "active" | "inactive" | "frozen"));
    setTaxId(c.company_id ?? "");
    setCompanyType(c.company_type ?? "");
    setIndustry(c.industry ?? "");
    setWebsite(c.website ?? "");
    setLogo(c.logo_url ?? null);
    setSector(c.sector ?? "Pharma");
    setAccountManager(c.account_manager ?? "");
    setSalesRep(c.sales_rep ?? "");
    setServiceRep(c.service_rep ?? "");
    setOpsManager(c.ops_manager ?? "");
    setFinanceManager(c.finance_manager ?? "");
  }, [customer]);

  useEffect(() => {
    if (!addressesData || addressesData.length === 0) return;
    setAddresses(
      addressesData.map((a) => ({
        id: a.id,
        siteName: a.site_name ?? "",
        type: a.type ?? ADDRESS_TYPES[0],
        country: a.country ?? "",
        city: a.city ?? "",
        street: a.street ?? "",
        postal: a.postal ?? "",
        floor: a.floor ?? "",
        room: a.room ?? "",
        gps: a.gps ?? "",
        hours: a.hours ?? "",
        notes: a.notes ?? "",
      })),
    );
  }, [addressesData]);

  useEffect(() => {
    if (!contactsData || contactsData.length === 0) return;
    setContacts(
      contactsData.map((c) => ({
        id: c.id,
        fullName: c.full_name ?? "",
        role: c.role ?? "",
        department: c.department ?? "",
        phone: c.phone ?? "",
        mobile: c.mobile ?? "",
        email: c.email ?? "",
        whatsapp: c.whatsapp ?? "",
        language: c.language ?? "עברית",
        availability: c.availability ?? "",
        primary: !!c.is_primary,
        notifications: !!c.notifications,
      })),
    );
  }, [contactsData]);

  const p = customerPalette(customer?.company_name ?? "");

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("הלוגו חייב להיות עד 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const updateAddress = (id: string, patch: Partial<Address>) =>
    setAddresses((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const updateContact = (id: string, patch: Partial<Contact>) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateCustomerFn({
          data: {
            id,
            companyName,
            tradeName: tradeName || null,
            companyId: taxId || null,
            companyType: companyType || null,
            industry: industry || null,
            website: website || null,
            logoUrl: logo,
            status: companyStatus,
            sector: sector || null,
            accountManager: accountManager || null,
            salesRep: salesRep || null,
            serviceRep: serviceRep || null,
            opsManager: opsManager || null,
            financeManager: financeManager || null,
          },
        }),
        saveAddressesFn({
          data: {
            customerId: id,
            addresses: addresses.map((a) => ({
              id: a.id,
              siteName: a.siteName,
              type: a.type,
              country: a.country,
              city: a.city,
              street: a.street,
              postal: a.postal,
              floor: a.floor,
              room: a.room,
              gps: a.gps,
              hours: a.hours,
              notes: a.notes,
            })),
          },
        }),
        saveContactsFn({
          data: {
            customerId: id,
            contacts: contacts.map((c) => ({
              id: c.id,
              fullName: c.fullName,
              role: c.role,
              department: c.department,
              phone: c.phone,
              mobile: c.mobile,
              email: c.email,
              whatsapp: c.whatsapp,
              language: c.language,
              availability: c.availability,
              isPrimary: c.primary,
              notifications: c.notifications,
            })),
          },
        }),
        saveCommercialFn({
          data: {
            customerId: id,
            data: commercialRef.current?.getData() ?? {},
          },
        }),
      ]);
      toast.success("פרטי התיק נשמרו", {
        description: `${addresses.length} כתובות · ${contacts.length} אנשי קשר`,
      });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customer-addresses", id] });
      qc.invalidateQueries({ queryKey: ["customer-contacts", id] });
      qc.invalidateQueries({ queryKey: ["customer-commercial", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground" dir="rtl">
        <Loader2 className="ml-2 h-4 w-4 animate-spin" /> טוען תיק לקוח...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-muted-foreground" dir="rtl">
        הלקוח לא נמצא.{" "}
        <Link to="/dashboard/customers" className="text-primary underline">
          חזרה לרשימה
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/customers"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
            aria-label="חזרה"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl text-lg font-bold ${p.bg} ${p.text}`}>
            {logo ? (
              <img src={logo} alt={customer.company_name} className="h-full w-full object-cover" />
            ) : (
              customerInitials(customer.company_name)
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.company_name}</h1>
            <p className="text-sm text-muted-foreground">תיק לקוח · <span className="font-mono">{customer.customer_code}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              try {
                exportCustomerToPriorityPdf({
                  customer: customer as Parameters<typeof exportCustomerToPriorityPdf>[0]["customer"],
                  addresses: addressesData ?? [],
                  contacts: contactsData ?? [],
                  commercial: (commercialRef.current?.getData() ?? commercialData ?? {}) as Record<string, string | number | boolean | null>,
                });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "יצוא נכשל");
              }
            }}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            ייצא ל-PDF (Priority)
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2 bg-gradient-to-l from-primary to-primary/80">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמירת שינויים
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="company" className="gap-2">
            <FileText className="h-4 w-4" />
            פרטי חברה
          </TabsTrigger>
          <TabsTrigger value="org" className="gap-2">
            <Building2 className="h-4 w-4" />
            שיוך ארגוני
          </TabsTrigger>
          <TabsTrigger value="commercial" className="gap-2">
            <Briefcase className="h-4 w-4" />
            מסחרי
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            כתובות ({addresses.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            אנשי קשר ({contacts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">פרטי חברה</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="שם החברה">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </Field>
              <Field label="שם מסחרי">
                <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
              </Field>
              <Field label="מספר לקוח">
                <Input value={customer.customer_code} readOnly className="bg-muted font-mono" />
              </Field>
              <Field label="סטטוס">
                <Select value={companyStatus} onValueChange={(v) => setCompanyStatus(v as typeof companyStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="inactive">לא פעיל</SelectItem>
                    <SelectItem value="frozen">בהקפאה</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="מספר ח.פ.">
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} dir="ltr" />
              </Field>
              <Field label="סוג חברה">
                <Input value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="בע״מ / שותפות / עוסק מורשה" />
              </Field>
              <Field label="תחום פעילות">
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
              </Field>
              <Field label="אתר אינטרנט">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" dir="ltr" />
              </Field>
              <Field label="לוגו" className="md:col-span-2">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                    {logo ? (
                      <img src={logo} alt="לוגו" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-muted-foreground">אין לוגו</span>
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    העלה לוגו
                    <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                  </label>
                  {logo && (
                    <Button variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-destructive">
                      הסר
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="org" className="mt-4">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">שיוך ארגוני</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="מגזר">
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="מנהל תיק">
                <Input value={accountManager} onChange={(e) => setAccountManager(e.target.value)} placeholder="שם מנהל התיק" />
              </Field>
              <Field label="איש מכירות">
                <Input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="שם איש המכירות" />
              </Field>
              <Field label="נציג שירות">
                <Input value={serviceRep} onChange={(e) => setServiceRep(e.target.value)} placeholder="שם נציג השירות" />
              </Field>
              <Field label="מנהל תפעול">
                <Input value={opsManager} onChange={(e) => setOpsManager(e.target.value)} placeholder="שם מנהל התפעול" />
              </Field>
              <Field label="מנהל כספים">
                <Input value={financeManager} onChange={(e) => setFinanceManager(e.target.value)} placeholder="שם מנהל הכספים" />
              </Field>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="commercial" className="mt-4">
          <CustomerCommercialTab ref={commercialRef} initialData={commercialData ?? undefined} />
        </TabsContent>

        <TabsContent value="addresses" className="mt-4 space-y-4">
          {addresses.map((a, idx) => (
            <div key={a.id} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">כתובת #{idx + 1}</h3>
                {addresses.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddresses((prev) => prev.filter((x) => x.id !== a.id))}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    הסר
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="שם האתר">
                  <Input value={a.siteName} onChange={(e) => updateAddress(a.id, { siteName: e.target.value })} />
                </Field>
                <Field label="סוג">
                  <Select value={a.type} onValueChange={(v) => updateAddress(a.id, { type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADDRESS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="מדינה">
                  <Input value={a.country} onChange={(e) => updateAddress(a.id, { country: e.target.value })} />
                </Field>
                <Field label="עיר">
                  <Input value={a.city} onChange={(e) => updateAddress(a.id, { city: e.target.value })} />
                </Field>
                <Field label="רחוב">
                  <Input value={a.street} onChange={(e) => updateAddress(a.id, { street: e.target.value })} />
                </Field>
                <Field label="מיקוד">
                  <Input value={a.postal} onChange={(e) => updateAddress(a.id, { postal: e.target.value })} />
                </Field>
                <Field label="קומה">
                  <Input value={a.floor} onChange={(e) => updateAddress(a.id, { floor: e.target.value })} />
                </Field>
                <Field label="חדר">
                  <Input value={a.room} onChange={(e) => updateAddress(a.id, { room: e.target.value })} />
                </Field>
                <Field label="GPS">
                  <Input value={a.gps} onChange={(e) => updateAddress(a.id, { gps: e.target.value })} placeholder="lat, lng" />
                </Field>
                <Field label="שעות פעילות" className="md:col-span-2">
                  <Input value={a.hours} onChange={(e) => updateAddress(a.id, { hours: e.target.value })} placeholder="א'-ה' 08:00-17:00" />
                </Field>
                <Field label="הערות" className="md:col-span-3">
                  <Textarea rows={2} value={a.notes} onChange={(e) => updateAddress(a.id, { notes: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setAddresses((p) => [...p, emptyAddress()])} className="gap-2">
            <Plus className="h-4 w-4" />
            הוסף כתובת
          </Button>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          {contacts.map((c, idx) => (
            <div key={c.id} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">איש קשר #{idx + 1}</h3>
                {contacts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContacts((prev) => prev.filter((x) => x.id !== c.id))}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    הסר
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="שם מלא">
                  <Input value={c.fullName} onChange={(e) => updateContact(c.id, { fullName: e.target.value })} />
                </Field>
                <Field label="תפקיד">
                  <Input value={c.role} onChange={(e) => updateContact(c.id, { role: e.target.value })} />
                </Field>
                <Field label="מחלקה">
                  <Input value={c.department} onChange={(e) => updateContact(c.id, { department: e.target.value })} />
                </Field>
                <Field label="טלפון">
                  <Input value={c.phone} onChange={(e) => updateContact(c.id, { phone: e.target.value })} dir="ltr" />
                </Field>
                <Field label="נייד">
                  <Input value={c.mobile} onChange={(e) => updateContact(c.id, { mobile: e.target.value })} dir="ltr" />
                </Field>
                <Field label="אימייל">
                  <Input type="email" value={c.email} onChange={(e) => updateContact(c.id, { email: e.target.value })} dir="ltr" />
                </Field>
                <Field label="WhatsApp">
                  <Input value={c.whatsapp} onChange={(e) => updateContact(c.id, { whatsapp: e.target.value })} dir="ltr" />
                </Field>
                <Field label="שפה">
                  <Select value={c.language} onValueChange={(v) => updateContact(c.id, { language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="עברית">עברית</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="العربية">العربية</SelectItem>
                      <SelectItem value="Русский">Русский</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="שעות זמינות">
                  <Input value={c.availability} onChange={(e) => updateContact(c.id, { availability: e.target.value })} placeholder="09:00-18:00" />
                </Field>
                <div className="flex items-center gap-6 md:col-span-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={c.primary}
                      onCheckedChange={(v) => updateContact(c.id, { primary: v === true })}
                    />
                    איש קשר ראשי
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={c.notifications}
                      onCheckedChange={(v) => updateContact(c.id, { notifications: v === true })}
                    />
                    מקבל התראות
                  </label>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => setContacts((p) => [...p, emptyContact()])} className="gap-2">
            <Plus className="h-4 w-4" />
            הוסף איש קשר
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
