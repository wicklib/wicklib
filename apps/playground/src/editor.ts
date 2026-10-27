import EditorWorker from "../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker";
import TsWorker from "../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker";
import { createScriptEditor, type ScriptEditor } from "@wicklib/script-editor";

declare global {
  interface Window {
    __wicklibEditorReady?: boolean;
    __wicklibEditor?: ScriptEditor;
    __wicklibEditorSourceLength?: number;
  }
}

(
  self as unknown as {
    MonacoEnvironment: {
      getWorker: (_moduleId: string, label: string) => Worker;
    };
  }
).MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker();
  },
};

const container = document.querySelector<HTMLDivElement>("#editor");
if (!container) {
  throw new Error("#editor not found");
}

const editor = createScriptEditor({
  container,
  apiVersion: 1,
  onChange: (source) => {
    window.__wicklibEditorSourceLength = source.length;
  },
});

window.__wicklibEditor = editor;
window.__wicklibEditorReady = true;
