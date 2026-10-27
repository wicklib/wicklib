import { describe, expect, it } from "vitest";

import { compileSource } from "../src/compiler";
import { ScriptError } from "../src/errors";

const HEADER = "// @wicklib/api 1";

function source(body = 'ctx.plot("line", ctx.bar.close);'): string {
  return `${HEADER}
import { defineScript } from "@wicklib/script";

export default defineScript({
  name: "Test",
  inputs: {},
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) {
    ${body}
  },
});
`;
}

describe("compileSource", () => {
  it("validates and transpiles a script to CommonJS", () => {
    const result = compileSource(source());

    expect(result.apiVersion).toBe(1);
    expect(result.code).toContain("require('@wicklib/script')");
    expect(result.code).toMatch(/exports\.\s*default\s*=/);
  });

  it("requires the API header", () => {
    expect(() => compileSource("export default 1;")).toThrowError(/@wicklib\/api/);
  });

  it("rejects an unsupported API version", () => {
    expect(() => compileSource(source().replace("@wicklib/api 1", "@wicklib/api 2"))).toThrowError(
      /Unsupported/,
    );
  });

  it("rejects npm and relative imports", () => {
    for (const moduleName of ["lodash", "./helper"]) {
      const invalid = source().replace('"@wicklib/script"', `"${moduleName}"`);
      expect(() => compileSource(invalid)).toThrowError(/Only imports/);
    }
  });

  it("rejects dynamic imports", () => {
    expect(() => compileSource(source('void import("./side-effect");'))).toThrowError(
      /Dynamic import/,
    );
  });

  it("rejects non-deterministic and host globals", () => {
    for (const statement of [
      'void fetch("/data");',
      "void document.body;",
      "Math.random();",
      "new Date();",
      "setTimeout(() => undefined, 1);",
    ]) {
      expect(() => compileSource(source(statement))).toThrowError(ScriptError);
    }
  });

  it("rejects eval and Function", () => {
    expect(() => compileSource(source('eval("1");'))).toThrowError(/eval/);
    expect(() => compileSource(source('new Function("return 1");'))).toThrowError(/Function/);
  });

  it("rejects any", () => {
    expect(() => compileSource(source("const value: any = 1;"))).toThrowError(/any/);
  });

  it("requires a default export", () => {
    const invalid = source().replace(
      "export default defineScript",
      "const definition = defineScript",
    );
    expect(() => compileSource(invalid)).toThrowError(/default-export/);
  });

  it("reports syntax errors as ScriptError", () => {
    expect(() => compileSource(source("const = ;"))).toThrowError(ScriptError);
  });
});
