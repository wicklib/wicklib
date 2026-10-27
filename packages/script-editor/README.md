# @wicklib/script-editor

Monaco-based editor for WickScript. It configures the TypeScript language service with
generated Wicklib types, including `defineScript`, inputs, plots, and `ta.*`.

**Status: alpha.** The host configures Monaco workers.

## Install

```sh
pnpm add @wicklib/script-editor monaco-editor
```

## Vite worker setup

Configure Monaco workers once before creating an editor:

```ts
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker();
  },
};
```

## Usage

```ts
import { createScriptEditor } from "@wicklib/script-editor";

const editor = createScriptEditor({
  container: document.getElementById("editor")!,
  value: initialSource,
  apiVersion: 1,
  onChange: (source) => console.log(source),
});

editor.setValue(nextSource);
editor.dispose();
```

The editor adds `@wicklib/core` and `@wicklib/script` declarations from generated package
types. `pnpm build` regenerates those declarations before bundling.

## License

Apache-2.0.
