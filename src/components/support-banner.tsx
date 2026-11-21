import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exitSupportOrganization, getSupportStatus } from "@/lib/company-requests.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

/** Shown to AFIK staff while they're working inside another organization. */
export function SupportBanner() {
  const { isPlatformAdmin } = useCurrentUser();
  const statusFn = useServerFn(getSupportStatus);
  const exitFn = useServerFn(exitSupportOrganization);
  const { data } = useQuery({
    queryKey: ["support-status"],
    queryFn: () => statusFn(),
    enabled: isPlatformAdmin,
    staleTime: 0,
  });
  const exit = useMutation({
    mutationFn: () => exitFn(),
    onSuccess: () => {
      window.location.assign("/dashboard/all-organizations");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "החזרה נכשלה"),
  });

  if (!data?.active) return null;
  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning/15 px-6 py-2.5 text-sm"
    >
      <span className="flex items-center gap-2 font-medium">
        <ShieldAlert className="h-4 w-4" />
        מצב צוות AFIK — את/ה צופה ועורך/ת בארגון: {data.organizationName ?? "לא ידוע"}
      </span>
      <Button size="sm" variant="outline" disabled={exit.isPending} onClick={() => exit.mutate()}>
        <LogOut className="h-3.5 w-3.5" /> חזרה לארגון שלי
      </Button>
    </div>
  );
}
