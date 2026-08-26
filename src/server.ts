import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Trivial-change marker: forces a fresh `wrangler deploy` so the
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vars just added in the Cloudflare
// dashboard's Settings -> Variables and secrets actually attach to a live
// deployed version, in case the previously-active version was built before
// they were saved. No functional change.

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

// Nitro's own Cloudflare `_module-handler.mjs` (the entry we would get for
// free if we didn't override `tanstackStart.server.entry`) does two things
// with the Worker's `env` binding before ever touching the request:
//   1. `globalThis.__env__ = env` — this is what unenv's `process.env`
//      polyfill (node_modules/unenv/.../process/env.mjs) reads from on every
//      property access. Without it, `process.env.ANYTHING` is always
//      undefined on Cloudflare Workers, no matter what's configured in the
//      dashboard.
//   2. Augments the incoming request with `req.runtime.cloudflare = { env,
//      context }`, which is how h3's `event.context.cloudflare.env` gets
//      populated for code that prefers the explicit binding over process.env.
// Because this file replaces nitro's default entry, neither of those ever
// ran — every server-side `process.env.SUPABASE_URL` read (client.server.ts,
// auth-middleware.ts, client.ts) silently saw `undefined` in production even
// though the variables were correctly set in Cloudflare. Replicating both
// steps here restores the standard nitro/Cloudflare env-loading contract.
function bindCloudflareEnv(request: Request, env: unknown, ctx: unknown): void {
  (globalThis as { __env__?: unknown }).__env__ = env;

  const req = request as Request & {
    runtime?: { name?: string; cloudflare?: Record<string, unknown> };
  };
  req.runtime ??= { name: "cloudflare" };
  req.runtime.cloudflare = {
    ...req.runtime.cloudflare,
    env,
    context: ctx,
  };
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      bindCloudflareEnv(request, env, ctx);
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
