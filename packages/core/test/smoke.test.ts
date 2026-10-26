import { describe, expect, it } from "vitest";

import { NOT_IMPLEMENTED, VERSION, assertFeature, createChart } from "../src/index";

describe("@wicklib/core", () => {
  it("exposes a semantic version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("createChart is a typed stub", () => {
    expect(() => createChart({} as HTMLElement)).toThrow(NOT_IMPLEMENTED);
  });

  it("assertFeature enforces licensing", () => {
    expect(() => assertFeature({ hasFeature: () => false }, "orderflow")).toThrow(
      /WICKLIB_LICENSE_REQUIRED/,
    );
  });
});
