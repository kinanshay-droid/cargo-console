import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, type Organization } from "@/lib/api";
import { toastApiError } from "@/lib/toast-error";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AccessDenied } from "@/components/access-denied";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/dashboard/organization")({
  head: () => ({
    meta: [
      { title: "Organization — Cargo Console" },
      { name: "description", content: "Your organization's settings." },
    ],
  }),
  component: OrganizationPage,
});

function OrganizationPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading: meLoading } = useCurrentUser();
  const { data: org, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: () => apiRequest<Organization>("/organizations/me"),
  });

  const [name, setName] = useState("");
  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<Organization>("/organizations/me", {
        method: "PATCH",
        body: { name },
      }),
    onSuccess: () => {
      toast.success("Organization updated");
      qc.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (e) => toastApiError(e),
  });

  if (!meLoading && !isAdmin) return <AccessDenied />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Organization"
        description="Your organization's settings and identifiers."
      />

      {isLoading || !org ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Loading…
        </div>
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
              <Label>Organization name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={save.isPending || name === org.name}>
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Identifiers
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Organization code</dt>
                <dd className="mt-1 font-mono text-base font-semibold tracking-wider text-foreground">
                  {org.code}
                </dd>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your login identifier — not editable here.
                </p>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <Badge
                    className={
                      org.status === "ACTIVE"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {org.status}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
