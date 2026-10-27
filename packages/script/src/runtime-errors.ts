/**
 * Runtime failure codes for a sandboxed script.
 */
export type ScriptRuntimeErrorCode =
  "RUNTIME_ERROR" | "TIMEOUT" | "MEMORY_LIMIT" | "OUTPUT_LIMIT" | "INVALID_INPUT";

/**
 * A failure raised while executing a compiled script.
 */
export class ScriptRuntimeError extends Error {
  readonly code: ScriptRuntimeErrorCode;
  readonly barIndex: number | null;

  constructor(code: ScriptRuntimeErrorCode, message: string, barIndex: number | null = null) {
    super(message);
    this.name = "ScriptRuntimeError";
    this.code = code;
    this.barIndex = barIndex;
  }
}
