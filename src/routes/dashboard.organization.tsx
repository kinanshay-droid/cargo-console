import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plug, Plus, Copy, Check, Truck, RefreshCw } from "lucide-react";
import { getMyOrganization, updateMyOrganization } from "@/lib/admin.functions";
import {
  listApiPartners,
  createApiPartner,
  setApiPartnerActive,
} from "@/lib/api-partners.functions";
import {
  listCouriers,
  createCourier,
  setCourierActive,
  regenerateCourierToken,
} from "@/lib/couriers.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/organization")({
  head: () => ({
    meta: [
      { title: "הארגון שלי — AFIK Logistics Platform" },
      { name: "description", content: "הגדרות הארגון שלך." },
    ],
  }),
  component: OrganizationPage,
});

function OrganizationPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const getMyOrganizationFn = useServerFn(getMyOrganization);
  const updateMyOrganizationFn = useServerFn(updateMyOrganization);

  const { data: org, isLoading } = useQuery({
    queryKey: ["my-organization"],
    queryFn: () => getMyOrganizationFn(),
  });

  const [name, setName] = useState("");
  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  const save = useMutation({
    mutationFn: () => updateMyOrganizationFn({ data: { name } }),
    onSuccess: () => {
      toast.success("פרטי הארגון עודכנו");
      qc.invalidateQueries({ queryKey: ["my-organization"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;

  return (
    <div className="mx-auto max-w-2xl" dir="rtl">
      <PageHeader title="הארגון שלי" description="פרטי הארגון והמזהים שלו." />

      {isLoading || !org ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">טוען…</div>
      ) : (
        <div className="space-y-6">
          <form
            className="rounded-lg border bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>שם הארגון</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={save.isPending || name === org.name}>
                {save.isPending ? "שומר…" : "שמור שינויים"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              מזהים
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">קוד ארגון</dt>
                <dd className="mt-1 font-mono text-base font-semibold tracking-wider text-foreground">
                  {org.code}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  הקוד שמשתמשים חדשים משתמשים בו כדי להצטרף לארגון — לא ניתן לעריכה כאן.
                </p>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">נוצר בתאריך</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {new Date(org.createdAt).toLocaleDateString("he-IL")}
                </dd>
              </div>
            </dl>
          </div>

          <ApiPartnersSection />
          <CouriersSection />
        </div>
      )}
    </div>
  );
}

// External-partner API keys: lets an outside shipping/freight company create
// cases, push status updates, and pull case info through /api/v1/* — see
// src/lib/partner-api.server.ts. Each partner gets its own key, scoped to
// only the cases it created (api_partner_id on operations_cases).
function ApiPartnersSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApiPartners);
  const createFn = useServerFn(createApiPartner);
  const setActiveFn = useServerFn(setApiPartnerActive);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["api-partners"],
    queryFn: () => listFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim() } }),
    onSuccess: (row) => {
      setNewKey({ name: row.name, apiKey: row.apiKey });
      setName("");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["api-partners"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת השותף נכשלה"),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setActiveFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-partners"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Plug className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            חברות שילוח מחוברות ל-API
          </h2>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> חברת שילוח חדשה
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        כל חברת שילוח מקבלת מפתח API משלה, ורואה רק את התיקים שהיא עצמה יצרה.
      </p>

      <div className="mt-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען…</div>
        ) : !partners || partners.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            עדיין לא חוברו חברות שילוח חיצוניות.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם החברה</TableHead>
                <TableHead className="text-right">מפתח API</TableHead>
                <TableHead className="text-right">נוצר</TableHead>
                <TableHead className="text-right">שימוש אחרון</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">פעיל</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.apiKeyPrefix}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString("he-IL")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.lastUsedAt
                      ? new Date(p.lastUsedAt).toLocaleString("he-IL")
                      : "טרם נעשה שימוש"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }
                    >
                      {p.active ? "פעיל" : "מושבת"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.active}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: p.id, active: checked })
                      }
                      disabled={toggleActive.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create partner dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>חברת שילוח חדשה</DialogTitle>
            <DialogDescription>
              ייווצר מפתח API ייעודי לחברה זו — יוצג פעם אחת בלבד מיד לאחר היצירה.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>שם החברה</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: Unifreight"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "יוצר…" : "צור מפתח API"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-once plaintext key dialog */}
      <Dialog
        open={!!newKey}
        onOpenChange={(open) => {
          if (!open) {
            setNewKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent dir="rtl" className="text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>מפתח ה-API של {newKey?.name}</DialogTitle>
            <DialogDescription>
              זהו הרגע היחיד שבו המפתח המלא יוצג. העתיקו ושמרו אותו במקום בטוח — אם הוא אבד, יש
              ליצור חברה חדשה.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code dir="ltr" className="flex-1 break-all text-left font-mono text-sm">
              {newKey?.apiKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={async () => {
                if (!newKey) return;
                await navigator.clipboard.writeText(newKey.apiKey);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "הועתק" : "העתק"}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewKey(null)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Couriers: each courier gets a personal, no-login link
// (afiklog.com/courier/<token>) — see src/routes/courier.$token.tsx and
// src/lib/courier-portal.functions.ts. On the link they see today's
// assigned tasks, open full task details, mark pickup/delivery status, and
// upload a photo/signature as proof of delivery. Assigning a courier to a
// specific case happens on the case detail page's מעקב (CritiLog) section.
function CouriersSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCouriers);
  const createFn = useServerFn(createCourier);
  const setActiveFn = useServerFn(setCourierActive);
  const regenerateFn = useServerFn(regenerateCourierToken);

  const { data: couriers, isLoading } = useQuery({
    queryKey: ["couriers"],
    queryFn: () => listFn(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newLink, setNewLink] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function linkFor(token: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://afiklog.com";
    return `${origin}/courier/${token}`;
  }

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), phone: phone.trim() || null } }),
    onSuccess: (row) => {
      setNewLink({ name: row.name, token: row.token });
      setName("");
      setPhone("");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["couriers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת הבלדר נכשלה"),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setActiveFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couriers"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenerateFn({ data: { id } }),
    onSuccess: (res, id) => {
      const c = couriers?.find((c) => c.id === id);
      setNewLink({ name: c?.name ?? "", token: res.token });
      qc.invalidateQueries({ queryKey: ["couriers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת הקישור נכשלה"),
  });

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Truck className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            בלדרים ואפליקציית הבלדר
          </h2>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> בלדר חדש
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        כל בלדר מקבל קישור אישי (ללא צורך בהתחברות) לרשימת המשימות שלו להיום — שיגור הקישור לנייד
        הבלדר (בוואטסאפ למשל) הוא באחריותכם. שיוך תיק לבלדר נעשה בעמוד התיק, בסעיף "מעקב".
      </p>

      <div className="mt-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">טוען…</div>
        ) : !couriers || couriers.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            עדיין לא נוספו בלדרים.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right">שימוש אחרון</TableHead>
                <TableHead className="text-right">קישור אישי</TableHead>
                <TableHead className="text-right">פעיל</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">
                    {c.phone || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.lastUsedAt
                      ? new Date(c.lastUsedAt).toLocaleString("he-IL")
                      : "טרם נעשה שימוש"}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={regenerate.isPending}
                      onClick={() => regenerate.mutate(c.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> קישור חדש
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(checked) =>
                        toggleActive.mutate({ id: c.id, active: checked })
                      }
                      disabled={toggleActive.isPending}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create courier dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>בלדר חדש</DialogTitle>
            <DialogDescription>
              ייווצר קישור אישי לבלדר זה — יוצג פעם אחת בלבד מיד לאחר היצירה.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>שם הבלדר</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: יוסי כהן"
              />
            </div>
            <div className="space-y-1.5">
              <Label>טלפון (לא חובה)</Label>
              <Input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "יוצר…" : "צור קישור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-once link dialog (also reused for "regenerate") */}
      <Dialog
        open={!!newLink}
        onOpenChange={(open) => {
          if (!open) {
            setNewLink(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent dir="rtl" className="text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>הקישור האישי של {newLink?.name}</DialogTitle>
            <DialogDescription>
              זהו הרגע היחיד שבו הקישור המלא יוצג. שלחו אותו לנייד הבלדר (וואטסאפ / SMS) — אין צורך
              בהתחברות או סיסמה כדי להשתמש בו.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
            <code dir="ltr" className="flex-1 break-all text-left font-mono text-sm">
              {newLink ? linkFor(newLink.token) : ""}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={async () => {
                if (!newLink) return;
                await navigator.clipboard.writeText(linkFor(newLink.token));
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "הועתק" : "העתק"}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewLink(null)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
