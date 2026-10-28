import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const disposables: Array<{ dispose: () => void }> = [];
  const editor = {
    getValue: vi.fn(() => "source"),
    setValue: vi.fn(),
    onDidChangeModelContent: vi.fn((_listener: () => void) => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  };
  const model = { getValue: vi.fn(() => "// script"), dispose: vi.fn() };
  const typescriptDefaults = {
    setCompilerOptions: vi.fn(),
    setDiagnosticsOptions: vi.fn(),
    addExtraLib: vi.fn(() => {
      const disposable = { dispose: vi.fn() };
      disposables.push(disposable);
      return disposable;
    }),
  };
  const setModelMarkers = vi.fn();
  return { disposables, editor, model, typescriptDefaults, setModelMarkers };
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
    setModelMarkers: mocks.setModelMarkers,
  },
  MarkerSeverity: { Error: 8 },
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
    const onValidate = vi.fn();
    const scriptEditor = createScriptEditor({
      container: {} as HTMLElement,
      value: "// script",
      onChange,
      onValidate,
    });

    expect(mocks.typescriptDefaults.addExtraLib).toHaveBeenCalledTimes(4);
    expect(mocks.setModelMarkers).toHaveBeenCalled();
    expect(onValidate).toHaveBeenCalled();
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
