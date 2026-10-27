import * as monaco from "monaco-editor";

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

  const change = editor.onDidChangeModelContent(() => {
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

interface MonacoTypescriptApi {
  typescriptDefaults: {
    setCompilerOptions(options: Record<string, unknown>): void;
    setDiagnosticsOptions(options: Record<string, unknown>): void;
    addExtraLib(content: string, filePath?: string): unknown;
  };
  ScriptTarget: { ES2022: number };
  ModuleKind: { ESNext: number };
  ModuleResolutionKind: { NodeJs: number };
}

function configureMonaco(): void {
  if (configured) {
    return;
  }
  configured = true;

  const typescript = (monaco.languages as unknown as { typescript: MonacoTypescriptApi })
    .typescript;
  const defaults = typescript.typescriptDefaults;
  defaults.setCompilerOptions({
    target: typescript.ScriptTarget.ES2022,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
  });
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  defaults.addExtraLib(CORE_TYPES, "file:///node_modules/@wicklib/core/index.d.ts");
  defaults.addExtraLib(
    '{"name":"@wicklib/core","types":"index.d.ts"}',
    "file:///node_modules/@wicklib/core/package.json",
  );
  defaults.addExtraLib(SCRIPT_TYPES, "file:///node_modules/@wicklib/script/index.d.ts");
  defaults.addExtraLib(
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
