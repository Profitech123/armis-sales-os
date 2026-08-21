import { logger } from "@/lib/observability/logger";

export type PublicApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "DATA_ACCESS_FAILED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "REPLAY_REJECTED"
  | "FORWARDING_FAILED";

const statusMessages: Record<PublicApiErrorCode, string> = {
  UNAUTHORIZED: "Authentication is required.",
  FORBIDDEN: "You do not have permission to perform this action.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  INVALID_REQUEST: "The request is invalid.",
  NOT_FOUND: "The requested resource was not found.",
  DATA_ACCESS_FAILED: "The requested data could not be accessed.",
  RATE_LIMITED: "Too many requests.",
  PAYLOAD_TOO_LARGE: "The request payload is too large.",
  REPLAY_REJECTED: "The request timestamp or identifier is invalid.",
  FORWARDING_FAILED: "The downstream request could not be completed.",
};

export function apiError(code: PublicApiErrorCode, status: number, details?: unknown) {
  return Response.json({ error: { code, message: statusMessages[code], ...(details ? { details } : {}) } }, { status });
}

export function actorError(error: { status: number }) {
  if (error.status === 401) return apiError("UNAUTHORIZED", 401);
  if (error.status === 403) return apiError("FORBIDDEN", 403);
  return apiError("SERVICE_UNAVAILABLE", 503);
}

export function dataAccessError(event: string, context: Record<string, string | number | boolean | null | undefined> = {}) {
  logger.error(event, context);
  return apiError("DATA_ACCESS_FAILED", 500);
}
