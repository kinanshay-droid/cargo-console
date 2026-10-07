import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCompanyRequest } from "@/lib/company-requests.functions";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/request-access")({
  head: () => ({
    meta: [
      { title: "בקשת הצטרפות — AFIK Logistics Platform" },
      { name: "description", content: "בקשו גישה למערכת עבור החברה שלכם." },
    ],
  }),
  component: RequestAccessPage,
});

function RequestAccessPage() {
  const submit = useServerFn(submitCompanyRequest);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await submit({
        data: {
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
        },
      });
      setDone(true);
    } catch {
      // Keep the error generic — don't leak backend details to an
      // unauthenticated public form.
      setLoading(false);
      toast.error("הבקשה לא נשלחה. נסו שוב בעוד רגע.");
    }
  }

  if (done) {
    return (
      <AuthLayout
        title="הבקשה נשלחה"
        subtitle="תודה! נציג מ-AFIK יצור איתכם קשר בהקדם."
        footer={
          <Link to="/login" className="font-medium text-accent hover:underline">
            חזרה למסך הכניסה
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="text-sm text-muted-foreground">
            לאחר אישור הבקשה תישלח אליכם הזמנה במייל להגדרת סיסמה והתחברות.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="בקשת הצטרפות למערכת"
      subtitle="מלאו את הפרטים ונציג מ-AFIK יחזור אליכם."
      footer={
        <>
          כבר יש לכם חשבון?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            כניסה
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>שם החברה *</Label>
          <Input
            required
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="שם החברה שלכם"
          />
        </div>
        <div className="space-y-1.5">
          <Label>שם איש קשר *</Label>
          <Input
            required
            value={form.contactName}
            onChange={(e) => set("contactName", e.target.value)}
            placeholder="שם מלא"
          />
        </div>
        <div className="space-y-1.5">
          <Label>אימייל *</Label>
          <Input
            required
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label>טלפון</Label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="050-0000000"
          />
        </div>
        <div className="space-y-1.5">
          <Label>הודעה</Label>
          <Textarea
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="פרטים נוספים (לא חובה)"
            rows={3}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "שולח…" : "שליחת בקשה"}
        </Button>
      </form>
    </AuthLayout>
  );
}
