import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Settings2, ShieldCheck, User, Plus, Pencil, Trash2, Tag } from "lucide-react";
import {
  listOrgUsers,
  listCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  CUSTOM_ROLE_PERMISSION_KEYS,
  type CustomRole,
  type CustomRoleColor,
  type CustomRolePermissionKey,
  type CustomRolePermissions,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { AccessDenied } from "@/components/access-denied";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_BADGE, TONE_SOLID, TONE_OUTLINE_BUTTON, TONE_DOT, type Tone } from "@/lib/theme";
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

export const Route = createFileRoute("/dashboard/roles")({
  head: () => ({
    meta: [
      { title: "תפקידים — AFIK Logistics Platform" },
      { name: "description", content: "רמות ההרשאה הקיימות בארגון." },
    ],
  }),
  component: RolesPage,
});

// This app's real permission model (see the very first migration) is a
// fixed two-tier system — public.app_role is a Postgres ENUM of exactly
// "admin" | "member", not a table of arbitrary named roles. That doesn't
// change here — the two fixed roles below still control actual data
// access. Custom roles (further down the page) are an additive, softer
// layer on top: an admin can name a role, tag it with module permissions,
// and assign it to members so the sidebar shows only what's relevant to
// their job — but a custom role can never grant more access than a
// member's real admin/member level already allows.
const ROLES = [
  {
    id: "admin" as const,
    label: "מנהל",
    icon: ShieldCheck,
    description: "גישה מלאה: ניהול משתמשים, תפקידים והגדרות הארגון.",
  },
  {
    id: "member" as const,
    label: "חבר צוות",
    icon: User,
    description: "גישה שוטפת לעבודה היומיומית, ללא ניהול משתמשים או הגדרות ארגון.",
  },
];

const PERMISSION_LABEL: Record<CustomRolePermissionKey, string> = {
  commercial: "מסחרי",
  operations: "תפעול",
  shipments: "משלוחים",
  pickup_distribution: "איסוף/הפצה",
  warehouse: "מחסן",
};

const CUSTOM_ROLE_COLORS: CustomRoleColor[] = [
  "primary",
  "accent",
  "success",
  "warning",
  "destructive",
  "muted",
];

function RolesPage() {
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const listOrgUsersFn = useServerFn(listOrgUsers);
  const listCustomRolesFn = useServerFn(listCustomRoles);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: () => listOrgUsersFn(),
    enabled: isAdmin,
  });
  const {
    data: customRoles = [],
    isLoading: customRolesLoading,
    refetch: refetchCustomRoles,
  } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: () => listCustomRolesFn(),
    enabled: isAdmin,
  });

  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <PageHeader
        title="תפקידים"
        description="שתי רמות ההרשאה הקיימות במערכת, ומי מחזיק בכל אחת מהן."
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תפקיד</TableHead>
              <TableHead className="text-right">תיאור</TableHead>
              <TableHead className="text-right">חברים</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((r) => {
              const Icon = r.icon;
              const count = usersLoading ? "…" : users.filter((u) => u.role === r.id).length;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" /> {r.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                  <TableCell>{count}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/dashboard/roles/$id" params={{ id: r.id }}>
                        <Settings2 className="h-3.5 w-3.5" /> ניהול
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">תפקידים מותאמים אישית</h2>
          <p className="text-sm text-muted-foreground">
            שכבת ארגון נוספת מעל "מנהל"/"חבר צוות" — קובעת אילו מודולים מופיעים בתפריט הצד לכל חבר
            צוות. לא משנה את רמת ההרשאה האמיתית שלו.
          </p>
        </div>
        <CustomRoleFormDialog onSaved={refetchCustomRoles} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תפקיד</TableHead>
              <TableHead className="text-right">מודולים</TableHead>
              <TableHead className="text-right">חברים</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customRolesLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  טוען…
                </TableCell>
              </TableRow>
            ) : customRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  אין עדיין תפקידים מותאמים אישית.
                </TableCell>
              </TableRow>
            ) : (
              customRoles.map((role: CustomRole) => {
                const count = usersLoading
                  ? "…"
                  : users.filter((u) => u.customRoleId === role.id).length;
                const permKeys = CUSTOM_ROLE_PERMISSION_KEYS.filter(
                  (k) => role.permissions[k] === true,
                );
                return (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full",
                            TONE_BADGE[role.color as Tone],
                          )}
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{role.name}</span>
                            <span
                              className={cn("h-2 w-2 rounded-full", TONE_DOT[role.color as Tone])}
                            />
                          </div>
                          {role.description && (
                            <div className="text-xs text-muted-foreground">{role.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {permKeys.length === 0 ? (
                        <span className="text-xs text-muted-foreground">ללא מודולים</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {permKeys.map((k) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              {PERMISSION_LABEL[k]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <CustomRoleFormDialog role={role} onSaved={refetchCustomRoles} />
                        <DeleteCustomRoleButton role={role} onDeleted={refetchCustomRoles} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DeleteCustomRoleButton({ role, onDeleted }: { role: CustomRole; onDeleted: () => void }) {
  const qc = useQueryClient();
  const deleteCustomRoleFn = useServerFn(deleteCustomRole);
  const del = useMutation({
    mutationFn: () => deleteCustomRoleFn({ data: { id: role.id } }),
    onSuccess: () => {
      toast.success("התפקיד נמחק");
      onDeleted();
      qc.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  return (
    <ConfirmDialog
      title={`למחוק את התפקיד "${role.name}"?`}
      description="חברי צוות שמחזיקים בתפקיד זה יעברו למצב ללא תפקיד מותאם (יראו את כל המודולים)."
      confirmLabel="מחק תפקיד"
      destructive
      onConfirm={async () => {
        await del.mutateAsync();
      }}
      trigger={
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={del.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" /> מחק
        </Button>
      }
    />
  );
}

function CustomRoleFormDialog({ role, onSaved }: { role?: CustomRole; onSaved: () => void }) {
  const createFn = useServerFn(createCustomRole);
  const updateFn = useServerFn(updateCustomRole);
  const [open, setOpen] = useState(false);
  const isEdit = !!role;

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState<CustomRoleColor>(role?.color ?? "primary");
  const [permissions, setPermissions] = useState<CustomRolePermissions>(role?.permissions ?? {});

  function resetForm() {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setColor(role?.color ?? "primary");
    setPermissions(role?.permissions ?? {});
  }

  function togglePermission(key: CustomRolePermissionKey) {
    setPermissions((p) => ({ ...p, [key]: !p[key] }));
  }

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? updateFn({ data: { id: role.id, name, description, color, permissions } })
        : createFn({ data: { name, description, color, permissions } }),
    onSuccess: () => {
      toast.success(isEdit ? "התפקיד עודכן" : "התפקיד נוצר");
      setOpen(false);
      if (!isEdit) {
        setName("");
        setDescription("");
        setColor("primary");
        setPermissions({});
      }
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline">
            <Pencil className="h-3.5 w-3.5" /> עריכה
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" /> תפקיד חדש
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת תפקיד" : "תפקיד מותאם חדש"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>שם התפקיד</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור (לא חובה)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    color === c ? cn(TONE_SOLID[c], "shadow-sm") : TONE_OUTLINE_BUTTON[c],
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>מודולים נגישים</Label>
            <div className="flex flex-wrap gap-2">
              {CUSTOM_ROLE_PERMISSION_KEYS.map((key) => {
                const checked = permissions[key] === true;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePermission(key)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      checked ? cn(TONE_SOLID.primary, "shadow-sm") : TONE_OUTLINE_BUTTON.primary,
                    )}
                  >
                    {PERMISSION_LABEL[key]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              מודולים שלא סומנו לא יופיעו בתפריט הצד עבור חברי צוות עם תפקיד זה. "החשבון שלי" ודף
              הבית נשארים גלויים לכולם.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "שומר…" : isEdit ? "שמור שינויים" : "צור תפקיד"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
