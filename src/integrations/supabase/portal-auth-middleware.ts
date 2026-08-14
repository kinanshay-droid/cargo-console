// Auth middleware for the external customer portal (src/routes/portal.*).
// Deliberately separate from auth-middleware.ts (which is regenerated and
// gates the internal AFIK-staff dashboard.* routes) — a portal session is a
// different kind of principal: no organization membership, access scoped to
// exactly one customer via the customer_portal_access table (see migration
// 20260814090000_customer_portal.sql).
//
// Same JWT-scoped-client approach as requireSupabaseAuth (the Postgres RLS
// policies are the real access-control boundary, not this middleware) — the
// one thing added here is resolving + requiring a linked customer_id, so
// every portal server function gets it for free instead of re-querying it.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requirePortalAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing Supabase environment variable(s). Set them in your deployment's environment/secrets configuration.");
  }

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.replace("Bearer ", "");
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  const userId = data.claims.sub as string;

  const { data: access, error: accessError } = await supabase
    .from("customer_portal_access")
    .select("customer_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (accessError) throw accessError;
  if (!access) {
    // A real Microsoft account signed in successfully, but nobody at AFIK
    // has invited this email to any customer's portal yet — a distinct,
    // recoverable state from "not logged in", handled by the portal UI
    // (see routes/portal.dashboard.tsx) rather than treated as an error.
    throw new Error("PORTAL_NOT_LINKED");
  }

  return next({
    context: {
      supabase,
      userId,
      customerId: access.customer_id,
      email: access.email,
    },
  });
});
