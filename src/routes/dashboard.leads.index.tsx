import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Sparkles, Plus, Circle, CalendarClock, Search, Loader2, ExternalLink, ListTodo, Zap, FileText, Calendar, Phone, Mail, Folder, Paperclip, Star, Bell, ClipboardList, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listLeadTasks, addLeadTask, completeLeadTask, type LeadWithTasks, type LeadTaskRow } from "@/lib/lead-tasks.functions";
import { createActivity } from "@/lib/customer-activities.functions";
import { getCommercial, saveCommercial } from "@/lib/customers.functions";
import { supabase } from "@/integrations/supabase/client";
import { customerInitials, customerPalette } from "@/lib/customers-demo";
import { TONE_GRADIENT, type Tone } from "@/lib/theme";

export const Route = createFileRoute("/dashboard/leads/")({
  head: () => ({
    meta: [
      { title: "ניהול לקוחות פוטנציאליים — AFIK Logistics Platform" },
      { name: "description", content: "מעקב אחר לידים ומשימות המשך לכל לקוח פוטנציאלי." },
      { property: "og:title", content: "ניהול לקוחות פוטנציאליים" },
      { property: "og:description", content: "מעקב אחר לידים ומשימות המשך." },
    ],
  }),
  component: LeadsManagementPage,
});

type Filter = "all" | "with_tasks" | "overdue" | "no_tasks";

function LeadsManagementPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const listFn = useServerFn(listLeadTasks);
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["lead-tasks"],
    queryFn: () => listFn(),
  });

  const now = Date.now();
  const stats = useMemo(() => {
    let openTasks = 0;
    let overdue = 0;
    let dueSoon = 0;
    let withoutTasks = 0;
    for (const l of leads) {
      if (l.openTasks.length === 0) withoutTasks++;
      for (const t of l.openTasks) {
        openTasks++;
        if (t.due_at) {
          const d = new Date(t.due_at).getTime();
          if (d < now) overdue++;
          else if (d - now < 3 * 24 * 60 * 60 * 1000) dueSoon++;
        }
      }
    }
    return { leads: leads.length, openTasks, overdue, dueSoon, withoutTasks };
  }, [leads, now]);

  const filtered = useMemo(() => {
    const term = q.trim();
    return leads.filter((l) => {
      if (term && !l.company_name.includes(term) && !(l.trade_name ?? "").includes(term) && !l.customer_code.toLowerCase().includes(term.toLowerCase())) {
        return false;
      }
      if (filter === "with_tasks" && l.openTasks.length === 0) return false;
      if (filter === "no_tasks" && l.openTasks.length > 0) return false;
      if (filter === "overdue") {
        const hasOverdue = l.openTasks.some((t) => t.due_at && new Date(t.due_at).getTime() < now);
        if (!hasOverdue) return false;
      }
      return true;
    });
  }, [leads, q, filter, now]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/commercial"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
            aria-label="חזרה"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ניהול לקוחות פוטנציאליים</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "טוען..." : `${filtered.length} לידים · ${stats.openTasks} משימות פתוחות`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="gap-2 bg-gradient-to-l from-accent to-accent/80 text-accent-foreground">
            <Link to="/dashboard/leads/new">
              <Sparkles className="h-4 w-4" />
              ליד חדש
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatTile label="לידים במערכת" value={stats.leads} tone="accent" />
        <StatTile label="משימות פתוחות" value={stats.openTasks} tone="primary" />
        <StatTile label="באיחור" value={stats.overdue} tone="destructive" />
        <StatTile label="ללא משימות" value={stats.withoutTasks} tone="warning" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם או קוד לקוח..." className="pr-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            ["all", "הכל"],
            ["with_tasks", "עם משימות"],
            ["overdue", "באיחור"],
            ["no_tasks", "ללא משימות"],
          ] as [Filter, string][]).map(([k, lbl]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                filter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="ml-2 h-4 w-4 animate-spin" /> טוען לידים...
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-2xl border bg-card p-12 text-center text-sm text-muted-foreground">
          לא נמצאו לידים תואמים.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-bl ${TONE_GRADIENT[tone]} p-4 text-white shadow-sm`}>
      <div className="text-xs opacity-90">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadWithTasks }) {
  const p = customerPalette(lead.company_name);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold ${p.bg} ${p.text}`}>
            {customerInitials(lead.company_name)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{lead.company_name}</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{lead.customer_code}</span>
              {lead.industry ? ` · ${lead.industry}` : ""}
            </div>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1">
          <Link to="/dashboard/customers/$id" params={{ id: lead.id }}>
            <ExternalLink className="h-3.5 w-3.5" />
            תיק
          </Link>
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <ListTodo className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {lead.openTasks.length} משימות פתוחות
          </span>
          {lead.doneTasksCount > 0 && (
            <span className="text-xs text-muted-foreground">· {lead.doneTasksCount} הושלמו</span>
          )}
        </div>
        <QuickActionsMenu customerId={lead.id} companyName={lead.company_name} />
      </div>

      <div className="mt-3 space-y-2">
        {lead.openTasks.length === 0 && (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            אין משימות פתוחות — הוסיפו משימת המשך
          </div>
        )}
        {lead.openTasks.slice(0, 5).map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {lead.openTasks.length > 5 && (
          <div className="text-xs text-muted-foreground">+ עוד {lead.openTasks.length - 5} משימות</div>
        )}
      </div>
    </div>
  );
}

type QuickActionKind =
  | "quote" | "meeting" | "call" | "email" | "file"
  | "docs" | "favorite" | "task" | "reminder";

function QuickActionsMenu({ customerId, companyName }: { customerId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<QuickActionKind | null>(null);
  const navigate = useNavigate();

  const actions: { kind: QuickActionKind; label: string; icon: typeof Zap; tone: string }[] = [
    { kind: "quote", label: "הצעת מחיר", icon: Plus, tone: "from-violet-500 to-fuchsia-500" },
    { kind: "meeting", label: "פגישה", icon: Calendar, tone: "from-sky-500 to-blue-500" },
    { kind: "call", label: "שיחה", icon: Phone, tone: "from-rose-500 to-pink-500" },
    { kind: "email", label: "Email", icon: Mail, tone: "from-indigo-500 to-purple-500" },
    { kind: "file", label: "תיק", icon: Folder, tone: "from-slate-500 to-slate-600" },
    { kind: "docs", label: "מסמכים", icon: Paperclip, tone: "from-emerald-500 to-teal-500" },
    { kind: "favorite", label: "מועדפים", icon: Star, tone: "from-amber-500 to-orange-500" },
    { kind: "task", label: "משימה", icon: ClipboardList, tone: "from-primary to-primary" },
    { kind: "reminder", label: "תזכורת", icon: Bell, tone: "from-yellow-500 to-amber-500" },
  ];

  const handle = (kind: QuickActionKind) => {
    setOpen(false);
    if (kind === "quote") {
      navigate({ to: "/dashboard/customers/$id", params: { id: customerId }, hash: "commercial" });
      return;
    }
    if (kind === "file") {
      navigate({ to: "/dashboard/customers/$id", params: { id: customerId } });
      return;
    }
    if (kind === "favorite") {
      toast.info("בקרוב");
      return;
    }
    // Deferred by a tick on purpose: opening the follow-up Dialog in the
    // same tick the Popover above closes is the known Radix pattern that
    // leaves document.body's pointer-events stuck at "none" afterward,
    // silently blocking every click on the page (including this same
    // button) until reload — this lets the Popover's own close/cleanup
    // finish first instead of racing it.
    setTimeout(() => setActiveKind(kind), 0);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" className="gap-1 bg-primary text-primary-foreground">
            <Zap className="h-3.5 w-3.5" />
            פעולה מהירה
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] p-3" dir="rtl">
          <div className="mb-2 text-xs text-muted-foreground">פעולות מהירות לליד</div>
          <div className="grid grid-cols-3 gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.kind}
                  onClick={() => handle(a.kind)}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-xs font-medium transition hover:shadow-md hover:border-primary/40"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-bl ${a.tone} text-white shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-foreground">{a.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {activeKind === "task" && (
        <AddTaskDialog
          customerId={customerId}
          companyName={companyName}
          open
          onOpenChange={(v) => !v && setActiveKind(null)}
        />
      )}
      {activeKind === "docs" && (
        <DocsDialog
          customerId={customerId}
          companyName={companyName}
          open
          onOpenChange={(v) => !v && setActiveKind(null)}
        />
      )}
      {activeKind && activeKind !== "task" && activeKind !== "docs" && (
        <ActivityDialog
          customerId={customerId}
          companyName={companyName}
          kind={activeKind}
          open
          onOpenChange={(v) => !v && setActiveKind(null)}
        />
      )}
    </>
  );
}

const ACTIVITY_META: Record<string, { label: string; type: string; withDue?: boolean }> = {
  meeting: { label: "פגישה", type: "meeting", withDue: true },
  call: { label: "שיחה", type: "call", withDue: true },
  email: { label: "Email", type: "email" },
  reminder: { label: "תזכורת", type: "note", withDue: true },
};

function ActivityDialog({
  customerId, companyName, kind, open, onOpenChange,
}: {
  customerId: string; companyName: string; kind: QuickActionKind;
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const meta = ACTIVITY_META[kind] ?? { label: "פעילות", type: "note" };
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const qc = useQueryClient();
  const createFn = useServerFn(createActivity);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          customerId,
          activityType: meta.type,
          subject: subject || meta.label,
          notes: notes || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          // Only "reminder" set this before, so a saved פגישה/שיחה never
          // showed up in the lead's open-tasks list (listLeadTasks only
          // surfaces activities with next_task set) even though it has a
          // real follow-up date — meta.withDue already marks exactly the
          // kinds that represent a scheduled follow-up (meeting, call,
          // reminder), so use that instead of singling out "reminder".
          nextTask: meta.withDue ? subject || meta.label : null,
        },
      }),
    onSuccess: () => {
      toast.success(`${meta.label} נשמרה`);
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["lead-tasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">{meta.label} — {companyName}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="space-y-3 pt-2"
        >
          <div className="space-y-1.5">
            <Label>נושא</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={meta.label} />
          </div>
          {meta.withDue && (
            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter className="flex-row-reverse justify-start gap-2 sm:flex-row-reverse sm:justify-start">
            <Button type="submit" disabled={mut.isPending} className="gap-2">
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              שמירה
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Documents are stored in Supabase Storage (bucket "customer-documents",
// mirroring the existing "price-lists" bucket pattern — see
// customer-commercial-tab.tsx) and the file list itself is persisted as a
// `documents` array inside customer_commercial.data, the same generic
// per-customer JSONB blob getCommercial/saveCommercial already manage.
// saveCommercial replaces the whole `data` column, so every write here
// spreads the freshly-loaded commercial data first to avoid clobbering
// unrelated fields (price list, discount, etc.) already saved there.
const DOCUMENTS_BUCKET = "customer-documents";
type DocumentRecord = { path: string; name: string; uploadedAt: string };

function DocsDialog({
  customerId, companyName, open, onOpenChange,
}: {
  customerId: string; companyName: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const getCommercialFn = useServerFn(getCommercial);
  const saveCommercialFn = useServerFn(saveCommercial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: commercial, isLoading } = useQuery({
    queryKey: ["customer-commercial", customerId],
    queryFn: () => getCommercialFn({ data: { customerId } }),
    enabled: open,
  });
  const documents: DocumentRecord[] = Array.isArray(commercial?.documents)
    ? (commercial.documents as unknown as DocumentRecord[])
    : [];

  async function persist(nextDocs: DocumentRecord[]) {
    const base = (commercial ?? {}) as Record<string, unknown>;
    await saveCommercialFn({ data: { customerId, data: { ...base, documents: nextDocs } } });
    qc.invalidateQueries({ queryKey: ["customer-commercial", customerId] });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${customerId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (error) throw error;
      await persist([...documents, { path, name: file.name, uploadedAt: new Date().toISOString() }]);
      toast.success("המסמך הועלה");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "העלאת המסמך נכשלה");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleOpen(doc: DocumentRecord) {
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.path, 60 * 10);
    if (error || !data) {
      toast.error("לא ניתן לפתוח את הקובץ");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleRemove(doc: DocumentRecord) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.path]);
    await persist(documents.filter((d) => d.path !== doc.path));
    toast.success("המסמך הוסר");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">מסמכים — {companyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            העלאת מסמך
          </Button>
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">טוען...</div>
          ) : documents.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">אין מסמכים עדיין</div>
          ) : (
            <div className="space-y-1.5">
              {documents.map((doc) => (
                <div key={doc.path} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-right hover:underline"
                    onClick={() => handleOpen(doc)}
                  >
                    {doc.name}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(doc)}
                    aria-label="הסרה"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex-row-reverse justify-start gap-2 sm:flex-row-reverse sm:justify-start">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({ task }: { task: LeadTaskRow }) {
  const qc = useQueryClient();
  const completeFn = useServerFn(completeLeadTask);
  const mut = useMutation({
    mutationFn: (done: boolean) => completeFn({ data: { activityId: task.id, done } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-tasks"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const overdue = task.due_at && new Date(task.due_at).getTime() < Date.now();
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${overdue ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"}`}>
      <button
        onClick={() => mut.mutate(true)}
        disabled={mut.isPending}
        className="mt-0.5 text-muted-foreground hover:text-success"
        aria-label="סמן כהושלם"
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{task.next_task}</div>
        {task.notes && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{task.notes}</div>}
        {task.due_at && (
          <div className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            <CalendarClock className="h-3 w-3" />
            {new Date(task.due_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}
            {overdue && " · באיחור"}
          </div>
        )}
      </div>
    </div>
  );
}

function AddTaskDialog({
  customerId,
  companyName,
  open,
  onOpenChange,
}: {
  customerId: string;
  companyName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [task, setTask] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();
  const addFn = useServerFn(addLeadTask);
  const mut = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          customerId,
          task,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("משימה נוספה");
      setTask("");
      setDueAt("");
      setNotes("");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["lead-tasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהוספת משימה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">משימה חדשה — {companyName}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!task.trim()) {
              toast.error("יש להזין תיאור משימה");
              return;
            }
            mut.mutate();
          }}
          className="space-y-3 pt-2"
        >
          <div className="space-y-1.5">
            <Label>תיאור המשימה *</Label>
            <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="לדוגמה: התקשרות לתאום פגישה" required />
          </div>
          <div className="space-y-1.5">
            <Label>תאריך יעד</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter className="flex-row-reverse justify-start gap-2 sm:flex-row-reverse sm:justify-start">
            <Button type="submit" disabled={mut.isPending} className="gap-2">
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              הוספה
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
