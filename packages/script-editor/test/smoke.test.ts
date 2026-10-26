import { describe, expect, it } from "vitest";

import { createScriptEditor } from "../src/index";

describe("@wicklib/script-editor", () => {
  it("createScriptEditor is a typed stub", () => {
    expect(() => createScriptEditor({ container: {} as HTMLElement })).toThrow(
      /WICKLIB_NOT_IMPLEMENTED/,
    );
  });
});
