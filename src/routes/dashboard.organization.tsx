import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyOrganization, updateMyOrganization } from "@/lib/admin.functions";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">מזהים</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">קוד ארגון</dt>
                <dd className="mt-1 font-mono text-base font-semibold tracking-wider text-foreground">{org.code}</dd>
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
        </div>
      )}
    </div>
  );
}
