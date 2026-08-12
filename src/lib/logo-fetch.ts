// Shared helper for "type a website → auto-fill the company logo" used by
// both the New Customer dialog and the customer detail page's company tab.
// No API key / server call needed: both candidate services serve a plain
// image at a predictable URL, so the browser can just try loading it in an
// <img> tag and fall back on error.

// Parses a loosely-typed website field ("example.com", "www.example.com",
// "https://example.com/path") into a bare domain suitable for a logo
// lookup. Returns null while the value is too short/incomplete to be worth
// firing a request for, so we don't spam requests on every keystroke.
export function extractDomainFromWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host.length < 4) return null;
    return host;
  } catch {
    return null;
  }
}

// Clearbit returns the company's real logo when it has one; Google's
// favicon service is the fallback for smaller domains Clearbit doesn't
// cover. Tried in order, first successful image load wins.
export function logoCandidateUrls(domain: string): string[] {
  return [`https://logo.clearbit.com/${domain}?size=128`, `https://www.google.com/s2/favicons?sz=128&domain=${domain}`];
}
