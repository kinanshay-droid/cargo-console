import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// PREVIOUSLY this file called a `bindCloudflareEnv(request, env, ctx)` here,
// on the theory that this file *is* the raw Cloudflare Worker module Nitro
// would otherwise generate, so we had to replicate its env-binding step
// ourselves. That theory was wrong, and the "fix" was actively causing the
// bug it was meant to solve.
//
// The real Cloudflare Worker entry Cloudflare invokes is always Nitro's own
// generated `cloudflare-module.mjs` -> `_module-handler.mjs` (this file is
// wired in further downstream, as the TanStack Start server entry, and is
// called with different arguments — confirmed via a temporary /__debug/env
// route: the `env`/`ctx` parameters below were literally `undefined` on
// every production request). Nitro's `_module-handler.mjs` ALREADY does,
// correctly, before ever reaching this file:
//   1. `globalThis.__env__ = env` (what unenv's `process.env` polyfill reads)
//   2. `req.runtime.cloudflare = { env, context }` (augmentReq)
// Our own `bindCloudflareEnv(request, env, ctx)` call — using this file's
// `env`/`ctx` params, which are undefined — was overwriting that already-
// correct binding with `{ env: undefined, context: undefined }` on every
// single request. That's why SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY were
// never visible in client.server.ts, no matter how the Cloudflare dashboard
// vars were configured or how many times the Worker was redeployed.
//
// Do not reintroduce env-binding logic here — Nitro's own entry already
// does it correctly upstream of this file.

// Temporary raw diagnostic route — reports exactly what Cloudflare passed
// into fetch(request, env, ctx) for THIS request, before any h3/TanStack/
// AsyncLocalStorage layer touches it. Isolates whether `env` itself is
// empty at the Worker's true entry point, or gets lost somewhere further
// downstream. Remove once the env-var bug is resolved.
function debugEnvResponse(env: unknown, ctx: unknown): Response {
  const envObj = env && typeof env === "object" ? (env as Record<string, unknown>) : null;
  return Response.json({
    envType: typeof env,
    envIsNull: env === null,
    envIsUndefined: env === undefined,
    envKeys: envObj ? Object.keys(envObj) : null,
    hasSupabaseUrl: envObj ? "SUPABASE_URL" in envObj : null,
    hasSupabaseServiceRoleKey: envObj ? "SUPABASE_SERVICE_ROLE_KEY" in envObj : null,
    ctxType: typeof ctx,
    ctxIsNull: ctx === null,
    ctxIsUndefined: ctx === undefined,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/__debug/env") {
        return debugEnvResponse(env, ctx);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
