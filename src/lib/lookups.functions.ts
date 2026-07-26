import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LOOKUP_TYPES, isLookupType, lookupTableName, type LookupType } from "@/lib/lookup-types";

export type LookupItem = {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  name_en: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, string | number | boolean | null>;
};

const SELECT_COLUMNS = "id, organization_id, code, name, name_en, is_active, sort_order, metadata";

function assertLookupType(type: string): LookupType {
  if (!isLookupType(type)) {
    throw new Error(`Unknown lookup type: ${type}. Expected one of: ${LOOKUP_TYPES.join(", ")}`);
  }
  return type;
}

export type ListLookupItemsInput = {
  type: string;
  search?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
};

export const listLookupItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ListLookupItemsInput) => {
    if (!input?.type) throw new Error("type is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const type = assertLookupType(data.type);
    const table = lookupTableName(type);
    const limit = Math.max(1, Math.min(data.limit ?? 40, 200));
    const offset = Math.max(0, data.offset ?? 0);

    let query = context.supabase
      .from(table)
      .select(SELECT_COLUMNS, { count: "exact" })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (data.activeOnly !== false) query = query.eq("is_active", true);

    const term = data.search?.trim();
    if (term) {
      // Escape PostgREST pattern-matching special characters before building the ilike filter.
      const escaped = term.replace(/[%_,()]/g, (c) => `\\${c}`);
      query = query.or(`name.ilike.%${escaped}%,name_en.ilike.%${escaped}%,code.ilike.%${escaped}%`);
    }

    const { data: rows, error, count } = await query;
    if (error) throw error;
    return { items: (rows ?? []) as LookupItem[], total: count ?? 0 };
  });

export type GetLookupItemsByIdsInput = { type: string; ids: string[]; by?: "id" | "code" };

// `by: "code"` exists because most of the app's existing columns store a
// lookup's plain code (TEXT), not its UUID — they predate the lookup tables.
// This lets <Lookup matchBy="code"/> resolve/display a value without a schema
// migration on every consuming table.
export const getLookupItemsByIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GetLookupItemsByIdsInput) => {
    if (!input?.type) throw new Error("type is required");
    if (!Array.isArray(input.ids)) throw new Error("ids must be an array");
    return input;
  })
  .handler(async ({ data, context }) => {
    const type = assertLookupType(data.type);
    if (data.ids.length === 0) return [] as LookupItem[];
    const table = lookupTableName(type);
    const column = data.by === "code" ? "code" : "id";
    const { data: rows, error } = await context.supabase
      .from(table)
      .select(SELECT_COLUMNS)
      .in(column, data.ids);
    if (error) throw error;
    return (rows ?? []) as LookupItem[];
  });

export type CreateLookupItemInput = {
  type: string;
  code: string;
  name: string;
  nameEn?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

// Quick Add: inserts an org-scoped row. RLS additionally enforces that only an
// org admin can insert, and always into their own organization_id — this
// check just gives a friendlier error message before hitting the database.
export const createLookupItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateLookupItemInput) => {
    if (!input?.type) throw new Error("type is required");
    if (!input?.code?.trim()) throw new Error("code is required");
    if (!input?.name?.trim()) throw new Error("name is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const type = assertLookupType(data.type);
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) throw new Error("User has no organization");

    const table = lookupTableName(type);
    const { data: row, error } = await supabase
      .from(table)
      .insert({
        organization_id: profile.organization_id,
        code: data.code.trim(),
        name: data.name.trim(),
        name_en: data.nameEn?.trim() || null,
        metadata: data.metadata ?? {},
        created_by: userId,
      })
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return row as LookupItem;
  });
