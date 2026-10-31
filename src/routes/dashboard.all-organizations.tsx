import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { listAllOrganizations } from "@/lib/company-requests.functions";
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
  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: () => listFn(),
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  טוען…
                </TableCell>
              </TableRow>
            ) : orgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
