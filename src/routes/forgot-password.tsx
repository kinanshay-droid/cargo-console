import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "שכחתי סיסמה — AFIK Logistics Platform" },
      { name: "description", content: "בקשת קישור לאיפוס סיסמה." },
      { property: "og:title", content: "שכחתי סיסמה — AFIK Logistics Platform" },
      { property: "og:description", content: "בקשת קישור לאיפוס סיסמה." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Silent on error to avoid revealing whether the account exists.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // deliberately swallow errors
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout
      title="שכחתי סיסמה"
      subtitle="אם קיים חשבון עם המייל הזה, נשלח אליו קישור לאיפוס סיסמה."
      footer={
        <Link to="/login" className="font-medium text-accent hover:underline">
          חזרה למסך הכניסה
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-md border bg-muted/50 p-4 text-sm text-foreground">
          אם קיים חשבון עם כתובת המייל הזו, נשלח אליה קישור לאיפוס סיסמה. בדקו את תיבת הדואר ואת
          תיקיית הספאם.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>אימייל</Label>
            <Input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "שולח…" : "שליחת קישור"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
