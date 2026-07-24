// Thin client for the external REST API described in LOVABLE_HANDOFF.md.
// - Every response is wrapped in { data, error, meta }
// - Every non-public route needs Authorization: Bearer <token>
// - Never send extra fields — the server rejects unknown properties.

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api";

const TOKEN_KEY = "auth.accessToken";
const EMAIL_KEY = "auth.email";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
}
export function getSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_KEY);
}
export function setSessionEmail(email: string) {
  window.localStorage.setItem(EMAIL_KEY, email);
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: string[];
  } | null;
  meta?: { timestamp?: string };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: string[];
  constructor(code: string, message: string, status: number, details?: string[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean; // default true; pass false for public endpoints
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = opts;

  const url = new URL(
    (BASE_URL.startsWith("http") ? BASE_URL : window.location.origin + BASE_URL) +
      path,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // no body / non-JSON
  }

  if (!res.ok || (payload && payload.error)) {
    const err = payload?.error;
    // Auth expired — clear token and broadcast so the app can redirect.
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    throw new ApiError(
      err?.code ?? `HTTP_${res.status}`,
      err?.message ?? res.statusText ?? "Request failed",
      res.status,
      err?.details,
    );
  }

  return (payload?.data ?? (undefined as unknown)) as T;
}

// --- Domain types --------------------------------------------------------

export type ShipmentStatus = "DRAFT" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
export interface Shipment {
  id: string;
  organizationId: string;
  referenceCode: string;
  description: string | null;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export interface AppUser {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
export interface Permission {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  actorUserId: string | null;
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  createdAt: string;
}
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
