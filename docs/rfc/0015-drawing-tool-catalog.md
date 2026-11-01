# RFC-0015: Drawing tool catalog

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted), RFC-0014 (accepted)

## 1. Context

Hosts need to build drawing menus and settings forms without hardcoding every built-in id,
category, and capability matrix. Core already exposes tool tokens and
`drawingToolSettings()`, but not a stable catalog.

## 2. Goals

- Expose every built-in tool in a stable, menu-ready list.
- Provide category grouping and the applicable settings for each tool.
- Keep labels, icons, localization, permissions, and presentation in the host.
- Avoid duplicating capability data in host applications.

## 3. Non-goals

- Built-in icons, menus, toolbars, or styling.
- User-customizable tool ordering.
- Custom tool registration through the catalog.
- Licensing decisions for individual tools.

## 4. Public API

```ts
type DrawingToolCategory =
  | "lines"
  | "channels"
  | "fibonacci"
  | "shapes"
  | "positions"
  | "ranges"
  | "patterns"
  | "freehand"
  | "text"
  | "measurement";

interface DrawingToolCatalogEntry {
  readonly definition: DrawingToolDefinition;
  readonly category: DrawingToolCategory;
  readonly settings: readonly DrawingSetting[];
}

const DRAWING_TOOL_CATALOG: readonly DrawingToolCatalogEntry[];
```

## 5. Behavior

- Catalog order is the built-in menu order.
- `definition.meta.name` is the default human-readable label.
- `settings` is the same capability matrix returned by `drawingToolSettings()`.
- Categories are stable grouping keys, not localized labels.
- Hosts may filter the catalog by license, plan, context, or their own preferences.

## 6. Acceptance criteria

- Every built-in tool appears exactly once.
- Elliott tools are grouped under `patterns` and do not expose text settings.
- Text and freehand tools expose their correct capability sets.
- The catalog remains independent of any rendered menu.
