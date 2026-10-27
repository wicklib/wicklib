import { parse, type AnyNode } from "acorn";
import { transform } from "sucrase";

import { WICKSCRIPT_API_VERSION } from "./constants";
import { ScriptError } from "./errors";

const API_HEADER = /^\s*\/\/\s*@wicklib\/api\s+(\d+)\s*$/m;
const SCRIPT_MODULE = "@wicklib/script";

const BLOCKED_IDENTIFIERS = new Set([
  "Date",
  "Function",
  "WebSocket",
  "Worker",
  "XMLHttpRequest",
  "crypto",
  "document",
  "eval",
  "fetch",
  "global",
  "globalThis",
  "importScripts",
  "indexedDB",
  "localStorage",
  "navigator",
  "performance",
  "process",
  "queueMicrotask",
  "requestAnimationFrame",
  "require",
  "self",
  "sessionStorage",
  "setImmediate",
  "setInterval",
  "setTimeout",
  "window",
]);

/**
 * Result of validating and transpiling one script source.
 */
export interface CompiledSource {
  apiVersion: number;
  code: string;
}

/**
 * Validates and transpiles a WickScript source.
 *
 * Runtime sandboxing is applied later by the QuickJS host. This compiler enforces the
 * authoring contract before any script code executes.
 */
export function compileSource(source: string): CompiledSource {
  if (typeof source !== "string" || source.trim() === "") {
    throw new ScriptError("INVALID_SOURCE", "Script source must be a non-empty string");
  }

  const versionMatch = API_HEADER.exec(source);
  if (!versionMatch) {
    throw new ScriptError(
      "INVALID_API_VERSION",
      "Script must declare // @wicklib/api 1 in a header comment",
    );
  }
  const apiVersion = Number(versionMatch[1]);
  if (apiVersion !== WICKSCRIPT_API_VERSION) {
    throw new ScriptError(
      "INVALID_API_VERSION",
      `Unsupported WickScript API version: ${apiVersion}`,
    );
  }

  if (/\bany\b/.test(maskCommentsAndStrings(source))) {
    throw new ScriptError("UNSUPPORTED_SYNTAX", "any is not allowed in WickScript");
  }

  let stripped: string;
  try {
    stripped = transform(source, {
      transforms: ["typescript"],
      filePath: "script.ts",
    }).code;
  } catch (error) {
    throw invalidSource(error);
  }

  let ast: AnyNode;
  try {
    ast = parse(stripped, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    });
  } catch (error) {
    throw invalidSource(error);
  }

  validateAst(ast);

  try {
    const code = transform(stripped, {
      transforms: ["imports"],
      filePath: "script.js",
    }).code;
    return { apiVersion, code };
  } catch (error) {
    throw invalidSource(error);
  }
}

function validateAst(ast: AnyNode): void {
  let hasDefaultExport = false;

  walk(ast, (node, parent, key) => {
    if (node.type === "ExportDefaultDeclaration") {
      hasDefaultExport = true;
    }
    if (node.type === "ImportDeclaration") {
      if (node.source.value !== SCRIPT_MODULE) {
        throw new ScriptError(
          "UNSUPPORTED_IMPORT",
          `Only imports from "${SCRIPT_MODULE}" are allowed`,
          location(node),
        );
      }
    }
    if (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") {
      const source = (node as { source?: { value?: unknown } }).source;
      if (source && source.value !== SCRIPT_MODULE) {
        throw new ScriptError(
          "UNSUPPORTED_IMPORT",
          "Re-exports from other modules are not allowed",
          location(node),
        );
      }
    }
    if (node.type === "ImportExpression") {
      throw new ScriptError("UNSUPPORTED_SYNTAX", "Dynamic import is not allowed", location(node));
    }
    if (node.type === "CallExpression") {
      const callee = node.callee;
      if (callee.type === "Identifier" && ["eval", "Function", "require"].includes(callee.name)) {
        throw new ScriptError(
          "UNSUPPORTED_GLOBAL",
          `${callee.name} is not allowed`,
          location(callee),
        );
      }
    }
    if (node.type === "NewExpression" && node.callee.type === "Identifier") {
      if (["Function", "Worker"].includes(node.callee.name)) {
        throw new ScriptError(
          "UNSUPPORTED_GLOBAL",
          `${node.callee.name} is not allowed`,
          location(node.callee),
        );
      }
    }
    if (node.type === "MemberExpression") {
      const object = node.object;
      const property = node.property;
      if (
        object.type === "Identifier" &&
        object.name === "Math" &&
        property.type === "Identifier" &&
        property.name === "random"
      ) {
        throw new ScriptError(
          "UNSUPPORTED_GLOBAL",
          "Math.random is not deterministic",
          location(node),
        );
      }
      if (
        object.type === "Identifier" &&
        object.name === "crypto" &&
        property.type === "Identifier"
      ) {
        throw new ScriptError("UNSUPPORTED_GLOBAL", "crypto is not allowed", location(node));
      }
    }
    if (node.type === "Identifier" && isReference(parent, key)) {
      if (BLOCKED_IDENTIFIERS.has(node.name)) {
        throw new ScriptError("UNSUPPORTED_GLOBAL", `${node.name} is not allowed`, location(node));
      }
    }
  });

  if (!hasDefaultExport) {
    throw new ScriptError("INVALID_ENTRY", "Script must default-export a defineScript definition");
  }
}

function walk(
  node: AnyNode,
  visit: (node: AnyNode, parent: AnyNode | null, key: string | null) => void,
  parent: AnyNode | null = null,
  key: string | null = null,
): void {
  visit(node, parent, key);
  for (const [childKey, value] of Object.entries(node)) {
    if (
      childKey === "type" ||
      childKey === "start" ||
      childKey === "end" ||
      childKey === "loc" ||
      value === null ||
      typeof value !== "object"
    ) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) {
          walk(child, visit, node, childKey);
        }
      }
    } else if (isNode(value)) {
      walk(value, visit, node, childKey);
    }
  }
}

function isNode(value: unknown): value is AnyNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function isReference(parent: AnyNode | null, key: string | null): boolean {
  if (!parent) {
    return true;
  }
  if (parent.type === "MemberExpression" && key === "property" && !parent.computed) {
    return false;
  }
  if (parent.type === "Property" && key === "key" && !parent.computed) {
    return false;
  }
  if (parent.type === "MethodDefinition" && key === "key") {
    return false;
  }
  if (parent.type === "ImportSpecifier" || parent.type === "ExportSpecifier") {
    return false;
  }
  return true;
}

function location(node: AnyNode): { line: number; column: number } {
  const loc = (node as { loc?: { start: { line: number; column: number } } }).loc;
  return loc ? { line: loc.start.line, column: loc.start.column } : { line: 1, column: 0 };
}

function invalidSource(error: unknown): ScriptError {
  const message = error instanceof Error ? error.message : "Invalid script source";
  const loc = (error as { loc?: { line: number; column: number } }).loc;
  return new ScriptError("INVALID_SOURCE", message, loc);
}

function maskCommentsAndStrings(source: string): string {
  let result = "";
  let state: "code" | "line" | "block" | "single" | "double" | "template" = "code";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (state === "code") {
      if (character === "/" && next === "/") {
        state = "line";
        result += "  ";
        index += 1;
      } else if (character === "/" && next === "*") {
        state = "block";
        result += "  ";
        index += 1;
      } else if (character === "'") {
        state = "single";
        result += " ";
      } else if (character === '"') {
        state = "double";
        result += " ";
      } else if (character === "`") {
        state = "template";
        result += " ";
      } else {
        result += character;
      }
      continue;
    }
    if (state === "line") {
      if (character === "\n") {
        state = "code";
        result += "\n";
      } else {
        result += " ";
      }
      continue;
    }
    if (state === "block") {
      if (character === "*" && next === "/") {
        state = "code";
        result += "  ";
        index += 1;
      } else {
        result += character === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (state === "single" || state === "double") {
      if (character === "\\") {
        result += "  ";
        index += 1;
      } else if (
        (state === "single" && character === "'") ||
        (state === "double" && character === '"')
      ) {
        state = "code";
        result += " ";
      } else {
        result += " ";
      }
      continue;
    }
    if (state === "template") {
      if (character === "\\") {
        result += "  ";
        index += 1;
      } else if (character === "`") {
        state = "code";
        result += " ";
      } else {
        result += character === "\n" ? "\n" : " ";
      }
    }
  }
  return result;
}
