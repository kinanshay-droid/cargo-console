import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CustomerStatus = "active" | "inactive" | "frozen" | "lead";

export type CreateCustomerInput = {
  companyName: string;
  tradeName?: string | null;
  companyId?: string | null;
  companyType?: string | null;
  industry?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  status?: CustomerStatus;
};

function generateCustomerCode() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `C-${year}-${rand}`;
}

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateCustomerInput) => {
    if (!input?.companyName || typeof input.companyName !== "string") {
      throw new Error("companyName is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.organization_id) throw new Error("User has no organization");

    // Retry a few times in case of unique-code collision
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCustomerCode();
      const { data: row, error } = await supabase
        .from("customers")
        .insert({
          organization_id: profile.organization_id,
          created_by: userId,
          customer_code: code,
          company_name: data.companyName,
          trade_name: data.tradeName ?? null,
          company_id: data.companyId ?? null,
          company_type: data.companyType ?? null,
          industry: data.industry ?? null,
          website: data.website ?? null,
          logo_url: data.logoUrl ?? null,
          status: data.status ?? "active",
        })
        .select("id, customer_code, company_name, status, created_at")
        .single();
      if (!error) return row;
      lastError = error;
      // 23505 = unique_violation; retry
      if ((error as { code?: string }).code !== "23505") throw error;
    }
    throw lastError ?? new Error("Failed to create customer");
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("customers")
      .select(
        "id, customer_code, company_name, trade_name, company_id, company_type, industry, website, logo_url, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export type UpdateCustomerInput = {
  id: string;
  companyName?: string;
  tradeName?: string | null;
  companyId?: string | null;
  companyType?: string | null;
  industry?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  status?: CustomerStatus;
  sector?: string | null;
  accountManager?: string | null;
  salesRep?: string | null;
  serviceRep?: string | null;
  opsManager?: string | null;
  financeManager?: string | null;
};

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateCustomerInput) => {
    if (!input?.id) throw new Error("id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.companyName !== undefined) patch.company_name = data.companyName;
    if (data.tradeName !== undefined) patch.trade_name = data.tradeName;
    if (data.companyId !== undefined) patch.company_id = data.companyId;
    if (data.companyType !== undefined) patch.company_type = data.companyType;
    if (data.industry !== undefined) patch.industry = data.industry;
    if (data.website !== undefined) patch.website = data.website;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.status !== undefined) patch.status = data.status;
    if (data.sector !== undefined) patch.sector = data.sector;
    if (data.accountManager !== undefined) patch.account_manager = data.accountManager;
    if (data.salesRep !== undefined) patch.sales_rep = data.salesRep;
    if (data.serviceRep !== undefined) patch.service_rep = data.serviceRep;
    if (data.opsManager !== undefined) patch.ops_manager = data.opsManager;
    if (data.financeManager !== undefined) patch.finance_manager = data.financeManager;

    const { data: row, error } = await (context.supabase.from("customers") as unknown as {
      update: (p: unknown) => { eq: (c: string, v: string) => { select: (s: string) => { maybeSingle: () => Promise<{ data: CustomerRow | null; error: unknown }> } } };
    })
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw error as Error;
    return row;
  });

export type CustomerRow = {
  id: string;
  organization_id: string;
  customer_code: string;
  company_name: string;
  trade_name: string | null;
  company_id: string | null;
  company_type: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  status: string;
  sector: string | null;
  account_manager: string | null;
  sales_rep: string | null;
  service_rep: string | null;
  ops_manager: string | null;
  finance_manager: string | null;
  created_at: string;
  updated_at: string;
};

export type AddressRow = {
  id: string;
  customer_id: string;
  site_name: string | null;
  type: string | null;
  country: string | null;
  city: string | null;
  street: string | null;
  postal: string | null;
  floor: string | null;
  room: string | null;
  gps: string | null;
  hours: string | null;
  notes: string | null;
  sort_order: number;
};

export type ContactRow = {
  id: string;
  customer_id: string;
  full_name: string | null;
  role: string | null;
  department: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  whatsapp: string | null;
  language: string | null;
  availability: string | null;
  is_primary: boolean;
  notifications: boolean;
  sort_order: number;
};

export type CommercialData = Record<string, string | number | boolean | null>;

export type AddressInput = {
  id?: string;
  siteName?: string | null;
  type?: string | null;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postal?: string | null;
  floor?: string | null;
  room?: string | null;
  gps?: string | null;
  hours?: string | null;
  notes?: string | null;
};

export type ContactInput = {
  id?: string;
  fullName?: string | null;
  role?: string | null;
  department?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  language?: string | null;
  availability?: string | null;
  isPrimary?: boolean;
  notifications?: boolean;
};

export const listAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const saveAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; addresses: AddressInput[] }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    if (!Array.isArray(input.addresses)) throw new Error("addresses must be an array");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");

    const keepIds = data.addresses.map((a) => a.id).filter(Boolean) as string[];
    let delQ = supabase.from("customer_addresses").delete().eq("customer_id", data.customerId);
    if (keepIds.length > 0) delQ = delQ.not("id", "in", `(${keepIds.join(",")})`);
    const { error: delErr } = await delQ;
    if (delErr) throw delErr;

    if (data.addresses.length === 0) return [] as AddressRow[];
    const rows = data.addresses.map((a, i) => ({
      ...(a.id ? { id: a.id } : {}),
      customer_id: data.customerId,
      organization_id: profile.organization_id as string,
      site_name: a.siteName ?? null,
      type: a.type ?? null,
      country: a.country ?? null,
      city: a.city ?? null,
      street: a.street ?? null,
      postal: a.postal ?? null,
      floor: a.floor ?? null,
      room: a.room ?? null,
      gps: a.gps ?? null,
      hours: a.hours ?? null,
      notes: a.notes ?? null,
      sort_order: i,
    }));
    const { data: saved, error } = await (supabase.from("customer_addresses") as unknown as {
      upsert: (r: unknown, o: { onConflict: string }) => { select: (s: string) => Promise<{ data: AddressRow[] | null; error: unknown }> };
    })
      .upsert(rows, { onConflict: "id" })
      .select("*");
    if (error) throw error as Error;
    return saved ?? [];
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_contacts")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const saveContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; contacts: ContactInput[] }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    if (!Array.isArray(input.contacts)) throw new Error("contacts must be an array");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");

    const keepIds = data.contacts.map((c) => c.id).filter(Boolean) as string[];
    let delQ = supabase.from("customer_contacts").delete().eq("customer_id", data.customerId);
    if (keepIds.length > 0) delQ = delQ.not("id", "in", `(${keepIds.join(",")})`);
    const { error: delErr } = await delQ;
    if (delErr) throw delErr;

    if (data.contacts.length === 0) return [] as ContactRow[];
    const rows = data.contacts.map((c, i) => ({
      ...(c.id ? { id: c.id } : {}),
      customer_id: data.customerId,
      organization_id: profile.organization_id as string,
      full_name: c.fullName ?? null,
      role: c.role ?? null,
      department: c.department ?? null,
      phone: c.phone ?? null,
      mobile: c.mobile ?? null,
      email: c.email ?? null,
      whatsapp: c.whatsapp ?? null,
      language: c.language ?? null,
      availability: c.availability ?? null,
      is_primary: c.isPrimary ?? false,
      notifications: c.notifications ?? false,
      sort_order: i,
    }));
    const { data: saved, error } = await (supabase.from("customer_contacts") as unknown as {
      upsert: (r: unknown, o: { onConflict: string }) => { select: (s: string) => Promise<{ data: ContactRow[] | null; error: unknown }> };
    })
      .upsert(rows, { onConflict: "id" })
      .select("*");
    if (error) throw error as Error;
    return saved ?? [];
  });

export const getCommercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customer_commercial")
      .select("data")
      .eq("customer_id", data.customerId)
      .maybeSingle();
    if (error) throw error;
    return ((row as { data?: CommercialData } | null)?.data ?? {}) as CommercialData;
  });

export const saveCommercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; data: Record<string, unknown> }) => {
    if (!input?.customerId) throw new Error("customerId is required");
    if (!input?.data || typeof input.data !== "object") throw new Error("data required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    if (!profile?.organization_id) throw new Error("User has no organization");
    const { error } = await (supabase.from("customer_commercial") as unknown as {
      upsert: (r: unknown, o: { onConflict: string }) => Promise<{ error: unknown }>;
    }).upsert(
      {
        customer_id: data.customerId,
        organization_id: profile.organization_id as string,
        data: data.data,
      },
      { onConflict: "customer_id" },
    );
    if (error) throw error as Error;
    return { ok: true };
  });

export type PriceListRow = {
  customerId: string;
  customerCode: string | null;
  companyName: string;
  priceList: string | null;
  priceListFile: string | null;
  priceListName: string | null;
  discount: string | null;
  currency: string | null;
  updatedAt: string | null;
};

export const listPriceLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PriceListRow[]> => {
    const { data, error } = await context.supabase
      .from("customer_commercial")
      .select("customer_id, data, updated_at, customers:customer_id(id, customer_code, company_name)")
      .limit(500);
    if (error) throw error as Error;
    const rows = (data ?? []) as Array<{
      customer_id: string;
      data: Record<string, unknown> | null;
      updated_at: string | null;
      customers: { id: string; customer_code: string | null; company_name: string } | null;
    }>;
    return rows
      .filter((r) => {
        const d = r.data ?? {};
        return !!(d.priceListFile || d.priceList);
      })
      .map((r) => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        return {
          customerId: r.customer_id,
          customerCode: r.customers?.customer_code ?? null,
          companyName: r.customers?.company_name ?? "—",
          priceList: (d.priceList as string) ?? null,
          priceListFile: (d.priceListFile as string) ?? null,
          priceListName: (d.priceListName as string) ?? null,
          discount: (d.discount as string) ?? null,
          currency: (d.currency as string) ?? null,
          updatedAt: r.updated_at,
        };
      });
  });
