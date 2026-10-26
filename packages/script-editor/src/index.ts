/**
 * Error code used by Phase 1 stubs.
 */
export const SCRIPT_EDITOR_NOT_IMPLEMENTED = "WICKLIB_NOT_IMPLEMENTED";

/**
 * Options for mounting the editor.
 */
export interface ScriptEditorOptions {
  container: HTMLElement;
  value?: string;
  /** WickScript API version the editor should type against. */
  apiVersion?: number;
  onChange?: (value: string) => void;
}

/**
 * A mounted script editor.
 */
export interface ScriptEditor {
  getValue(): string;
  setValue(value: string): void;
  dispose(): void;
}

/**
 * Mounts a Monaco-based WickScript editor.
 */
export function createScriptEditor(_options: ScriptEditorOptions): ScriptEditor {
  throw new Error(`${SCRIPT_EDITOR_NOT_IMPLEMENTED}: createScriptEditor`);
}
