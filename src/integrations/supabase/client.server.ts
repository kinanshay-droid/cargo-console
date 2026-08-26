// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "./types";

// Reads the Cloudflare Worker's env bindings straight off the current
// request instead of `process.env`/`globalThis.__env__`. Those are
// process-wide mutable state (see bindCloudflareEnv in src/server.ts) — on
// a reused Worker isolate handling requests concurrently, a second
// in-flight request can overwrite `globalThis.__env__` during the `await
// import(...)` gap between this module loading and createSupabaseAdminClient
// actually reading it, silently handing one request another request's env
// (or racing to undefined). Reading `request.runtime.cloudflare.env`
// instead is request-scoped and immune to that race. Falls back to
// process.env for local dev (`vite dev`), where no Cloudflare request
// binding exists.
function getCloudflareEnv(): Record<string, string | undefined> {
  try {
    // getRequest() throws outside a live request context (e.g. local
    // scripts) — fall through to process.env in that case.
    const request = getRequest() as
      | (Request & { runtime?: { cloudflare?: { env?: Record<string, string | undefined> } } })
      | undefined;
    return request?.runtime?.cloudflare?.env ?? {};
  } catch {
    return {};
  }
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const cfEnv = getCloudflareEnv();
  const SUPABASE_URL = cfEnv.SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    cfEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in your deployment's environment/secrets configuration.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
//
// Deliberately NOT cached as a module-level singleton (as it was before):
// on a Cloudflare Worker isolate reused across concurrent requests, caching
// a client built from one request's env risked handing a later request
// something built from stale/racy global state. createSupabaseAdminClient()
// itself is cheap (no network call, just config), and getCloudflareEnv()
// now reads directly off the current request, so rebuilding per property
// access is the safe default.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    return Reflect.get(createSupabaseAdminClient(), prop, receiver);
  },
});
