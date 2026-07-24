import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeadTaskRow = {
  id: string;
  customer_id: string;
  customer_code: string;
  company_name: string;
  trade_name: string | null;
  industry: string | null;
  activity_type: string;
  subject: string | null;
  next_task: string;
  notes: string | null;
  due_at: string | null;
  occurred_at: string;
  created_at: string;
  task_done_at: string | null;
};

export type LeadWithTasks = {
  id: string;
  customer_code: string;
  company_name: string;
  trade_name: string | null;
  industry: string | null;
  website: string | null;
  status: string;
  created_at: string;
  openTasks: LeadTaskRow[];
  doneTasksCount: number;
  lastActivityAt: string | null;
};

export const listLeadTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: leads, error: leadsErr } = await supabase
      .from("customers")
      .select("id, customer_code, company_name, trade_name, industry, website, status, created_at")
      .eq("status", "lead")
      .order("created_at", { ascending: false });
    if (leadsErr) throw leadsErr;
    const leadRows = leads ?? [];
    if (leadRows.length === 0) return [] as LeadWithTasks[];

    const ids = leadRows.map((l) => l.id);
    const { data: acts, error: actsErr } = await supabase
      .from("customer_activities")
      .select("*")
      .in("customer_id", ids)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (actsErr) throw actsErr;

    const byCustomer = new Map<string, { open: LeadTaskRow[]; done: number; last: string | null }>();
    for (const a of acts ?? []) {
      const bucket = byCustomer.get(a.customer_id) ?? { open: [], done: 0, last: null };
      if (!bucket.last || (a.occurred_at && a.occurred_at > bucket.last)) bucket.last = a.occurred_at;
      if (a.next_task && !a.task_done_at) {
        bucket.open.push({
          id: a.id,
          customer_id: a.customer_id,
          customer_code: "",
          company_name: "",
          trade_name: null,
          industry: null,
          activity_type: a.activity_type,
          subject: a.subject,
          next_task: a.next_task,
          notes: a.notes,
          due_at: a.due_at,
          occurred_at: a.occurred_at,
          created_at: a.created_at,
          task_done_at: a.task_done_at,
        });
      } else if (a.next_task && a.task_done_at) {
        bucket.done += 1;
      }
      byCustomer.set(a.customer_id, bucket);
    }

    return leadRows.map<LeadWithTasks>((l) => {
      const b = byCustomer.get(l.id) ?? { open: [], done: 0, last: null };
      const enriched = b.open.map((t) => ({
        ...t,
        customer_code: l.customer_code,
        company_name: l.company_name,
        trade_name: l.trade_name,
        industry: l.industry,
      }));
      return {
        ...l,
        openTasks: enriched,
        doneTasksCount: b.done,
        lastActivityAt: b.last,
      };
    });
  });

export const addLeadTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; task: string; dueAt?: string | null; notes?: string | null }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    if (!input?.task?.trim()) throw new Error("task is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");

    const { data: row, error } = await supabase
      .from("customer_activities")
      .insert({
        customer_id: data.customerId,
        organization_id: profile.organization_id,
        created_by: userId,
        activity_type: "task",
        subject: "משימה",
        notes: data.notes ?? null,
        next_task: data.task,
        due_at: data.dueAt ?? null,
        occurred_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const completeLeadTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { activityId: string; done: boolean }) => {
    if (!input?.activityId) throw new Error("activityId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_activities")
      .update({ task_done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.activityId);
    if (error) throw error;
    return { ok: true };
  });
