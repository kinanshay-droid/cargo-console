import { useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createCustomer } from "@/lib/customers.functions";

type Status = "active" | "inactive" | "frozen" | "lead";

const COMPANY_TYPES = [
  "חברה בע\"מ",
  "עוסק מורשה",
  "עוסק פטור",
  "שותפות",
  "עמותה",
  "חברה ציבורית",
];

const INDUSTRIES = [
  "מזון ומשקאות",
  "טקסטיל ואופנה",
  "אלקטרוניקה",
  "רכב וחלפים",
  "בנייה",
  "כימיה ותרופות",
  "קמעונאות",
  "טכנולוגיה",
  "אחר",
];

export function NewCustomerDialog({
  trigger,
  onCreated,
  mode = "customer",
}: {
  trigger: ReactNode;
  onCreated?: (customer: { id: string; customer_code: string; company_name: string }) => void;
  mode?: "customer" | "lead";
}) {
  const isLead = mode === "lead";
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(isLead ? "lead" : "active");
  const [companyType, setCompanyType] = useState<string>("");
  const [industry, setIndustry] = useState<string>("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const createCustomerFn = useServerFn(createCustomer);
  const queryClient = useQueryClient();

  function reset() {
    setStatus(isLead ? "lead" : "active");
    setCompanyType("");
    setIndustry("");
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("קובץ גדול מדי — עד 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const companyName = String(form.get("companyName") ?? "").trim();
    if (!companyName) {
      toast.error("שם החברה חובה");
      return;
    }
    setSubmitting(true);
    try {
      const row = await createCustomerFn({
        data: {
          companyName,
          tradeName: (form.get("tradeName") as string) || null,
          companyId: (form.get("companyId") as string) || null,
          companyType: companyType || null,
          industry: industry || null,
          website: (form.get("website") as string) || null,
          logoUrl: logoPreview,
          status,
        },
      });
      toast.success(`${isLead ? "לקוח פוטנציאלי" : "לקוח"} ${row?.customer_code ?? ""} נוצר`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated?.(row as { id: string; customer_code: string; company_name: string });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "יצירת לקוח נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader className="text-right">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-right">{isLead ? "לקוח פוטנציאלי חדש" : "לקוח חדש"}</DialogTitle>
              <DialogDescription className="text-right">
                {isLead
                  ? "פרטי חברה — יישמר כליד לקוח פוטנציאלי"
                  : "פרטי חברה — מלאו את השדות ליצירת כרטיס לקוח"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="שם החברה" required>
              <Input name="companyName" required placeholder="לדוגמה: מעיין שילוח בע״מ" />
            </Field>
            <Field label="שם מסחרי">
              <Input name="tradeName" placeholder="שם המותג / השם השיווקי" />
            </Field>

            <Field label="מספר לקוח" hint="נוצר אוטומטית בשמירה">
              <Input value="נוצר בשמירה" readOnly className="bg-muted/50 font-mono text-muted-foreground" />
            </Field>
            <Field label="סטטוס" required>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">פוטנציאלי (ליד)</SelectItem>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                  <SelectItem value="frozen">בהקפאה</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="מספר ח.פ.">
              <Input
                name="companyId"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="9 ספרות"
                maxLength={9}
              />
            </Field>
            <Field label="סוג חברה">
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרו סוג" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="תחום פעילות">
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="בחרו תחום" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="אתר אינטרנט">
              <Input
                name="website"
                type="url"
                dir="ltr"
                placeholder="https://example.com"
              />
            </Field>
          </div>

          <Field label="לוגו" hint="PNG / JPG עד 2MB">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
                {logoPreview ? (
                  <img src={logoPreview} alt="לוגו" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {logoPreview ? "החלפת לוגו" : "העלאת לוגו"}
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearLogo}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    הסרה
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onLogoChange}
                />
              </div>
            </div>
          </Field>

          <DialogFooter className="flex-row-reverse justify-start gap-2 pt-2 sm:flex-row-reverse sm:justify-start">
            <Button type="submit" disabled={submitting} className="gap-2 bg-gradient-to-l from-primary to-primary/80">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLead ? "יצירת ליד" : "יצירת לקוח"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && (
          <span className="mr-1 text-xs font-normal text-muted-foreground">({hint})</span>
        )}
      </Label>
      {children}
    </div>
  );
}
