import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Pencil, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listAllOrganizations,
  listAllUsers,
  updateOrganization,
  deleteOrganization,
  type PlatformOrganization,
} from "@/lib/company-requests.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TONE_BADGE } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/all-organizations")({
  head: () => ({
    meta: [
      { title: "כל הארגונים — AFIK Logistics Platform" },
      { name: "description", content: "כל הארגונים שמחוברים לפלטפורמה." },
    ],
  }),
  component: AllOrganizationsPage,
});

function AllOrganizationsPage() {
  const { isPlatformAdmin, isLoading } = useCurrentUser();
  if (!isLoading && !isPlatformAdmin) {
    return <AccessDenied message="עמוד זה זמין רק לצוות AFIK." />;
  }
  return <AllOrganizationsInner />;
}

function AllOrganizationsInner() {
  const listFn = useServerFn(listAllOrganizations);
  const updateFn = useServerFn(updateOrganization);
  const deleteFn = useServerFn(deleteOrganization);
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: () => listFn(),
  });
  const [editing, setEditing] = useState<PlatformOrganization | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [deleting, setDeleting] = useState<PlatformOrganization | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const save = useMutation({
    mutationFn: () => updateFn({ data: { id: editing!.id, name: editName, code: editCode } }),
    onSuccess: () => {
      toast.success("הארגון עודכן");
      qc.invalidateQueries({ queryKey: ["all-organizations"] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: deleting!.id } }),
    onSuccess: () => {
      toast.success("הארגון נמחק");
      qc.invalidateQueries({ queryKey: ["all-organizations"] });
      setDeleting(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  return (
    <div className="mx-auto max-w-6xl" dir="rtl">
      <PageHeader
        title="כל הארגונים"
        description="כל החברות שמחוברות לפלטפורמה — כולל חברות שאושרו וממתינות להגדרת סיסמה."
        icon={Building2}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">ארגון</TableHead>
              <TableHead className="text-right">קוד</TableHead>
              <TableHead className="text-right">מנהלים</TableHead>
              <TableHead className="text-right">משתמשים</TableHead>
              <TableHead className="text-right">נוצר</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  טוען…
                </TableCell>
              </TableRow>
            ) : orgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  אין ארגונים.
                </TableCell>
              </TableRow>
            ) : (
              orgs.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="font-mono text-xs tracking-wider">{o.code}</TableCell>
                  <TableCell>
                    {o.admins.length === 0 ? (
                      <span className="text-xs text-muted-foreground">אין</span>
                    ) : (
                      <div className="space-y-1.5">
                        {o.admins.map((a) => (
                          <div key={a.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">{a.fullName || a.email}</span>
                            <span dir="ltr" className="text-xs text-muted-foreground">
                              {a.email}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                TONE_BADGE[a.hasSignedIn ? "success" : "warning"],
                              )}
                            >
                              {a.hasSignedIn ? "התחבר" : "ממתין להגדרת סיסמה"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{o.userCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("he-IL")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(o);
                          setEditName(o.name);
                          setEditCode(o.code);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> עריכה
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleting(o);
                          setConfirmText("");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> מחק
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AllUsersSection />
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת ארגון</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>שם הארגון</Label>
              <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>קוד ארגון</Label>
              <Input
                required
                dir="ltr"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                className="uppercase tracking-wider"
                minLength={3}
                maxLength={16}
              />
              <p className="text-xs text-muted-foreground">
                שינוי הקוד מבטל קודים ישנים שנשלחו לעובדים להצטרפות לארגון.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                ביטול
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "שומר…" : "שמירה"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>מחיקת ארגון</DialogTitle>
            <DialogDescription>
              {deleting
                ? `הפעולה תמחק לצמיתות את "${deleting.name}" ואת כל הנתונים שלו (משלוחים, תיקים, הצעות מחיר ועוד). ${
                    deleting.userCount > 0
                      ? `${deleting.userCount} המשתמשים שלו יישארו במערכת בלי ארגון. `
                      : ""
                  }אי אפשר לשחזר.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>להמשך, הקלידו את שם הארגון: {deleting?.name}</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending || confirmText.trim() !== deleting?.name}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "מוחק…" : "מחיקה לצמיתות"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AllUsersSection() {
  const listFn = useServerFn(listAllUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => listFn(),
  });
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = users
    .filter(
      (u) =>
        !needle ||
        u.fullName.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.organizationName ?? "").toLowerCase().includes(needle),
    )
    .sort((a, b) => (a.organizationName ?? "").localeCompare(b.organizationName ?? "", "he"));

  return (
    <div className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5" /> כל המשתמשים ({users.length})
        </h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם, מייל או ארגון"
            className="pr-8"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">אימייל</TableHead>
              <TableHead className="text-right">ארגון</TableHead>
              <TableHead className="text-right">תפקיד</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">נוצר</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  טוען…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  לא נמצאו משתמשים.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.fullName || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-right text-sm">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    {u.organizationName ?? (
                      <span className="text-xs text-muted-foreground">ללא ארגון</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{u.isAdmin ? "מנהל" : "משתמש"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        TONE_BADGE[u.hasSignedIn ? "success" : "warning"],
                      )}
                    >
                      {u.hasSignedIn ? "התחבר" : "ממתין להגדרת סיסמה"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("he-IL") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
