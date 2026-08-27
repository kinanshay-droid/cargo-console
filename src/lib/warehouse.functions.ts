import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Warehouse module: inventory of packaging materials (boxes, coolants, data
// loggers, etc.) and equipment used while building temperature-controlled
// shipment packages. See supabase/migrations/20260827090000_add_warehouse.sql
// — quantity_on_hand is never written directly; every change goes through a
// warehouse_movements row (append-only audit log), and a DB trigger keeps
// the running total in sync. Any org member can view/adjust stock (this is
// day-to-day operational data, not admin-gated like admin.functions.ts).

// "boxes" = the CoolGuard/BioTherm packaging models themselves (matched by
// name to a case's box type — see packaging-checklist-dialog.tsx);
// "loggers" = temperature recorder devices (Tive/Sensitech/ELPRO/etc., same
// catalog as TEMP_LOGGERS in new-quote-dialog.tsx); "packaging" covers other
// consumables (tape, absorbent, void fill...); "equipment" is anything else
// reusable.
export type WarehouseCategory = "packaging" | "equipment" | "boxes" | "loggers";

const WAREHOUSE_CATEGORIES: WarehouseCategory[] = ["packaging", "equipment", "boxes", "loggers"];

function normalizeCategory(value: string): WarehouseCategory {
  return (WAREHOUSE_CATEGORIES as string[]).includes(value)
    ? (value as WarehouseCategory)
    : "packaging";
}

export type WarehouseItem = {
  id: string;
  name: string;
  category: WarehouseCategory;
  sku: string | null;
  unit: string;
  quantityOnHand: number;
  minThreshold: number | null;
  expiryDate: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseMovement = {
  id: string;
  itemId: string;
  delta: number;
  reason: string;
  caseId: string | null;
  movementDate: string;
  createdBy: string;
  createdAt: string;
};

function toWarehouseItem(row: {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  unit: string;
  quantity_on_hand: number;
  min_threshold: number | null;
  expiry_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}): WarehouseItem {
  return {
    id: row.id,
    name: row.name,
    category: normalizeCategory(row.category),
    sku: row.sku,
    unit: row.unit,
    quantityOnHand: row.quantity_on_hand,
    minThreshold: row.min_threshold,
    expiryDate: row.expiry_date,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const listWarehouseItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("warehouse_items")
      .select(
        "id, name, category, sku, unit, quantity_on_hand, min_threshold, expiry_date, notes, active, created_at, updated_at",
      )
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toWarehouseItem);
  });

export const createWarehouseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      category: WarehouseCategory;
      sku?: string | null;
      unit?: string;
      quantityOnHand?: number;
      minThreshold?: number | null;
      expiryDate?: string | null;
      notes?: string | null;
    }) => {
      if (!input?.name?.trim()) throw new Error("name is required");
      if (!WAREHOUSE_CATEGORIES.includes(input.category)) {
        throw new Error(`category must be one of: ${WAREHOUSE_CATEGORIES.join(", ")}`);
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.organization_id) throw new Error("User has no organization");

    const { data: row, error } = await supabase
      .from("warehouse_items")
      .insert({
        organization_id: profile.organization_id,
        created_by: userId,
        name: data.name.trim(),
        category: data.category,
        sku: data.sku?.trim() || null,
        unit: data.unit?.trim() || "יח׳",
        notes: data.notes?.trim() || null,
        min_threshold: data.minThreshold ?? null,
        expiry_date: data.expiryDate || null,
      })
      .select(
        "id, name, category, sku, unit, quantity_on_hand, min_threshold, expiry_date, notes, active, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);

    // Initial stock, if given, goes through the movement log like any other
    // change so the audit trail is complete from day one.
    if (data.quantityOnHand && data.quantityOnHand !== 0) {
      const { error: moveErr } = await supabase.from("warehouse_movements").insert({
        organization_id: profile.organization_id,
        item_id: row.id,
        delta: data.quantityOnHand,
        reason: "מלאי פתיחה",
        created_by: userId,
      });
      if (moveErr) throw new Error(moveErr.message);
      row.quantity_on_hand = data.quantityOnHand;
    }

    return toWarehouseItem(row);
  });

export const updateWarehouseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      category?: WarehouseCategory;
      sku?: string | null;
      unit?: string;
      minThreshold?: number | null;
      expiryDate?: string | null;
      notes?: string | null;
    }) => {
      if (!input?.id) throw new Error("id is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.category !== undefined) patch.category = data.category;
    if (data.sku !== undefined) patch.sku = data.sku?.trim() || null;
    if (data.unit !== undefined) patch.unit = data.unit.trim() || "יח׳";
    if (data.minThreshold !== undefined) patch.min_threshold = data.minThreshold;
    if (data.expiryDate !== undefined) patch.expiry_date = data.expiryDate || null;
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;

    const { data: row, error } = await supabase
      .from("warehouse_items")
      .update(patch as never)
      .eq("id", data.id)
      .select(
        "id, name, category, sku, unit, quantity_on_hand, min_threshold, expiry_date, notes, active, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return toWarehouseItem(row);
  });

export const setWarehouseItemActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => {
    if (!input?.id) throw new Error("id is required");
    if (typeof input.active !== "boolean") throw new Error("active must be a boolean");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("warehouse_items")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Records a stock movement (positive = received, negative = consumed).
// quantity_on_hand updates via a DB trigger, not here — see the migration.
export const adjustWarehouseStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      delta: number;
      reason: string;
      caseId?: string | null;
      movementDate?: string;
    }) => {
      if (!input?.itemId) throw new Error("itemId is required");
      if (typeof input.delta !== "number" || input.delta === 0) {
        throw new Error("delta must be a non-zero number");
      }
      if (!input?.reason?.trim()) throw new Error("reason is required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: item, error: itemErr } = await supabase
      .from("warehouse_items")
      .select("id, organization_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("Item not found");

    const { error } = await supabase.from("warehouse_movements").insert({
      organization_id: item.organization_id,
      item_id: data.itemId,
      delta: data.delta,
      reason: data.reason.trim(),
      case_id: data.caseId ?? null,
      movement_date: data.movementDate || new Date().toISOString().slice(0, 10),
      created_by: userId,
    });
    if (error) throw new Error(error.message);

    const { data: updated, error: reloadErr } = await supabase
      .from("warehouse_items")
      .select(
        "id, name, category, sku, unit, quantity_on_hand, min_threshold, expiry_date, notes, active, created_at, updated_at",
      )
      .eq("id", data.itemId)
      .single();
    if (reloadErr) throw new Error(reloadErr.message);
    return toWarehouseItem(updated);
  });

export const listWarehouseMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => {
    if (!input?.itemId) throw new Error("itemId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("warehouse_movements")
      .select("id, item_id, delta, reason, case_id, movement_date, created_by, created_at")
      .eq("item_id", data.itemId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map<WarehouseMovement>((r) => ({
      id: r.id,
      itemId: r.item_id,
      delta: r.delta,
      reason: r.reason,
      caseId: r.case_id,
      movementDate: r.movement_date,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  });
