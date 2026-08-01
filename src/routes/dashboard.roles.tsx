import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Settings2, ShieldCheck, User } from "lucide-react";
import { listOrgUsers } from "@/lib/admin.functions";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
// "admin" | "member", not a table of arbitrary named roles. The original
// scaffolded version of this page assumed a full custom-roles-with-
// permissions system that was never actually built in the database, so
// rather than fake one, this shows the two roles that genuinely exist and
// who holds each.
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

function RolesPage() {
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const listOrgUsersFn = useServerFn(listOrgUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["org-users"],
    queryFn: () => listOrgUsersFn(),
    enabled: isAdmin,
  });

  if (!meLoading && !isAdmin) return <AccessDenied message="עמוד זה זמין רק למנהלי הארגון." />;

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <PageHeader title="תפקידים" description="שתי רמות ההרשאה הקיימות במערכת, ומי מחזיק בכל אחת מהן." />

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
              const count = isLoading ? "…" : users.filter((u) => u.role === r.id).length;
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
    </div>
  );
}
