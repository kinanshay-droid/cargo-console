import { toast } from "sonner";
import { ApiError } from "./api";

// Stable error codes documented by the backend. Map them to short,
// human-readable messages so screens don't leak raw server strings.
const FRIENDLY: Record<string, string> = {
  // Cross-cutting
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  VALIDATION_FAILED: "Some fields need attention.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  TOKEN_REVOKED: "Your session was ended. Please sign in again.",
  FORBIDDEN: "You don't have permission to do this.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  NOT_FOUND: "We couldn't find what you were looking for.",

  // Auth
  INVALID_CREDENTIALS: "Wrong organization code, email or password.",
  INVALID_CURRENT_PASSWORD: "Your current password is incorrect.",
  RESET_TOKEN_INVALID: "This password reset link is invalid or has expired.",

  // Organizations
  DUPLICATE_ORGANIZATION_CODE: "That organization code is already taken.",

  // Shipments
  DUPLICATE_REFERENCE_CODE: "A shipment with this reference code already exists.",
  INVALID_STATUS_TRANSITION: "This shipment can't move to that status.",

  // Users
  DUPLICATE_EMAIL: "That email address is already in use.",
  CANNOT_DEACTIVATE_SELF: "You can't deactivate or remove your own account here.",
  CANNOT_RESET_OWN_PASSWORD: "Change your own password from the Account page.",

  // Roles & permissions
  DUPLICATE_NAME: "A record with this name already exists.",
  ALREADY_GRANTED: "That's already granted.",
};

export function friendlyApiMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) return FRIENDLY[err.code] ?? err.message ?? fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function toastApiError(err: unknown, fallback = "Something went wrong") {
  if (err instanceof ApiError) {
    const message = FRIENDLY[err.code] ?? err.message ?? fallback;
    if (err.details && err.details.length) {
      toast.error(message, { description: err.details.join(" · ") });
    } else {
      toast.error(message);
    }
    return;
  }
  toast.error(err instanceof Error ? err.message : fallback);
}
