import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const disposables: Array<{ dispose: () => void }> = [];
  const editor = {
    getValue: vi.fn(() => "source"),
    setValue: vi.fn(),
    onDidChangeModelContent: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  };
  const model = { dispose: vi.fn() };
  const typescriptDefaults = {
    setCompilerOptions: vi.fn(),
    setDiagnosticsOptions: vi.fn(),
    addExtraLib: vi.fn(() => {
      const disposable = { dispose: vi.fn() };
      disposables.push(disposable);
      return disposable;
    }),
  };
  return { disposables, editor, model, typescriptDefaults };
});

vi.mock("monaco-editor/languages/features/typescript/register", () => ({
  typescriptDefaults: mocks.typescriptDefaults,
  ScriptTarget: { ES2020: 7 },
  ModuleKind: { ESNext: 99 },
  ModuleResolutionKind: { NodeJs: 2 },
}));

vi.mock("monaco-editor", () => ({
  editor: {
    createModel: vi.fn(() => mocks.model),
    create: vi.fn(() => mocks.editor),
  },
  Uri: { parse: vi.fn((value: string) => value) },
}));

import { createScriptEditor } from "../src/index";

afterEach(() => {
  mocks.disposables.length = 0;
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

    expect(mocks.typescriptDefaults.addExtraLib).toHaveBeenCalledTimes(4);
    expect(mocks.editor.getValue()).toBe("source");
    expect(scriptEditor.getValue()).toBe("source");

    scriptEditor.setValue("next");
    expect(mocks.editor.setValue).toHaveBeenCalledWith("next");

    const listener = mocks.editor.onDidChangeModelContent.mock.calls[0]?.[0];
    listener?.();
    expect(onChange).toHaveBeenCalledWith("source");

    scriptEditor.dispose();
    expect(mocks.editor.dispose).toHaveBeenCalled();
    expect(mocks.model.dispose).toHaveBeenCalled();
  });

  it("rejects unsupported API versions", () => {
    expect(() => createScriptEditor({ container: {} as HTMLElement, apiVersion: 2 })).toThrow(
      /Unsupported WickScript API version/,
    );
  });
});
