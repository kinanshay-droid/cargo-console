import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
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
import {
  ShieldCheck,
  Wallet,
  CreditCard,
  Receipt,
  FileSignature,
  Umbrella,
  Activity,
  AlertTriangle,
  Upload,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


const PAYMENT_TERMS = [
  "Cash",
  "COD",
  "Net 30",
  "Net 45",
  "Net 60",
  "Net 90",
  "תשלום מראש",
  "הוראת קבע",
  "העברה בנקאית",
  "כרטיס אשראי",
];

const CURRENCIES: { code: string; nameHe: string; nameEn: string; symbol: string }[] = [
  { code: "USD", nameHe: "דולר אמריקאי", nameEn: "US Dollar", symbol: "$" },
  { code: "EUR", nameHe: "אירו", nameEn: "Euro", symbol: "€" },
  { code: "ILS", nameHe: "שקל חדש", nameEn: "Israeli New Shekel", symbol: "₪" },
  { code: "GBP", nameHe: "לירה שטרלינג", nameEn: "British Pound", symbol: "£" },
  { code: "CHF", nameHe: "פרנק שווייצרי", nameEn: "Swiss Franc", symbol: "CHF" },
  { code: "CAD", nameHe: "דולר קנדי", nameEn: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", nameHe: "דולר אוסטרלי", nameEn: "Australian Dollar", symbol: "A$" },
  { code: "NZD", nameHe: "דולר ניו זילנדי", nameEn: "New Zealand Dollar", symbol: "NZ$" },
  { code: "JPY", nameHe: "ין יפני", nameEn: "Japanese Yen", symbol: "¥" },
  { code: "CNY", nameHe: "יואן סיני", nameEn: "Chinese Yuan", symbol: "¥" },
  { code: "HKD", nameHe: "דולר הונג קונגי", nameEn: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", nameHe: "דולר סינגפורי", nameEn: "Singapore Dollar", symbol: "S$" },
  { code: "KRW", nameHe: "וון דרום קוריאני", nameEn: "South Korean Won", symbol: "₩" },
  { code: "INR", nameHe: "רופי הודי", nameEn: "Indian Rupee", symbol: "₹" },
  { code: "AED", nameHe: "דירהם איחוד האמירויות", nameEn: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", nameHe: "ריאל סעודי", nameEn: "Saudi Riyal", symbol: "﷼" },
  { code: "QAR", nameHe: "ריאל קטרי", nameEn: "Qatari Riyal", symbol: "QR" },
  { code: "BHD", nameHe: "דינר בחריני", nameEn: "Bahraini Dinar", symbol: "BD" },
  { code: "KWD", nameHe: "דינר כוויתי", nameEn: "Kuwaiti Dinar", symbol: "KD" },
  { code: "OMR", nameHe: "ריאל עומאני", nameEn: "Omani Rial", symbol: "OMR" },
  { code: "TRY", nameHe: "לירה טורקית", nameEn: "Turkish Lira", symbol: "₺" },
  { code: "SEK", nameHe: "כתר שוודי", nameEn: "Swedish Krona", symbol: "kr" },
  { code: "NOK", nameHe: "כתר נורווגי", nameEn: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", nameHe: "כתר דני", nameEn: "Danish Krone", symbol: "kr" },
  { code: "PLN", nameHe: "זלוטי פולני", nameEn: "Polish Złoty", symbol: "zł" },
  { code: "CZK", nameHe: "קורונה צ׳כית", nameEn: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", nameHe: "פורינט הונגרי", nameEn: "Hungarian Forint", symbol: "Ft" },
  { code: "RON", nameHe: "לאו רומני", nameEn: "Romanian Leu", symbol: "lei" },
  { code: "ZAR", nameHe: "ראנד דרום אפריקאי", nameEn: "South African Rand", symbol: "R" },
  { code: "MXN", nameHe: "פסו מקסיקני", nameEn: "Mexican Peso", symbol: "$" },
  { code: "BRL", nameHe: "ריאל ברזילאי", nameEn: "Brazilian Real", symbol: "R$" },
];

export type CommercialFormData = Record<string, string | number | boolean | null>;

export type CommercialHandle = {
  getData: () => CommercialFormData;
};

type Props = {
  initialData?: CommercialFormData;
};

export const CustomerCommercialTab = forwardRef<CommercialHandle, Props>(function CustomerCommercialTab(
  { initialData },
  ref,
) {
  const d = (initialData ?? {}) as CommercialFormData;
  const s = (k: string, def = "") => (typeof d[k] === "string" ? (d[k] as string) : def);
  const b = (k: string, def = false) => (typeof d[k] === "boolean" ? (d[k] as boolean) : def);

  // Credit rating & risk
  const [bdi, setBdi] = useState(s("bdi"));
  const [dnb, setDnb] = useState(s("dnb"));
  const [coface, setCoface] = useState(s("coface"));
  const [internalRating, setInternalRating] = useState<"A" | "B" | "C" | "D">(
    (s("internalRating", "B") as "A" | "B" | "C" | "D"),
  );
  const [riskScore, setRiskScore] = useState(s("riskScore"));
  const [creditCheckDate, setCreditCheckDate] = useState(s("creditCheckDate"));
  const [creditCheckValid, setCreditCheckValid] = useState(s("creditCheckValid"));
  const [creditSource, setCreditSource] = useState(s("creditSource"));

  // Credit line
  const [creditLimit, setCreditLimit] = useState(s("creditLimit"));
  const [creditUsed, setCreditUsed] = useState(s("creditUsed"));
  const [creditAvailable, setCreditAvailable] = useState(s("creditAvailable"));
  const [creditUsage, setCreditUsage] = useState(s("creditUsage"));

  const [overLimit, setOverLimit] = useState(b("overLimit"));
  const [approvalRequired, setApprovalRequired] = useState(b("approvalRequired"));

  // Payment terms (stored as comma-joined string)
  const initialPayment = typeof d.paymentTerms === "string" && d.paymentTerms.length > 0
    ? (d.paymentTerms as string).split(",")
    : ["Net 30"];
  const [paymentTerms, setPaymentTerms] = useState<string[]>(initialPayment);
  const togglePayment = (t: string) =>
    setPaymentTerms((prev) =>
      prev.includes(t) ? prev.filter((p) => p !== t) : [...prev, t]
    );

  // Collections
  const [openBalance, setOpenBalance] = useState(s("openBalance"));
  const [overdue, setOverdue] = useState(s("overdue"));
  const [openInvoices, setOpenInvoices] = useState(s("openInvoices"));
  const [lateInvoices, setLateInvoices] = useState(s("lateInvoices"));
  const [dso, setDso] = useState(s("dso"));
  const [restrictedCustomer, setRestrictedCustomer] = useState(b("restrictedCustomer"));
  const [inCollections, setInCollections] = useState(b("inCollections"));
  const [autoBlock, setAutoBlock] = useState(b("autoBlock"));

  // Commercial terms
  const [priceList, setPriceList] = useState(s("priceList"));
  const [priceListFile, setPriceListFile] = useState(s("priceListFile")); // storage path
  const [priceListName, setPriceListName] = useState(s("priceListName"));
  const [uploadingPriceList, setUploadingPriceList] = useState(false);

  const [discount, setDiscount] = useState(s("discount"));
  const [specialDiscounts, setSpecialDiscounts] = useState(s("specialDiscounts"));
  const initialCurrencies = typeof d.currency === "string" && d.currency.length > 0
    ? (d.currency as string).split(",").map((c) => c.trim()).filter(Boolean)
    : ["ILS"];
  const [currencies, setCurrencies] = useState<string[]>(initialCurrencies);
  const toggleCurrency = (c: string) =>
    setCurrencies((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const [vat, setVat] = useState(s("vat", "17"));
  const [frameworkAgreement, setFrameworkAgreement] = useState(b("frameworkAgreement"));
  const [agreementValid, setAgreementValid] = useState(s("agreementValid"));
  const [nda, setNda] = useState(b("nda"));
  const [signedContract, setSignedContract] = useState(b("signedContract"));

  // Insurance
  const [cargoInsuranceRequired, setCargoInsuranceRequired] = useState(b("cargoInsuranceRequired"));
  const [maxInsuranceValue, setMaxInsuranceValue] = useState(s("maxInsuranceValue"));
  const [insurer, setInsurer] = useState<"customer" | "company" | "">(
    (s("insurer", "") as "customer" | "company" | ""),
  );

  // Activity history
  const [firstShipment, setFirstShipment] = useState(s("firstShipment"));
  const [lastShipment, setLastShipment] = useState(s("lastShipment"));
  const [shipmentCount, setShipmentCount] = useState(s("shipmentCount"));
  const [annualRevenue, setAnnualRevenue] = useState(s("annualRevenue"));
  const [profitability, setProfitability] = useState(s("profitability"));
  const [cancellationRate, setCancellationRate] = useState(s("cancellationRate"));
  const [exceptionRate, setExceptionRate] = useState(s("exceptionRate"));
  const [slaRate, setSlaRate] = useState(s("slaRate"));

  // Risk management
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">(
    (s("riskLevel", "low") as "low" | "medium" | "high"),
  );
  const [managerApproval, setManagerApproval] = useState(b("managerApproval"));
  const [prepaymentRequired, setPrepaymentRequired] = useState(b("prepaymentRequired"));
  const [financeNotes, setFinanceNotes] = useState(s("financeNotes"));
  const [lastReview, setLastReview] = useState(s("lastReview"));
  const [nextReview, setNextReview] = useState(s("nextReview"));

  // Re-seed if incoming initialData changes (e.g. after fetch resolves)
  useEffect(() => {
    if (!initialData) return;
    const dd = initialData;
    const gs = (k: string, def = "") => (typeof dd[k] === "string" ? (dd[k] as string) : def);
    const gb = (k: string, def = false) => (typeof dd[k] === "boolean" ? (dd[k] as boolean) : def);
    setBdi(gs("bdi")); setDnb(gs("dnb")); setCoface(gs("coface"));
    setInternalRating((gs("internalRating", "B") as "A" | "B" | "C" | "D"));
    setRiskScore(gs("riskScore")); setCreditCheckDate(gs("creditCheckDate"));
    setCreditCheckValid(gs("creditCheckValid")); setCreditSource(gs("creditSource"));
    setCreditLimit(gs("creditLimit")); setCreditUsed(gs("creditUsed")); setCreditAvailable(gs("creditAvailable"));
    setCreditUsage(gs("creditUsage")); setOverLimit(gb("overLimit")); setApprovalRequired(gb("approvalRequired"));

    setPaymentTerms(typeof dd.paymentTerms === "string" && dd.paymentTerms.length > 0
      ? (dd.paymentTerms as string).split(",") : ["Net 30"]);
    setOpenBalance(gs("openBalance")); setOverdue(gs("overdue"));
    setOpenInvoices(gs("openInvoices")); setLateInvoices(gs("lateInvoices"));
    setDso(gs("dso"));
    setRestrictedCustomer(gb("restrictedCustomer")); setInCollections(gb("inCollections")); setAutoBlock(gb("autoBlock"));
    setPriceList(gs("priceList")); setPriceListFile(gs("priceListFile")); setPriceListName(gs("priceListName"));
    setDiscount(gs("discount")); setSpecialDiscounts(gs("specialDiscounts"));

    setCurrencies(typeof dd.currency === "string" && dd.currency.length > 0
      ? (dd.currency as string).split(",").map((c) => c.trim()).filter(Boolean) : ["ILS"]);
    setVat(gs("vat", "17"));
    setFrameworkAgreement(gb("frameworkAgreement")); setAgreementValid(gs("agreementValid"));
    setNda(gb("nda")); setSignedContract(gb("signedContract"));
    setCargoInsuranceRequired(gb("cargoInsuranceRequired"));
    setMaxInsuranceValue(gs("maxInsuranceValue"));
    setInsurer((gs("insurer", "") as "customer" | "company" | ""));
    setFirstShipment(gs("firstShipment")); setLastShipment(gs("lastShipment"));
    setShipmentCount(gs("shipmentCount")); setAnnualRevenue(gs("annualRevenue"));
    setProfitability(gs("profitability")); setCancellationRate(gs("cancellationRate"));
    setExceptionRate(gs("exceptionRate")); setSlaRate(gs("slaRate"));
    setRiskLevel((gs("riskLevel", "low") as "low" | "medium" | "high"));
    setManagerApproval(gb("managerApproval")); setPrepaymentRequired(gb("prepaymentRequired"));
    setFinanceNotes(gs("financeNotes")); setLastReview(gs("lastReview")); setNextReview(gs("nextReview"));
  }, [initialData]);

  // Auto-calc credit framework: creditUsed is the source of truth (editable).
  // If empty, fall back to openBalance. Derive available + usage%.
  useEffect(() => {
    const limit = parseFloat(creditLimit);
    const usedInput = parseFloat(creditUsed);
    const bal = parseFloat(openBalance);
    if (!isNaN(limit) && limit > 0) {
      const used = !isNaN(usedInput) ? usedInput : !isNaN(bal) ? bal : 0;
      const avail = Math.max(limit - used, 0);
      setCreditAvailable(avail.toFixed(2));
      setCreditUsage(((used / limit) * 100).toFixed(1));
      setOverLimit(used > limit);
    } else {
      setCreditAvailable("");
      setCreditUsage("");
    }
  }, [creditLimit, creditUsed, openBalance]);



  useImperativeHandle(ref, () => ({
    getData: (): CommercialFormData => ({
      bdi, dnb, coface, internalRating, riskScore, creditCheckDate, creditCheckValid, creditSource,
      creditLimit, creditUsed, creditAvailable, creditUsage, overLimit, approvalRequired,
      paymentTerms: paymentTerms.join(","),
      openBalance, overdue, openInvoices, lateInvoices, dso,
      restrictedCustomer, inCollections, autoBlock,
      priceList, priceListFile, priceListName, discount, specialDiscounts, currency: currencies.join(","), vat,
      frameworkAgreement, agreementValid, nda, signedContract,
      cargoInsuranceRequired, maxInsuranceValue, insurer,
      firstShipment, lastShipment, shipmentCount, annualRevenue, profitability,
      cancellationRate, exceptionRate, slaRate,
      riskLevel, managerApproval, prepaymentRequired, financeNotes, lastReview, nextReview,
    }),
  }));

  return (
    <div className="space-y-6">
      <Section icon={ShieldCheck} title="דירוג אשראי וסיכון">
        <Grid>
          <F label="דירוג BDI"><Input value={bdi} onChange={(e) => setBdi(e.target.value)} /></F>
          <F label="דירוג Dun & Bradstreet (D&B)"><Input value={dnb} onChange={(e) => setDnb(e.target.value)} /></F>
          <F label="דירוג Coface"><Input value={coface} onChange={(e) => setCoface(e.target.value)} /></F>
          <F label="דירוג פנימי">
            <Select value={internalRating} onValueChange={(v) => setInternalRating(v as typeof internalRating)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A — מצוין</SelectItem>
                <SelectItem value="B">B — טוב</SelectItem>
                <SelectItem value="C">C — בינוני</SelectItem>
                <SelectItem value="D">D — סיכון גבוה</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="ציון סיכון"><Input type="number" value={riskScore} onChange={(e) => setRiskScore(e.target.value)} /></F>
          <F label="תאריך בדיקת האשראי"><Input type="date" value={creditCheckDate} onChange={(e) => setCreditCheckDate(e.target.value)} /></F>
          <F label="תוקף הבדיקה"><Input type="date" value={creditCheckValid} onChange={(e) => setCreditCheckValid(e.target.value)} /></F>
          <F label="מקור המידע"><Input value={creditSource} onChange={(e) => setCreditSource(e.target.value)} placeholder="BDI / D&B / Coface / אחר" /></F>
        </Grid>
      </Section>

      <Section icon={Wallet} title="מסגרת אשראי">
        <Grid>
          <F label="מסגרת אשראי מאושרת">
            <Input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </F>
          <F label="ניצול מסגרת (סכום)">
            <Input
              type="number"
              value={creditUsed}
              onChange={(e) => setCreditUsed(e.target.value)}
              placeholder="הזן סכום ניצול"
            />
          </F>
          <F label="יתרת אשראי פנויה">
            <Input
              type="number"
              value={creditAvailable}
              readOnly
              className="bg-muted/50"
            />
          </F>
          <F label="ניצול אשראי (%)">
            <Input
              type="number"
              value={creditUsage}
              readOnly
              className="bg-muted/50"
            />
          </F>


        </Grid>
        <CheckRow>
          <Check checked={overLimit} onChange={setOverLimit} label="חריגה ממסגרת" />
          <Check checked={approvalRequired} onChange={setApprovalRequired} label="נדרש אישור לפני הזמנה חדשה" />
        </CheckRow>
      </Section>


      <Section icon={CreditCard} title="תנאי תשלום">
        <div className="flex flex-wrap gap-2">
          {PAYMENT_TERMS.map((t) => {
            const active = paymentTerms.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => togglePayment(t)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={Receipt} title="נתוני גבייה">
        <Grid>
          <F label="יתרת חוב"><Input type="number" value={openBalance} onChange={(e) => setOpenBalance(e.target.value)} /></F>
          <F label="סכום בפיגור"><Input type="number" value={overdue} onChange={(e) => setOverdue(e.target.value)} /></F>
          <F label="חשבוניות פתוחות"><Input type="number" value={openInvoices} onChange={(e) => setOpenInvoices(e.target.value)} /></F>
          <F label="חשבוניות באיחור"><Input type="number" value={lateInvoices} onChange={(e) => setLateInvoices(e.target.value)} /></F>
          <F label="ימים ממוצעים לתשלום (DSO)"><Input type="number" value={dso} onChange={(e) => setDso(e.target.value)} /></F>
        </Grid>
        <CheckRow>
          <Check checked={restrictedCustomer} onChange={setRestrictedCustomer} label="לקוח מוגבל" />
          <Check checked={inCollections} onChange={setInCollections} label="בהליך גבייה" />
          <Check checked={autoBlock} onChange={setAutoBlock} label="חסימת הזמנות אוטומטית בחריגה" />
        </CheckRow>
      </Section>

      <Section icon={FileSignature} title="תנאים מסחריים">
        <Grid>
          <F label="מחירון משויך"><Input value={priceList} onChange={(e) => setPriceList(e.target.value)} placeholder="שם/מזהה מחירון" /></F>
          <F label="הנחת לקוח (%)"><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></F>
          <F label="קובץ מחירון" className="md:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="price-list-upload"
                type="file"
                className="hidden"
                accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingPriceList(true);
                  try {
                    const ext = file.name.split(".").pop() ?? "bin";
                    const path = `${crypto.randomUUID()}.${ext}`;
                    const { error } = await supabase.storage
                      .from("price-lists")
                      .upload(path, file, { upsert: false });
                    if (error) throw error;
                    setPriceListFile(path);
                    setPriceListName(file.name);
                    toast.success("המחירון הועלה בהצלחה");
                  } catch (err) {
                    toast.error((err as Error).message || "העלאה נכשלה");
                  } finally {
                    setUploadingPriceList(false);
                    e.target.value = "";
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPriceList}
                onClick={() => document.getElementById("price-list-upload")?.click()}
              >
                {uploadingPriceList ? (
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="ms-2 h-4 w-4" />
                )}
                {priceListFile ? "החלף קובץ" : "העלה מחירון"}
              </Button>
              {priceListFile && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from("price-lists")
                        .createSignedUrl(priceListFile, 60 * 10);
                      if (error || !data) {
                        toast.error("לא ניתן לפתוח את הקובץ");
                        return;
                      }
                      window.open(data.signedUrl, "_blank");
                    }}
                  >
                    {priceListName || priceListFile}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await supabase.storage.from("price-lists").remove([priceListFile]);
                      setPriceListFile("");
                      setPriceListName("");
                    }}
                    aria-label="הסר"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </F>

          <F label="הנחות מיוחדות" className="md:col-span-2">
            <Textarea rows={2} value={specialDiscounts} onChange={(e) => setSpecialDiscounts(e.target.value)} />
          </F>
          <F label="מטבע לחיוב" className="md:col-span-2">
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const active = currencies.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggleCurrency(c.code)}
                    title={c.nameHe}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {c.code} {c.symbol}
                  </button>
                );
              })}
            </div>
          </F>
          <F label='מע"מ (%)'><Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} /></F>
          <F label="תוקף ההסכם"><Input type="date" value={agreementValid} onChange={(e) => setAgreementValid(e.target.value)} /></F>
        </Grid>
        <CheckRow>
          <Check checked={frameworkAgreement} onChange={setFrameworkAgreement} label="הסכם מסגרת" />
          <Check checked={nda} onChange={setNda} label="הסכם סודיות (NDA)" />
          <Check checked={signedContract} onChange={setSignedContract} label="חוזה חתום" />
        </CheckRow>
      </Section>

      <Section icon={Umbrella} title="ביטוחים ואחריות">
        <Grid>
          <F label="ערך ביטוח מקסימלי"><Input type="number" value={maxInsuranceValue} onChange={(e) => setMaxInsuranceValue(e.target.value)} /></F>
          <F label="אחריות על הביטוח">
            <Select value={insurer} onValueChange={(v) => setInsurer(v as typeof insurer)}>
              <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">באחריות הלקוח</SelectItem>
                <SelectItem value="company">באחריות החברה</SelectItem>
              </SelectContent>
            </Select>
          </F>
        </Grid>
        <CheckRow>
          <Check checked={cargoInsuranceRequired} onChange={setCargoInsuranceRequired} label="ביטוח מטען נדרש" />
        </CheckRow>
      </Section>

      <Section icon={Activity} title="היסטוריית פעילות">
        <Grid>
          <F label="תאריך משלוח ראשון"><Input type="date" value={firstShipment} onChange={(e) => setFirstShipment(e.target.value)} /></F>
          <F label="תאריך משלוח אחרון"><Input type="date" value={lastShipment} onChange={(e) => setLastShipment(e.target.value)} /></F>
          <F label="מספר משלוחים"><Input type="number" value={shipmentCount} onChange={(e) => setShipmentCount(e.target.value)} /></F>
          <F label="מחזור הכנסות שנתי"><Input type="number" value={annualRevenue} onChange={(e) => setAnnualRevenue(e.target.value)} /></F>
          <F label="רווחיות הלקוח (%)"><Input type="number" value={profitability} onChange={(e) => setProfitability(e.target.value)} /></F>
          <F label="אחוז ביטולים (%)"><Input type="number" value={cancellationRate} onChange={(e) => setCancellationRate(e.target.value)} /></F>
          <F label="אחוז חריגות (%)"><Input type="number" value={exceptionRate} onChange={(e) => setExceptionRate(e.target.value)} /></F>
          <F label="אחוז עמידה ב-SLA (%)"><Input type="number" value={slaRate} onChange={(e) => setSlaRate(e.target.value)} /></F>
        </Grid>
      </Section>

      <Section icon={AlertTriangle} title="ניהול סיכונים">
        <Grid>
          <F label="רמת סיכון">
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v as typeof riskLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">נמוכה</SelectItem>
                <SelectItem value="medium">בינונית</SelectItem>
                <SelectItem value="high">גבוהה</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="תאריך סקירת אשראי אחרונה"><Input type="date" value={lastReview} onChange={(e) => setLastReview(e.target.value)} /></F>
          <F label="תאריך סקירה הבא"><Input type="date" value={nextReview} onChange={(e) => setNextReview(e.target.value)} /></F>
          <F label="הערות מחלקת כספים" className="md:col-span-2 lg:col-span-3">
            <Textarea rows={3} value={financeNotes} onChange={(e) => setFinanceNotes(e.target.value)} />
          </F>
        </Grid>
        <CheckRow>
          <Check checked={managerApproval} onChange={setManagerApproval} label="נדרש אישור מנהל להזמנות" />
          <Check checked={prepaymentRequired} onChange={setPrepaymentRequired} label="נדרש תשלום מראש" />
        </CheckRow>
      </Section>
    </div>
  );
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function F({
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

function CheckRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">{children}</div>;
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}
