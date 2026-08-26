// Generates and verifies external-partner API keys. Server-only (the file
// name ends in .server.ts by this project's convention — see
// integrations/supabase/client.server.ts) since it's fine to import at the
// top level here: this module is never bundled into the client.
//
// Uses only Web Crypto (crypto.getRandomValues / crypto.subtle.digest), the
// same API surface available in both Node and the Cloudflare Worker runtime
// this app actually deploys to — no Node-only `crypto` module.
const KEY_PREFIX = "afik_live_";

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Plaintext key shown to the admin exactly once. Format:
// afik_live_<32 random hex chars> — long enough to be unguessable, short
// enough to paste around comfortably.
export function generateApiKeyPlaintext(): string {
  const random = new Uint8Array(24);
  crypto.getRandomValues(random);
  return `${KEY_PREFIX}${toHex(random)}`;
}

// SHA-256 hex digest of the plaintext key — this, not the plaintext, is what
// gets stored in api_partners.api_key_hash. Verifying a presented key means
// hashing it the same way and comparing hashes.
export async function hashApiKey(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

// First 14 chars (prefix + 4 hex digits) — enough for an admin to tell keys
// apart in a list without exposing anything secret.
export function apiKeyDisplayPrefix(plaintext: string): string {
  return plaintext.slice(0, KEY_PREFIX.length + 4) + "…";
}
