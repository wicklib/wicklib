import * as monaco from "monaco-editor";
import { ScriptError, validateScript } from "@wicklib/script";
import {
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  typescriptDefaults,
} from "monaco-editor/languages/features/typescript/register";

import { CORE_TYPES, SCRIPT_TYPES } from "./types.generated";

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

let configured = false;
let editorCounter = 0;

/**
 * Mounts a Monaco-based WickScript editor.
 *
 * The host must configure Monaco workers before creating an editor. See the README for the
 * Vite setup.
 */
export function createScriptEditor(options: ScriptEditorOptions): ScriptEditor {
  if (options.apiVersion !== undefined && options.apiVersion !== 1) {
    throw new Error(`Unsupported WickScript API version: ${options.apiVersion}`);
  }

  configureMonaco();
  editorCounter += 1;
  const model = monaco.editor.createModel(
    options.value ?? defaultSource(),
    "typescript",
    monaco.Uri.parse(`file:///wicklib-script-${editorCounter}.ts`),
  );
  const editor = monaco.editor.create(options.container, {
    model,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    tabSize: 2,
    lineNumbersMinChars: 3,
    renderLineHighlight: "line",
    padding: { top: 8, bottom: 8 },
  });

  const validate = (): void => {
    try {
      validateScript(model.getValue());
      monaco.editor.setModelMarkers(model, "wicklib", []);
    } catch (error) {
      if (error instanceof ScriptError) {
        const line = error.line ?? 1;
        const column = error.column ?? 0;
        monaco.editor.setModelMarkers(model, "wicklib", [
          {
            severity: monaco.MarkerSeverity.Error,
            message: error.message,
            startLineNumber: line,
            startColumn: column + 1,
            endLineNumber: line,
            endColumn: column + 2,
          },
        ]);
      }
    }
  };

  validate();
  const change = editor.onDidChangeModelContent(() => {
    validate();
    options.onChange?.(editor.getValue());
  });

  return {
    getValue: () => editor.getValue(),
    setValue: (value) => editor.setValue(value),
    dispose: () => {
      change.dispose();
      editor.dispose();
      model.dispose();
    },
  };
}

function configureMonaco(): void {
  if (configured) {
    return;
  }
  configured = true;

  typescriptDefaults.setCompilerOptions({
    target: ScriptTarget.ES2020,
    module: ModuleKind.ESNext,
    moduleResolution: ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
  });
  typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  typescriptDefaults.addExtraLib(CORE_TYPES, "file:///node_modules/@wicklib/core/index.d.ts");
  typescriptDefaults.addExtraLib(
    '{"name":"@wicklib/core","types":"index.d.ts"}',
    "file:///node_modules/@wicklib/core/package.json",
  );
  typescriptDefaults.addExtraLib(SCRIPT_TYPES, "file:///node_modules/@wicklib/script/index.d.ts");
  typescriptDefaults.addExtraLib(
    '{"name":"@wicklib/script","types":"index.d.ts"}',
    "file:///node_modules/@wicklib/script/package.json",
  );
}

function defaultSource(): string {
  return `// @wicklib/api 1
import { defineScript } from "@wicklib/script";

export default defineScript({
  inputs: {},
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) {
    ctx.plot("line", ctx.bar.close);
  },
});
`;
}
