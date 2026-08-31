// Generates and verifies courier portal access tokens. Server-only (see
// integrations/supabase/client.server.ts's naming convention) — safe to
// import at the top level here since this module is never bundled into the
// client. Mirrors src/lib/api-key.server.ts's plaintext-once / hash-stored
// pattern exactly, just for the courier's personal link instead of a
// partner's API key.
//
// Uses only Web Crypto, available in both Node and the Cloudflare Worker
// runtime this app deploys to.
const TOKEN_PREFIX = "crr_";

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Plaintext token shown to the admin exactly once, embedded in the personal
// link (afiklog.com/courier/<token>). Format: crr_<40 random hex chars>.
export function generateCourierTokenPlaintext(): string {
  const random = new Uint8Array(20);
  crypto.getRandomValues(random);
  return `${TOKEN_PREFIX}${toHex(random)}`;
}

// SHA-256 hex digest of the plaintext token — this, not the plaintext, is
// what gets stored in couriers.access_token_hash. Verifying a presented
// token means hashing it the same way and comparing hashes.
export async function hashCourierToken(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}
