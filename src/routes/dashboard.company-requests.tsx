import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Building2, Mail, Phone } from "lucide-react";
import {
  listCompanyRequests,
  approveCompanyRequest,
  rejectCompanyRequest,
  type CompanyRequest,
} from "@/lib/company-requests.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TONE_BADGE, type Tone } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/company-requests")({
  head: () => ({
    meta: [
      { title: "בקשות הצטרפות — AFIK Logistics Platform" },
      { name: "description", content: "אישור/דחייה של בקשות חברות חדשות למערכת." },
    ],
  }),
  component: CompanyRequestsPage,
});

function CompanyRequestsPage() {
  const { isPlatformAdmin, isLoading: meLoading } = useCurrentUser();
  if (!meLoading && !isPlatformAdmin) {
    return <AccessDenied message="עמוד זה זמין רק לצוות AFIK." />;
  }
  return <CompanyRequestsPageInner />;
}

const STATUS_LABEL: Record<CompanyRequest["status"], string> = {
  pending: "ממתינה",
  approved: "אושרה",
  rejected: "נדחתה",
};
const STATUS_TONE: Record<CompanyRequest["status"], Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

function CompanyRequestsPageInner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCompanyRequests);
  const approveFn = useServerFn(approveCompanyRequest);
  const rejectFn = useServerFn(rejectCompanyRequest);
  const [rejectTarget, setRejectTarget] = useState<CompanyRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["company-requests"],
    queryFn: () => listFn(),
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("הבקשה אושרה — נשלחה הזמנה במייל");
      qc.invalidateQueries({ queryKey: ["company-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "האישור נכשל"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectFn({ data: { requestId: id, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("הבקשה נדחתה");
      qc.invalidateQueries({ queryKey: ["company-requests"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl" dir="rtl">
      <PageHeader
        title="בקשות הצטרפות"
        description="חברות שביקשו גישה למערכת — אישור יוצר עבורן ארגון ושולח הזמנה במייל."
        icon={Building2}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין בקשות עדיין.</p>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                ממתינות לאישור ({pending.length})
              </h2>
              {pending.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onApprove={() => approve.mutate(r.id)}
                  onReject={() => {
                    setRejectTarget(r);
                    setRejectReason("");
                  }}
                  busy={approve.isPending || reject.isPending}
                />
              ))}
            </section>
          )}

          {reviewed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">היסטוריה</h2>
              {reviewed.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </section>
          )}
        </div>
      )}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>דחיית בקשה</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `הבקשה של ${rejectTarget.companyName} תסומן כנדחתה.` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">סיבה (לא חובה)</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="למשל: לא מתאים לתחום הפעילות שלנו"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={reject.isPending}
            >
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reject.isPending}
              onClick={() =>
                rejectTarget && reject.mutate({ id: rejectTarget.id, reason: rejectReason })
              }
            >
              {reject.isPending ? "דוחה…" : "דחיית הבקשה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestCard({
  request,
  onApprove,
  onReject,
  busy,
}: {
  request: CompanyRequest;
  onApprove?: () => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{request.companyName}</span>
          <Badge variant="outline" className={cn(TONE_BADGE[STATUS_TONE[request.status]])}>
            {STATUS_LABEL[request.status]}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">{request.contactName}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {request.email}
          </span>
          {request.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              {request.phone}
            </span>
          )}
        </div>
        {request.message && (
          <p className="max-w-xl text-sm text-muted-foreground">{request.message}</p>
        )}
        {request.status === "rejected" && request.rejectionReason && (
          <p className="text-xs text-destructive">סיבת דחייה: {request.rejectionReason}</p>
        )}
      </div>
      {request.status === "pending" && onApprove && onReject && (
        <div className="flex shrink-0 gap-2">
          <ConfirmDialog
            title="אישור בקשה"
            description={`ייווצר ארגון בשם "${request.companyName}" ותישלח הזמנה במייל ל-${request.email}.`}
            confirmLabel="אישור"
            trigger={
              <Button type="button" size="sm" className="gap-1.5" disabled={busy}>
                <Check className="h-4 w-4" /> אישור
              </Button>
            }
            onConfirm={onApprove}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={onReject}
          >
            <X className="h-4 w-4" /> דחייה
          </Button>
        </div>
      )}
    </div>
  );
}
