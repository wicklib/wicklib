import { afterEach, describe, expect, it, vi } from "vitest";

const disposables: Array<{ dispose: () => void }> = [];
const editor = {
  getValue: vi.fn(() => "source"),
  setValue: vi.fn(),
  onDidChangeModelContent: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
};
const model = { dispose: vi.fn() };

vi.mock("monaco-editor", () => ({
  editor: {
    createModel: vi.fn(() => model),
    create: vi.fn(() => editor),
  },
  Uri: { parse: vi.fn((value: string) => value) },
  languages: {
    typescript: {
      typescriptDefaults: {
        setCompilerOptions: vi.fn(),
        setDiagnosticsOptions: vi.fn(),
        addExtraLib: vi.fn(() => {
          const disposable = { dispose: vi.fn() };
          disposables.push(disposable);
          return disposable;
        }),
      },
      ScriptTarget: { ES2022: 9 },
      ModuleKind: { ESNext: 99 },
      ModuleResolutionKind: { NodeJs: 2 },
    },
  },
}));

import * as monaco from "monaco-editor";
import { createScriptEditor } from "../src/index";

afterEach(() => {
  disposables.length = 0;
  vi.clearAllMocks();
});

describe("@wicklib/script-editor", () => {
  it("mounts Monaco with WickScript declarations", () => {
    const onChange = vi.fn();
    const scriptEditor = createScriptEditor({
      container: {} as HTMLElement,
      value: "// script",
      onChange,
    });

    const defaults = (
      monaco.languages as unknown as {
        typescript: { typescriptDefaults: { addExtraLib: () => unknown } };
      }
    ).typescript.typescriptDefaults;
    expect(defaults.addExtraLib).toHaveBeenCalledTimes(4);
    expect(editor.getValue()).toBe("source");
    expect(scriptEditor.getValue()).toBe("source");

    scriptEditor.setValue("next");
    expect(editor.setValue).toHaveBeenCalledWith("next");

    const listener = editor.onDidChangeModelContent.mock.calls[0]?.[0];
    listener?.();
    expect(onChange).toHaveBeenCalledWith("source");

    scriptEditor.dispose();
    expect(editor.dispose).toHaveBeenCalled();
    expect(model.dispose).toHaveBeenCalled();
  });

  it("rejects unsupported API versions", () => {
    expect(() => createScriptEditor({ container: {} as HTMLElement, apiVersion: 2 })).toThrow(
      /Unsupported WickScript API version/,
    );
  });
});
