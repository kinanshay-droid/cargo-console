import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { saveCaseChecklist } from "@/lib/operations.functions";
import {
  CHECKLIST_SECTIONS,
  emptyChecklistData,
  parseChecklistData,
  checklistProgress,
  buildCaseReferenceValues,
  type ChecklistData,
  type ChecklistItemStatus,
  type ChecklistCaseSnapshot,
} from "@/lib/packaging-checklist";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  caseId: string;
  existing: unknown;
  defaults: { shipmentNumber?: string; customer?: string; destination?: string };
  caseSnapshot?: ChecklistCaseSnapshot;
};

export function PackagingChecklistDialog({ caseId, existing, defaults, caseSnapshot }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChecklistData>(emptyChecklistData);
  const queryClient = useQueryClient();
  const saveChecklistFn = useServerFn(saveCaseChecklist);
  const caseRef = useMemo(() => buildCaseReferenceValues(caseSnapshot ?? {}), [caseSnapshot]);

  useEffect(() => {
    if (!open) return;
    const parsed = parseChecklistData(existing);
    const hasContent = parsed.savedAt != null;
    setData(
      hasContent
        ? parsed
        : {
            ...parsed,
            shipmentNumber: defaults.shipmentNumber ?? "",
            customer: defaults.customer ?? "",
            destination: defaults.destination ?? "",
            date: todayISO(),
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () => saveChecklistFn({ data: { id: caseId, checklist: data } }),
    onSuccess: () => {
      toast.success("הצ'קליסט נשמר בתיק");
      queryClient.invalidateQueries({ queryKey: ["operations-case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["operations-cases"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת הצ'קליסט נכשלה"),
  });

  function setItemStatus(key: string, status: ChecklistItemStatus) {
    setData((d) => ({
      ...d,
      items: { ...d.items, [key]: { ...d.items[key], status: d.items[key]?.status === status ? "unset" : status } },
    }));
  }
  function setItemNote(key: string, note: string) {
    setData((d) => ({ ...d, items: { ...d.items, [key]: { ...d.items[key], note } } }));
  }

  const progress = checklistProgress(data);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <ClipboardCheck className="h-4 w-4" /> צ'קליסט למשלוח
      </Button>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto text-right sm:text-right">
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>צ'קליסט הכנת מארז מבוקר טמפרטורה</DialogTitle>
          <DialogDescription>
            מלא/י את הסעיפים והערות לפי הצורך, ולחצ/י "שמור" כדי לצרף את הצ'קליסט לתיק.
            {progress.done > 0 && ` (${progress.done}/${progress.total} סעיפים סומנו)`}
          </DialogDescription>
          <Progress value={(progress.done / progress.total) * 100} className="mt-1 h-1.5" />
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">מספר משלוח</Label>
            <Input value={data.shipmentNumber} onChange={(e) => setData((d) => ({ ...d, shipmentNumber: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">לקוח</Label>
            <Input value={data.customer} onChange={(e) => setData((d) => ({ ...d, customer: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">יעד</Label>
            <Input value={data.destination} onChange={(e) => setData((d) => ({ ...d, destination: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תאריך</Label>
            <Input type="date" value={data.date} onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-5">
          {CHECKLIST_SECTIONS.map((section) => (
            <div key={section.key} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">{section.title}</div>
              <div className="divide-y">
                {section.items.map((item) => {
                  const state = data.items[item.key] ?? { status: "unset", note: "" };
                  const ref = caseRef[item.key];
                  return (
                    <div key={item.key} className="flex flex-wrap items-center gap-2 px-4 py-2">
                      <span className="min-w-[180px] flex-1 text-sm">
                        {item.label}
                        {ref && (
                          <span className="mt-0.5 block text-xs font-medium text-primary">מהתיק: {ref}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemStatus(item.key, "ok")}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md border text-success transition-colors",
                            state.status === "ok" ? "border-success bg-success/15" : "border-transparent hover:bg-muted",
                          )}
                          aria-label="תקין"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemStatus(item.key, "not_ok")}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md border text-destructive transition-colors",
                            state.status === "not_ok" ? "border-destructive bg-destructive/15" : "border-transparent hover:bg-muted",
                          )}
                          aria-label="לא תקין"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Input
                        value={state.note}
                        onChange={(e) => setItemNote(item.key, e.target.value)}
                        placeholder="הערות"
                        className="h-8 min-w-[140px] flex-[2] text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">אורז</Label>
            <Input value={data.packedBy} onChange={(e) => setData((d) => ({ ...d, packedBy: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">QA</Label>
            <Input value={data.qaBy} onChange={(e) => setData((d) => ({ ...d, qaBy: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">תאריך</Label>
            <Input type="date" value={data.signedDate} onChange={(e) => setData((d) => ({ ...d, signedDate: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          {data.savedAt && (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              נשמר לאחרונה: {new Date(data.savedAt).toLocaleString("he-IL")}
            </span>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "שומר…" : "שמור בתיק"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
