import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/dashboard/operations")({
  head: () => ({
    meta: [
      { title: "התראות שירות — Freight Console" },
      {
        name: "description",
        content:
          "הצעות מאושרות, תיקים חדשים, משימות באיחור ואישורים ממתינים — במקום אחד.",
      },
      { property: "og:title", content: "התראות שירות" },
      {
        property: "og:description",
        content: "מודול שירות — דאשבורד נציגים ומעקב תיקים.",
      },
    ],
  }),
  component: OperationsDashboard,
});

function OperationsDashboard() {
  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">מודול שירות</div>
          <div className="mt-1 flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">התראות שירות</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            הצעות מאושרות, תיקים חדשים, משימות באיחור ואישורים ממתינים — במקום אחד.
          </p>
        </div>
      </div>

      <Card className="p-12 text-center">
        <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <div className="text-base font-medium">אין התראות עדיין</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          התראות יופיעו כאן ברגע שייווצרו תיקים, משימות ואישורים ממתינים במערכת.
        </p>
      </Card>
    </div>
  );
}
