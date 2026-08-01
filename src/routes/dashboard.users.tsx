import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Plus, KeyRound, Trash2 } from "lucide-react";
import { listOrgUsers, inviteOrgUser, setUserActive, removeOrgUser, resetUserPassword, type OrgUser } from "@/lib/admin.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/users")({
  head: () => ({
    meta: [
      { title: "משתמשים — AFIK Logistics Platform" },
      { name: "description", content: "ניהול המשתמשים בארגון שלך." },
    ],
  }),
  component: UsersPage,
});

const ROLE_LABEL: Record<string, string> = { admin: "מנהל", member: "חבר צוות" };

function UsersPage() {
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;
  return <UsersPageInner />;
}

function UsersPageInner() {
  const qc = useQueryClient();
  const { user: me } = useCurrentUser();
  const listOrgUsersFn = useServerFn(listOrgUsers);
  const setUserActiveFn = useServerFn(setUserActive);
  const removeOrgUserFn = useServerFn(removeOrgUser);
  const [resetForId, setResetForId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: () => listOrgUsersFn(),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setUserActiveFn({ data: { targetUserId: id, isActive } }),
    onSuccess: () => {
      toast.success("המשתמש עודכן");
      qc.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeOrgUserFn({ data: { targetUserId: id } }),
    onSuccess: () => {
      toast.success("המשתמש הוסר");
      qc.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ההסרה נכשלה"),
  });

  return (
    <div className="mx-auto max-w-6xl" dir="rtl">
      <PageHeader
        title="משתמשים"
        description="כל מי שיש לו גישה לארגון שלך."
        action={<NewUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["org-users"] })} />}
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">מייל</TableHead>
              <TableHead className="text-right">תפקיד</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  טוען…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  אין עדיין משתמשים.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u: OrgUser) => {
                const isSelf = me?.id === u.id;
                return (
                  <Fragment key={u.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        {u.fullName || "—"}
                        {isSelf && <span className="mr-2 text-xs text-muted-foreground">(את/ה)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge className={u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                          {u.role ? ROLE_LABEL[u.role] : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={u.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                          {u.isActive ? "פעיל" : "מושבת"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">נהל את החשבון שלך בעמוד "החשבון שלי"</span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            <ConfirmDialog
                              title={u.isActive ? "להשבית משתמש?" : "להפעיל מחדש משתמש?"}
                              description={
                                u.isActive
                                  ? `${u.email} יאבד גישה עד להפעלה מחדש.`
                                  : `${u.email} יקבל בחזרה גישה לארגון.`
                              }
                              confirmLabel={u.isActive ? "השבת" : "הפעל מחדש"}
                              destructive={u.isActive}
                              onConfirm={() => toggleStatus.mutate({ id: u.id, isActive: !u.isActive })}
                              trigger={
                                <Button size="sm" variant="outline" disabled={toggleStatus.isPending}>
                                  {u.isActive ? "השבת" : "הפעל מחדש"}
                                </Button>
                              }
                            />
                            <Button size="sm" variant="outline" onClick={() => setResetForId(resetForId === u.id ? null : u.id)}>
                              <KeyRound className="h-3.5 w-3.5" /> איפוס סיסמה
                            </Button>
                            <ConfirmDialog
                              title={`להסיר את ${u.email}?`}
                              description="המשתמש יאבד גישה מיידית ולא ניתן יהיה לבטל פעולה זו."
                              confirmLabel="הסר משתמש"
                              destructive
                              onConfirm={() => remove.mutate(u.id)}
                              trigger={
                                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={remove.isPending}>
                                  <Trash2 className="h-3.5 w-3.5" /> הסר
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {resetForId === u.id && !isSelf ? (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/40">
                          <ResetPasswordInline userId={u.id} onDone={() => setResetForId(null)} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ResetPasswordInline({ userId, onDone }: { userId: string; onDone: () => void }) {
  const resetUserPasswordFn = useServerFn(resetUserPassword);
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetUserPasswordFn({ data: { targetUserId: userId, newPassword: pwd } }),
    onSuccess: () => {
      toast.success("הסיסמה אופסה");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "איפוס הסיסמה נכשל"),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pwd !== confirmPwd) return toast.error("הסיסמאות אינן תואמות");
        mutation.mutate();
      }}
    >
      <div className="space-y-1">
        <Label className="text-xs">סיסמה חדשה</Label>
        <Input type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">אימות סיסמה</Label>
        <Input type="password" required minLength={8} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
      </div>
      <Button size="sm" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "שומר…" : "אפס סיסמה"}
      </Button>
      <Button size="sm" type="button" variant="ghost" onClick={onDone}>
        ביטול
      </Button>
    </form>
  );
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const inviteOrgUserFn = useServerFn(inviteOrgUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });

  const create = useMutation({
    mutationFn: () => inviteOrgUserFn({ data: form }),
    onSuccess: () => {
      toast.success("המשתמש נוצר");
      setOpen(false);
      setForm({ fullName: "", email: "", password: "" });
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת המשתמש נכשלה"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> משתמש חדש
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>יצירת משתמש</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>שם מלא</Label>
            <Input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>מייל</Label>
            <Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>סיסמה זמנית</Label>
            <Input required type="password" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "יוצר…" : "צור משתמש"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
