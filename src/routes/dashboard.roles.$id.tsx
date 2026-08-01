import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { listOrgUsers, setUserRole, type OrgUserRole } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/dashboard/roles/$id")({
  head: () => ({
    meta: [
      { title: "תפקיד — AFIK Logistics Platform" },
      { name: "description", content: "ניהול חברי התפקיד." },
    ],
  }),
  component: RoleDetailPage,
});

const ROLE_META: Record<OrgUserRole, { label: string; other: OrgUserRole; otherLabel: string }> = {
  admin: { label: "מנהל", other: "member", otherLabel: "חבר צוות" },
  member: { label: "חבר צוות", other: "admin", otherLabel: "מנהל" },
};

function isOrgUserRole(v: string): v is OrgUserRole {
  return v === "admin" || v === "member";
}

function RoleDetailPage() {
  const { id } = Route.useParams();
  const { isAdmin, isLoading: meLoading, user: me } = useCurrentUser();

  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;
  if (!isOrgUserRole(id)) return <AccessDenied message="תפקיד לא קיים." />;

  return <RoleDetailInner role={id} meId={me?.id ?? null} />;
}

function RoleDetailInner({ role, meId }: { role: OrgUserRole; meId: string | null }) {
  const qc = useQueryClient();
  const listOrgUsersFn = useServerFn(listOrgUsers);
  const setUserRoleFn = useServerFn(setUserRole);
  const meta = ROLE_META[role];

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: () => listOrgUsersFn(),
  });

  const holders = users.filter((u) => u.role === role);
  const others = users.filter((u) => u.role === meta.other);

  const move = useMutation({
    mutationFn: ({ targetUserId, toRole }: { targetUserId: string; toRole: OrgUserRole }) =>
      setUserRoleFn({ data: { targetUserId, role: toRole } }),
    onSuccess: () => {
      toast.success("התפקיד עודכן");
      qc.invalidateQueries({ queryKey: ["org-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון התפקיד נכשל"),
  });

  const [pickUser, setPickUser] = useState<string>("");

  return (
    <div className="mx-auto max-w-3xl" dir="rtl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-mr-2">
          <Link to="/dashboard/roles">
            <ArrowRight className="h-4 w-4" /> חזרה לתפקידים
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{meta.label}</h1>
        <p className="text-sm text-muted-foreground">
          העברת משתמש מ"{meta.otherLabel}" ל"{meta.label}", או להפך.
        </p>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          העברת משתמש לתפקיד זה
        </h2>
        <div className="mt-4 flex gap-2">
          <Select value={pickUser} onValueChange={setPickUser}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="בחר משתמש…" />
            </SelectTrigger>
            <SelectContent>
              {others.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">אין משתמשים בתפקיד "{meta.otherLabel}".</div>
              ) : (
                others.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName || u.email} — {u.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            disabled={!pickUser || move.isPending}
            onClick={() => {
              move.mutate({ targetUserId: pickUser, toRole: role });
              setPickUser("");
            }}
          >
            <ArrowLeftRight className="h-4 w-4" /> העבר לתפקיד
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          מחזיקים בתפקיד "{meta.label}"
        </h2>
        <div className="mt-4 overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">משתמש</TableHead>
                <TableHead className="text-right">פעולה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    טוען…
                  </TableCell>
                </TableRow>
              ) : holders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    אין עדיין חברים בתפקיד זה.
                  </TableCell>
                </TableRow>
              ) : (
                holders.map((u) => {
                  const isSelf = u.id === meId;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {u.fullName || "—"} {isSelf && <span className="text-xs text-muted-foreground">(את/ה)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={move.isPending || (isSelf && role === "admin")}
                          title={isSelf && role === "admin" ? "לא ניתן להסיר הרשאת מנהל מעצמך כאן" : undefined}
                          onClick={() => move.mutate({ targetUserId: u.id, toRole: meta.other })}
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" /> העבר ל{meta.otherLabel}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
