# E2E tests

End-to-end tests using Playwright (Python). Requires the dev server at
`http://localhost:8080`.

## Run

```bash
python tests/e2e/quote_shipment_mode.py
```

## What's covered

- `quote_shipment_mode.py` — signs up a fresh user, opens the New Quote
  dialog three times (one for each shipment mode: `direct`, `console`,
  `transship`), submits, and asserts:
  1. Success toast appears.
  2. The Commercial dashboard's "הצעות שנשמרו לאחרונה" panel renders a row
     with `data-shipment-mode="<mode>"` — proving the value round-tripped
     through `createQuote` → Supabase → `listMyQuotes` → UI.
  3. After a full page reload, all three modes are still visible (durable
     persistence, not just an in-memory refetch).

Screenshots are written to `/tmp/browser/quote-shipment-mode/`.
