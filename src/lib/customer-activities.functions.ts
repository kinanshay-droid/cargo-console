import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActivityRow = {
  id: string;
  customer_id: string;
  activity_type: string;
  subject: string | null;
  notes: string | null;
  outcome: string | null;
  next_task: string | null;
  due_at: string | null;
  occurred_at: string;
  created_at: string;
};

export type CreateActivityInput = {
  customerId: string;
  activityType: string;
  subject?: string | null;
  notes?: string | null;
  outcome?: string | null;
  nextTask?: string | null;
  dueAt?: string | null;
  occurredAt?: string | null;
};

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateActivityInput) => {
    if (!input?.customerId) throw new Error("customerId is required");
    if (!input?.activityType) throw new Error("activityType is required");
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
        activity_type: data.activityType,
        subject: data.subject ?? null,
        notes: data.notes ?? null,
        outcome: data.outcome ?? null,
        next_task: data.nextTask ?? null,
        due_at: data.dueAt ?? null,
        occurred_at: data.occurredAt ?? new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const listActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_activities")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (rows ?? []) as ActivityRow[];
  });
