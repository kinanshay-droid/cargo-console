import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plug, Plus, Copy, Check } from "lucide-react";
import { getMyOrganization, updateMyOrganization } from "@/lib/admin.functions";
import {
  listApiPartners,
  createApiPartner,
  setApiPartnerActive,
} from "@/lib/api-partners.functions";
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
