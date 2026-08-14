import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Public entry point for external companies — a separate, much simpler
// surface from /login (which is AFIK-staff-only, email+password against an
// organization). This route only offers "sign in with Microsoft" (Azure /
// Entra ID, once configured as an OAuth provider in the Supabase
// Dashboard — see the setup notes shared alongside this feature). Whether a
// given Microsoft account actually gets in depends entirely on AFIK staff
// having invited that email from a customer's "פורטל לקוח" tab; an
// unrecognized email lands on a clear "not linked yet" state instead of the
// portal (see routes/portal.dashboard.tsx).
export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "פורטל לקוחות — AFIK Logistics Platform" },
      { name: "description", content: "כניסת לקוחות חיצוניים עם חשבון Microsoft של החברה." },
    ],
  }),
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/portal/dashboard" });
        return;
      }
      setCheckingSession(false);
    });
  }, [navigate]);

  async function onMicrosoftSignIn() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/portal/dashboard`,
          scopes: "email openid profile",
        },
      });
      if (error) throw error;
      // On success the browser navigates away to Microsoft immediately —
      // nothing left to do here. setLoading(false) below only fires if the
      // redirect itself failed to start.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההתחברות נכשלה");
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-primary">
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-primary px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 650px at 15% 0%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 60%)," +
            "radial-gradient(900px 600px at 100% 100%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 55%)," +
            "var(--primary)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <img
            src="/afik-logo-white.png"
            alt="AFIK Logistics Platform — The Intelligence Behind Every Shipment."
            className="h-auto w-56"
          />
        </div>

        <div className="rounded-2xl bg-card p-8 shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">פורטל לקוחות</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            כניסה עם חשבון Microsoft של החברה שלכם
          </p>

          <Button onClick={onMicrosoftSignIn} disabled={loading} className="mt-6 w-full gap-2" size="lg">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
            )}
            {loading ? "מעביר להתחברות…" : "התחברות עם Microsoft"}
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            הגישה לפורטל ניתנת רק לאחר הזמנה מצוות AFIK. אם החשבון שלכם לא מקושר עדיין, פנו לאיש הקשר שלכם.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-white/60">
          צוות AFIK?{" "}
          <Link to="/login" className="font-medium text-white hover:underline">
            כניסה לחשבון הפנימי
          </Link>
        </p>
      </div>
    </div>
  );
}
