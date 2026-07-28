import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/pickup-distribution")({
  head: () => ({
    meta: [
      { title: "איסוף/הפצה — AFIK Logistics Platform" },
      { name: "description", content: "ניהול פעולות איסוף והפצה." },
      { property: "og:title", content: "איסוף/הפצה — AFIK Logistics Platform" },
      { property: "og:description", content: "ניהול פעולות איסוף והפצה." },
    ],
  }),
  component: PickupDistributionPage,
});

function PickupDistributionPage() {
  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">תפעול</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">איסוף/הפצה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          עמוד לניהול פעולות איסוף והפצה. הנתונים שיוצגו כאן ייקבעו בהמשך.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <ArrowLeftRight className="h-6 w-6" />
        </span>
        <p className="text-sm">העמוד מוכן — הנתונים והשדות יתווספו כאן בהמשך.</p>
      </div>
    </div>
  );
}
