/**
 * Machine-readable error codes.
 */
export type WickErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_DATA"
  | "NOT_IMPLEMENTED"
  | "LICENSE_REQUIRED"
  | "DUPLICATE_SERIES"
  | "DUPLICATE_EXTENSION"
  | "DUPLICATE_OVERLAY"
  | "UNKNOWN_SERIES_TYPE"
  | "DATAFEED_ERROR"
  | "DISPOSED";

/**
 * Every error thrown by Wicklib is a `WickError`.
 */
export class WickError extends Error {
  readonly code: WickErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: WickErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WickError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/**
 * Narrowing helper.
 */
export function isWickError(value: unknown): value is WickError {
  return value instanceof WickError;
}

/**
 * Internal helper for throwing consistent errors.
 */
export function fail(
  code: WickErrorCode,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new WickError(code, message, details);
}
