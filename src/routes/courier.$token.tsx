import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  PenLine,
  RotateCcw,
  Snowflake,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getCourierTasks,
  getCourierTaskDetail,
  updateCourierTaskStatus,
  uploadCourierProof,
  uploadCourierFieldSignature,
  getCourierFileUrl,
  getCourierFieldSignatureUrls,
  uploadSignedDocument,
  type CourierTaskStatus,
  type CourierTaskDetail,
  type CourierTaskPoint,
} from "@/lib/courier-portal.functions";
import { SignatureFieldPlacer } from "@/components/signature-field-placer";
import { composeSignedDocument } from "@/lib/signed-document-composer";

// Public, no-login mobile page for couriers — see
// src/lib/courier-portal.functions.ts and
// supabase/migrations/20260831090000_add_couriers.sql. The token in the URL
// is the courier's entire credential; there is no Supabase Auth session
// anywhere on this page. Every data call is a plain server-function call
// that carries the token as an explicit argument and gets validated
// server-side on every single request — nothing here assumes the token was
// already checked.
export const Route = createFileRoute("/courier/$token")({
  head: () => ({
    meta: [
      { title: "המשימות שלי — AFIK Logistics Platform" },
      { name: "description", content: "אפליקציית הבלדר — משימות איסוף ומסירה להיום." },
    ],
  }),
  component: CourierPortalPage,
});

const STATUS_LABEL: Record<CourierTaskStatus, string> = {
  pending: "ממתין לאיסוף",
  picked_up: "נאסף",
  delivered: "נמסר ללקוח",
};
const STATUS_BADGE: Record<CourierTaskStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  picked_up: "bg-warning/15 text-warning",
  delivered: "bg-success/15 text-success",
};

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-muted/30 pb-10">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-primary px-4 py-3 text-white shadow-sm">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
          <Truck className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold">אפליקציית הבלדר — AFIK</div>
      </div>
      <div className="mx-auto max-w-md px-4 py-4">{children}</div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <PageShell>
      <div className="mt-10 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <X className="h-6 w-6" />
        </div>
        <div className="text-sm font-medium text-foreground">{message}</div>
        <p className="mt-2 text-xs text-muted-foreground">פנו לצוות המשרד לקבלת קישור מעודכן.</p>
      </div>
    </PageShell>
  );
}

function CourierPortalPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getTasksFn = useServerFn(getCourierTasks);
  const getDetailFn = useServerFn(getCourierTaskDetail);
  const updateStatusFn = useServerFn(updateCourierTaskStatus);
  const uploadProofFn = useServerFn(uploadCourierProof);
  const getFileUrlFn = useServerFn(getCourierFileUrl);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["courier-tasks", token],
    queryFn: () => getTasksFn({ data: { token } }),
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["courier-task-detail", token, selectedId],
    queryFn: () => getDetailFn({ data: { token, caseId: selectedId as string } }),
    enabled: !!selectedId,
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: "picked_up" | "delivered") =>
      updateStatusFn({ data: { token, caseId: selectedId as string, status } }),
    onSuccess: () => {
      toast.success("הסטטוס עודכן");
      qc.invalidateQueries({ queryKey: ["courier-tasks", token] });
      qc.invalidateQueries({ queryKey: ["courier-task-detail", token, selectedId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const uploadMutation = useMutation({
    mutationFn: (vars: { kind: "photo" | "signature"; dataUrl: string }) =>
      uploadProofFn({ data: { token, caseId: selectedId as string, ...vars } }),
    onSuccess: () => {
      toast.success("האישור הועלה בהצלחה");
      qc.invalidateQueries({ queryKey: ["courier-task-detail", token, selectedId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה"),
  });

  const viewFileMutation = useMutation({
    mutationFn: (kind: "document" | "report" | "signed-document") =>
      getFileUrlFn({ data: { token, caseId: selectedId as string, kind } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "לא ניתן לפתוח את הקובץ"),
  });

  const hasFields =
    !!detailQuery.data?.hasDocument && (detailQuery.data?.signatureFields.length ?? 0) > 0;
  const documentUrlQuery = useQuery({
    queryKey: ["courier-document-url", token, selectedId],
    queryFn: () =>
      getFileUrlFn({ data: { token, caseId: selectedId as string, kind: "document" } }),
    enabled: !!selectedId && hasFields,
    staleTime: 5 * 60 * 1000,
  });

  const uploadFieldSignatureFn = useServerFn(uploadCourierFieldSignature);
  const fieldSignatureMutation = useMutation({
    mutationFn: (vars: { fieldId: string; dataUrl: string }) =>
      uploadFieldSignatureFn({ data: { token, caseId: selectedId as string, ...vars } }),
    onSuccess: () => {
      toast.success("החתימה נשמרה");
      qc.invalidateQueries({ queryKey: ["courier-task-detail", token, selectedId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת החתימה נכשלה"),
  });

  // Once every marked field is signed, flatten the signatures onto the
  // actual document (image via canvas, PDF via pdf-lib — see
  // src/lib/signed-document-composer.ts) and upload the result, so staff
  // and the courier both get one finished, signed file instead of a blank
  // document plus separate signature snapshots.
  const getFieldSignatureUrlsFn = useServerFn(getCourierFieldSignatureUrls);
  const uploadSignedDocumentFn = useServerFn(uploadSignedDocument);
  const generateSignedDocMutation = useMutation({
    mutationFn: async () => {
      const doc = documentUrlQuery.data;
      if (!doc) throw new Error("המסמך לא נטען");
      const { fields } = await getFieldSignatureUrlsFn({
        data: { token, caseId: selectedId as string },
      });
      const dataUrl = await composeSignedDocument(
        doc.url,
        detailQuery.data?.documentIsPdf ?? false,
        fields,
      );
      await uploadSignedDocumentFn({ data: { token, caseId: selectedId as string, dataUrl } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courier-task-detail", token, selectedId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "יצירת המסמך החתום נכשלה, אפשר לנסות שוב"),
  });

  const allFieldsSignedNoDoc =
    !!detailQuery.data &&
    detailQuery.data.signatureFields.length > 0 &&
    detailQuery.data.signedFieldIds.length === detailQuery.data.signatureFields.length &&
    !detailQuery.data.hasSignedDocument;

  useEffect(() => {
    if (allFieldsSignedNoDoc && !generateSignedDocMutation.isPending) {
      generateSignedDocMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFieldsSignedNoDoc]);

  if (tasksQuery.isError) {
    return (
      <ErrorScreen
        message={tasksQuery.error instanceof Error ? tasksQuery.error.message : "קישור לא תקין"}
      />
    );
  }

  if (selectedId) {
    if (detailQuery.isError) {
      return (
        <ErrorScreen
          message={
            detailQuery.error instanceof Error ? detailQuery.error.message : "המשימה לא נמצאה"
          }
        />
      );
    }
    return (
      <PageShell>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="mb-3 flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <ArrowRight className="h-4 w-4" /> חזרה לרשימת המשימות
        </button>

        {detailQuery.isLoading || !detailQuery.data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TaskDetailCard
            detail={detailQuery.data}
            onMarkPickedUp={() => statusMutation.mutate("picked_up")}
            onMarkDelivered={() => statusMutation.mutate("delivered")}
            statusPending={statusMutation.isPending}
            onUploadPhoto={(dataUrl) => uploadMutation.mutate({ kind: "photo", dataUrl })}
            onUploadSignature={(dataUrl) => uploadMutation.mutate({ kind: "signature", dataUrl })}
            uploadPending={uploadMutation.isPending}
            onViewDocument={() => viewFileMutation.mutate("document")}
            onViewReport={() => viewFileMutation.mutate("report")}
            onViewSignedDocument={() => viewFileMutation.mutate("signed-document")}
            viewFilePending={viewFileMutation.isPending}
            documentUrl={documentUrlQuery.data?.url ?? null}
            documentUrlLoading={documentUrlQuery.isLoading}
            onSignField={(fieldId, dataUrl) => fieldSignatureMutation.mutate({ fieldId, dataUrl })}
            fieldSignaturePending={fieldSignatureMutation.isPending}
            generatingSignedDocument={generateSignedDocMutation.isPending}
          />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">שלום,</div>
            <div className="text-lg font-bold text-foreground">{tasksQuery.data?.courierName}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {tasksQuery.data?.tasks.length ?? 0} משימות מוצגות
            </div>
          </div>

          {!tasksQuery.data?.tasks.length ? (
            <div className="rounded-2xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">
              אין משימות מתוזמנות כרגע
            </div>
          ) : (
            <div className="space-y-3">
              {tasksQuery.data.tasks.map((t) => (
                <button
                  key={t.caseId}
                  type="button"
                  onClick={() => setSelectedId(t.caseId)}
                  className="block w-full rounded-2xl border bg-card p-4 text-right shadow-sm active:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">{t.customerName}</div>
                    <Badge className={STATUS_BADGE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {t.kindLabel && <span>{t.kindLabel}</span>}
                    {t.route && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {t.route}
                      </span>
                    )}
                    {t.pickupIsrael && (
                      <span>{new Date(t.pickupIsrael).toLocaleString("he-IL")}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

function PointsBlock({ title, points }: { title: string; points: CourierTaskPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-1.5 space-y-2">
        {points.map((p, i) => (
          <div key={i} className="rounded-lg border bg-muted/20 p-3">
            {p.label && <div className="mb-1 text-xs font-medium text-primary">{p.label}</div>}
            <div className="flex items-start gap-1.5 text-sm text-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {p.address || "—"}
            </div>
            {p.contacts.map((c, ci) => (
              <a
                key={ci}
                href={c.phone ? `tel:${c.phone}` : undefined}
                className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {c.name || "—"}
                {c.phone ? ` · ${c.phone}` : ""}
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskDetailCard({
  detail,
  onMarkPickedUp,
  onMarkDelivered,
  statusPending,
  onUploadPhoto,
  onUploadSignature,
  uploadPending,
  onViewDocument,
  onViewReport,
  onViewSignedDocument,
  viewFilePending,
  documentUrl,
  documentUrlLoading,
  onSignField,
  fieldSignaturePending,
  generatingSignedDocument,
}: {
  detail: CourierTaskDetail;
  onMarkPickedUp: () => void;
  onMarkDelivered: () => void;
  statusPending: boolean;
  onUploadPhoto: (dataUrl: string) => void;
  onUploadSignature: (dataUrl: string) => void;
  uploadPending: boolean;
  onViewDocument: () => void;
  onViewReport: () => void;
  onViewSignedDocument: () => void;
  viewFilePending: boolean;
  documentUrl: string | null;
  documentUrlLoading: boolean;
  onSignField: (fieldId: string, dataUrl: string) => void;
  fieldSignaturePending: boolean;
  generatingSignedDocument: boolean;
}) {
  const hasFields = detail.signatureFields.length > 0;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-bold text-foreground">{detail.customerName}</div>
          <Badge className={STATUS_BADGE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {detail.code} {detail.kindLabel ? `· ${detail.kindLabel}` : ""}
        </div>
        {detail.pickupIsrael && (
          <div className="mt-2 text-sm text-foreground">
            מועד: {new Date(detail.pickupIsrael).toLocaleString("he-IL")}
          </div>
        )}
      </div>

      {(detail.hasDocument || detail.hasReport) && (
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {detail.hasReport && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={viewFilePending}
                onClick={onViewReport}
              >
                <FileText className="h-4 w-4" /> דוח משימה מלא
              </Button>
            )}
            {detail.hasDocument && !hasFields && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={viewFilePending}
                onClick={onViewDocument}
              >
                <FileText className="h-4 w-4" /> {detail.documentName || "מסמך לחתימה"}
              </Button>
            )}
          </div>
          {detail.hasDocument && hasFields && (
            <SignatureFieldsPanel
              documentUrl={documentUrl}
              documentUrlLoading={documentUrlLoading}
              documentIsPdf={detail.documentIsPdf}
              fields={detail.signatureFields}
              signedFieldIds={detail.signedFieldIds}
              onSignField={onSignField}
              signPending={fieldSignaturePending}
            />
          )}
          {detail.hasDocument && hasFields && detail.hasSignedDocument && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={viewFilePending}
              onClick={onViewSignedDocument}
            >
              <FileText className="h-4 w-4" /> צפייה במסמך החתום
            </Button>
          )}
          {detail.hasDocument &&
            hasFields &&
            !detail.hasSignedDocument &&
            detail.signedFieldIds.length === detail.signatureFields.length &&
            generatingSignedDocument && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> מרכיב מסמך חתום…
              </div>
            )}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <PointsBlock title="איסוף" points={detail.pickupPoints} />
        <PointsBlock title="מסירה" points={detail.deliveryPoints} />
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 shadow-sm text-sm">
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Snowflake className="h-3 w-3" /> טמפרטורה
          </div>
          <div className="mt-0.5 font-medium text-foreground">{detail.tempRangeLabel}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">קרח יבש</div>
          <div className="mt-0.5 font-medium text-foreground">{detail.dryIceLabel}</div>
        </div>
        {detail.blNumber && (
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">שטר מטען / מספר</div>
            <div className="mt-0.5 font-mono font-medium text-foreground">{detail.blNumber}</div>
          </div>
        )}
        {detail.specialInstructions && (
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">הוראות מיוחדות</div>
            <div className="mt-0.5 text-foreground">{detail.specialInstructions}</div>
          </div>
        )}
        {detail.notes && (
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground">הערות</div>
            <div className="mt-0.5 text-foreground">{detail.notes}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          size="lg"
          disabled={statusPending || detail.status !== "pending"}
          onClick={onMarkPickedUp}
          className="gap-2"
        >
          <PackageCheck className="h-4 w-4" /> סימון כנאסף
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={statusPending || detail.status === "delivered"}
          onClick={onMarkDelivered}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" /> סימון כנמסר
        </Button>
      </div>

      <ProofSection
        hasProofPhoto={detail.hasProofPhoto}
        hasProofSignature={detail.hasProofSignature}
        onUploadPhoto={onUploadPhoto}
        onUploadSignature={onUploadSignature}
        uploadPending={uploadPending}
      />
    </div>
  );
}

function SignatureFieldsPanel({
  documentUrl,
  documentUrlLoading,
  documentIsPdf,
  fields,
  signedFieldIds,
  onSignField,
  signPending,
}: {
  documentUrl: string | null;
  documentUrlLoading: boolean;
  documentIsPdf: boolean;
  fields: CourierTaskDetail["signatureFields"];
  signedFieldIds: string[];
  onSignField: (fieldId: string, dataUrl: string) => void;
  signPending: boolean;
}) {
  const [signingField, setSigningField] = useState<{ id: string; label: string } | null>(null);
  // Signing must follow the order the fields were defined in on the
  // document — only the next unsigned field (in array order) is tappable;
  // every other unsigned pin shows locked. The server enforces the same
  // rule independently.
  const nextField = fields.find((f) => !signedFieldIds.includes(f.id)) ?? null;
  const remaining = fields.filter((f) => !signedFieldIds.includes(f.id)).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
          מסמך לחתימה
        </span>
        <span className={remaining > 0 ? "text-warning" : "text-success"}>
          {nextField ? `הבא לחתימה: ${nextField.label}` : "כל החתימות הושלמו"}
        </span>
      </div>
      {documentUrlLoading || !documentUrl ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SignatureFieldPlacer
          fileUrl={documentUrl}
          isPdf={documentIsPdf}
          fields={fields}
          signedFieldIds={signedFieldIds}
          activeFieldId={nextField?.id ?? null}
          onFieldTap={(f) => setSigningField({ id: f.id, label: f.label })}
        />
      )}
      {signingField && (
        <div className="mt-3">
          <div className="mb-1.5 text-sm font-medium text-foreground">
            חתימה: {signingField.label}
          </div>
          <SignaturePad
            onCancel={() => setSigningField(null)}
            onSave={(dataUrl) => {
              onSignField(signingField.id, dataUrl);
              setSigningField(null);
            }}
          />
        </div>
      )}
      {signPending && <div className="mt-2 text-xs text-muted-foreground">שומר חתימה…</div>}
    </div>
  );
}

function ProofSection({
  hasProofPhoto,
  hasProofSignature,
  onUploadPhoto,
  onUploadSignature,
  uploadPending,
}: {
  hasProofPhoto: boolean;
  hasProofSignature: boolean;
  onUploadPhoto: (dataUrl: string) => void;
  onUploadSignature: (dataUrl: string) => void;
  uploadPending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onUploadPhoto(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        אישור מסירה
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={uploadPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> {hasProofPhoto ? "עדכון תמונה" : "צילום תמונה"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={uploadPending}
          onClick={() => setSignatureOpen(true)}
        >
          <PenLine className="h-4 w-4" /> {hasProofSignature ? "עדכון חתימה" : "חתימה"}
        </Button>
      </div>
      {hasProofPhoto && <div className="text-xs text-success">✓ תמונה הועלתה</div>}
      {hasProofSignature && <div className="text-xs text-success">✓ חתימה הועלתה</div>}

      {signatureOpen && (
        <SignaturePad
          onCancel={() => setSignatureOpen(false)}
          onSave={(dataUrl) => {
            onUploadSignature(dataUrl);
            setSignatureOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
  }

  function onPointerUp() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) {
      toast.error("יש לחתום לפני השמירה");
      return;
    }
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="rounded-lg border bg-white p-2">
      <canvas
        ref={canvasRef}
        width={320}
        height={160}
        className="w-full touch-none rounded-md border border-dashed bg-white"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={clear}>
          <RotateCcw className="h-3.5 w-3.5" /> נקה
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            ביטול
          </Button>
          <Button type="button" size="sm" onClick={save}>
            שמירת חתימה
          </Button>
        </div>
      </div>
    </div>
  );
}
