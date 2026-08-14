import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listPortalUsers, invitePortalUser, revokePortalAccess, type PortalUserRow } from "@/lib/portal.functions";

// Manages who at this customer can sign into /portal with their own
// Microsoft account (see supabase/migrations/20260814090000_customer_portal.sql).
// Self-contained: invite/revoke happen immediately (own mutations), unlike
// the rest of the customer detail page which batches edits behind the page's
// "שמירת שינויים" button — there's no draft state here worth losing.
const STATUS_META: Record<PortalUserRow["status"], { label: string; icon: typeof Clock; className: string }> = {
  invited: { label: "ממתין לכניסה ראשונה", icon: Clock, className: "bg-warning/15 text-warning" },
  active: { label: "פעיל", icon: CheckCircle2, className: "bg-success/15 text-success" },
  revoked: { label: "בוטל", icon: XCircle, className: "bg-muted text-muted-foreground" },
};

export function CustomerPortalTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const listPortalUsersFn = useServerFn(listPortalUsers);
  const invitePortalUserFn = useServerFn(invitePortalUser);
  const revokePortalAccessFn = useServerFn(revokePortalAccess);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["portal-users", customerId],
    queryFn: () => listPortalUsersFn({ data: { customerId } }),
  });

  async function onInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    try {
      await invitePortalUserFn({ data: { customerId, email: trimmed } });
      toast.success(`הזמנה נשלחה ל-${trimmed}`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["portal-users", customerId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת ההזמנה נכשלה");
    } finally {
      setInviting(false);
    }
  }

  async function onRevoke(user: PortalUserRow) {
    setRevokingId(user.id);
    try {
      await revokePortalAccessFn({ data: { inviteId: user.id, accessId: user.accessId } });
      toast.success(`הגישה של ${user.email} בוטלה`);
      qc.invalidateQueries({ queryKey: ["portal-users", customerId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ביטול הגישה נכשל");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold">פורטל לקוח</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        הזמינו אנשי קשר אצל הלקוח להתחבר לפורטל החיצוני (afiklog.com/portal) עם חשבון Microsoft של החברה שלהם, ולראות רק את הצעות המחיר והמשלוחים של הלקוח הזה.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="כתובת אימייל של איש הקשר"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onInvite()}
            className="pr-9"
          />
        </div>
        <Button onClick={onInvite} disabled={inviting || !email.trim()} className="gap-2">
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          הזמנה
        </Button>
      </div>

      <div className="mt-4 divide-y">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען...</div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">עדיין לא הוזמנו משתמשים לפורטל.</div>
        ) : (
          users.map((u) => {
            const meta = STATUS_META[u.status];
            const Icon = meta.icon;
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">
                    הוזמן ב-{new Date(u.invitedAt).toLocaleDateString("he-IL")}
                    {u.acceptedAt ? ` · הצטרף ב-${new Date(u.acceptedAt).toLocaleDateString("he-IL")}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={meta.className}>
                    <Icon className="ml-1 h-3 w-3" /> {meta.label}
                  </Badge>
                  {u.status !== "revoked" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(u)}
                      disabled={revokingId === u.id}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      {revokingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      ביטול גישה
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
