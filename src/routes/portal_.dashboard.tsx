import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, LogOut, Loader2, FileText, Truck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getPortalSession, listPortalQuotes, listPortalCases } from "@/lib/portal.functions";
import { QUOTE_STATUS_LABELS } from "@/components/quote-document";
import { CASE_PIPELINE_STATUS_META, getCaseDisplayCode } from "@/lib/operations.functions";

// Named portal_.dashboard.tsx (underscore) rather than portal.dashboard.tsx
// on purpose — TanStack Router's flat-file convention would otherwise nest
// this inside routes/portal.tsx's own component (the login page, which
// renders no <Outlet/>), the same way dashboard.shipments_.$id.tsx escapes
// nesting under dashboard.shipments.tsx. This route is a standalone
// top-level page, just like /portal and /presentation.
export const Route = createFileRoute("/portal/dashboard")({
  head: () => ({
    meta: [{ title: "פורטל לקוחות — AFIK Logistics Platform" }],
  }),
  component: PortalDashboardPage,
});

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("he-IL");
}

function PortalDashboardPage() {
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/portal" });
        return;
      }
      setHasSession(true);
      setSessionChecked(true);
    });
  }, [navigate]);

  const getPortalSessionFn = useServerFn(getPortalSession);
  const listPortalQuotesFn = useServerFn(listPortalQuotes);
  const listPortalCasesFn = useServerFn(listPortalCases);

  const {
    data: session,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery({
    queryKey: ["portal-session"],
    queryFn: () => getPortalSessionFn(),
    enabled: hasSession,
    retry: false,
  });

  const notLinked = sessionError instanceof Error && sessionError.message.includes("PORTAL_NOT_LINKED");

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["portal-quotes"],
    queryFn: () => listPortalQuotesFn(),
    enabled: !!session?.customer,
  });
  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["portal-cases"],
    queryFn: () => listPortalCasesFn(),
    enabled: !!session?.customer,
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/portal" });
  }

  if (!sessionChecked || sessionLoading) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notLinked) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">החשבון שלכם עדיין לא מקושר</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ההתחברות ל-Microsoft הצליחה, אך עדיין לא הוגדרה עבורכם גישה לפורטל. פנו לאיש הקשר שלכם ב-AFIK כדי להשלים את ההרשמה.
          </p>
          <Button variant="outline" className="mt-6 gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> התנתקות
          </Button>
        </div>
      </div>
    );
  }

  if (sessionError || !session?.customer) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-destructive">שגיאה בטעינת הפורטל</h1>
          <p className="mt-2 text-sm text-muted-foreground">נסו שוב מאוחר יותר, או פנו לצוות AFIK.</p>
          <Button variant="outline" className="mt-6 gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> התנתקות
          </Button>
        </div>
      </div>
    );
  }

  const { customer } = session;

  return (
    <div dir="rtl" className="min-h-screen bg-muted/40">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
              {customer.logo_url ? (
                <img src={customer.logo_url} alt={customer.company_name} className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="font-semibold">{customer.company_name}</div>
              <div className="text-xs text-muted-foreground">פורטל לקוחות · {session.email}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> התנתקות
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">הצעות מחיר</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מס׳ הצעה</TableHead>
                <TableHead className="text-right">מסלול</TableHead>
                <TableHead className="text-right">תאריך יציאה</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    טוען...
                  </TableCell>
                </TableRow>
              ) : quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    אין הצעות מחיר להצגה
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.quote_code}</TableCell>
                    <TableCell className="text-sm">
                      {q.origin_port ?? "—"} <span className="text-muted-foreground">→</span> {q.dest_port ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(q.depart_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{QUOTE_STATUS_LABELS[q.status] ?? q.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">משלוחים</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מס׳ תיק</TableHead>
                <TableHead className="text-right">מסלול</TableHead>
                <TableHead className="text-right">תאריך הגעה</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {casesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    טוען...
                  </TableCell>
                </TableRow>
              ) : cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    אין משלוחים להצגה
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((c) => {
                  const payload = c.payload && typeof c.payload === "object" && !Array.isArray(c.payload) ? (c.payload as Record<string, unknown>) : {};
                  const pipelineStatus = typeof payload.pipelineStatus === "string" ? payload.pipelineStatus : null;
                  const pipelineMeta = pipelineStatus ? CASE_PIPELINE_STATUS_META[pipelineStatus as keyof typeof CASE_PIPELINE_STATUS_META] : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{getCaseDisplayCode(c.payload, c.case_code)}</TableCell>
                      <TableCell className="text-sm">
                        {c.origin_port ?? "—"} <span className="text-muted-foreground">→</span> {c.dest_port ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(c.arrive_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pipelineMeta?.label ?? c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
