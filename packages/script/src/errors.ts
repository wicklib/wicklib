/**
 * Machine-readable WickScript failure codes.
 */
export type ScriptErrorCode =
  | "INVALID_API_VERSION"
  | "INVALID_SOURCE"
  | "UNSUPPORTED_IMPORT"
  | "UNSUPPORTED_GLOBAL"
  | "UNSUPPORTED_SYNTAX"
  | "INVALID_ENTRY"
  | "INVALID_DEFINITION";

/**
 * Typed error raised while validating or compiling a WickScript source.
 */
export class ScriptError extends Error {
  readonly code: ScriptErrorCode;
  readonly line?: number;
  readonly column?: number;

  constructor(code: ScriptErrorCode, message: string, location?: { line: number; column: number }) {
    super(message);
    this.name = "ScriptError";
    this.code = code;
    if (location) {
      this.line = location.line;
      this.column = location.column;
    }
  }
}
