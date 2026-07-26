// One-time (re-runnable) seed script for the lookup_airports table.
// Imports the existing src/lib/airports.ts dataset (~4000+ IATA airports) and
// writes it as global (organization_id = NULL) rows, replacing whatever
// global airport rows are already there — safe to re-run after airports.ts
// is updated.
//
// Run with:  npx tsx scripts/seed-lookup-airports.ts
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (same file the
// app itself uses).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AIRPORTS } from "../src/lib/airports";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(__dirname, "..", ".env");
  let content: string;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env — cannot seed lookup_airports.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log(`Seeding ${AIRPORTS.length} airports into lookup_airports...`);

  // Global rows only — clear existing global rows first so this script is
  // safely re-runnable (org-specific quick-added airports, if any, are
  // untouched since they have organization_id set).
  const { error: deleteError } = await supabase
    .from("lookup_airports")
    .delete()
    .is("organization_id", null);
  if (deleteError) {
    console.error("Failed to clear existing global airports:", deleteError.message);
    process.exit(1);
  }

  const rows = AIRPORTS.map((a, i) => ({
    organization_id: null,
    code: a.iata,
    name: `${a.city}, ${a.country} (${a.iata})`,
    name_en: a.name,
    is_active: true,
    sort_order: i,
    metadata: { icao: a.icao, city: a.city, country: a.country, iso2: a.iso2, airport_name: a.name },
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("lookup_airports").insert(chunk);
    if (error) {
      console.error(`Failed at rows ${i}-${i + chunk.length}:`, error.message);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }

  console.log("Done.");
}

main();
