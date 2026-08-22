import { useMemo, useRef, useState } from "react";
import { ClipboardList, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildCourierTaskReportHtml, type CourierTaskReportData } from "@/lib/courier-task-report";

// Button + dialog that previews the courier task report (styled like a
// waybill) and lets the user print/save it as a PDF. The same HTML string
// drives both the on-screen preview (via an iframe) and the print output
// (via iframe.contentWindow.print()), so what's shown is exactly what prints.
export function CourierTaskReportLauncher({ data }: { data: CourierTaskReportData }) {
  const [open, setOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => buildCourierTaskReportHtml(data), [data]);

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <ClipboardList className="h-4 w-4" /> דוח משימה
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto text-right sm:text-right">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>דוח משימה לבלדר</DialogTitle>
            <DialogDescription>כל הפרטים שהבלדר צריך לביצוע המשימה, בפורמט שטר מטען.</DialogDescription>
          </DialogHeader>
          <iframe ref={iframeRef} srcDoc={html} title="דוח משימה" className="h-[65vh] w-full rounded-lg border bg-white" />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="gap-2" onClick={() => iframeRef.current?.contentWindow?.print()}>
              <Printer className="h-4 w-4" /> הדפס / שמור כ-PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
