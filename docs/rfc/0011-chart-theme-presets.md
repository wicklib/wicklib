# RFC-0011: Chart theme presets

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted)

## 1. Context

Hosts currently repeat chart chrome colors because the playground's light and dark styles are
local. A shared neutral contract gives consumers a reliable starting point without making the
library responsible for product branding or system theme detection.

## 2. Goals

- Define a small typed theme contract for chart chrome.
- Ship neutral light and dark presets.
- Keep application, persistence, and switching under host control.
- Support creation and runtime switching through normal chart options.

## 3. Non-goals

- Reading CSS variables, Tailwind classes, or `prefers-color-scheme`.
- Automatic theme switching.
- Brand-specific themes.
- Series candle colors, drawing colors, or indicator colors.
- A separate theming package or runtime.

## 4. Public API

```ts
interface ChartTheme {
  readonly layout: {
    readonly background: string;
    readonly textColor: string;
  };
  readonly grid: {
    readonly vertLines: { readonly color: string };
    readonly horzLines: { readonly color: string };
  };
  readonly crosshair: {
    readonly color: string;
    readonly labelBackground: string;
  };
}

const LightTheme: ChartTheme;
const DarkTheme: ChartTheme;
const ChartThemes: Readonly<{ light: ChartTheme; dark: ChartTheme }>;
```

## 5. Behavior

- Presets are immutable values.
- Hosts spread a preset into `createChart` or pass it to `setOptions`.
- A theme contains only chart chrome tokens. Market-semantic candle colors remain series
  options.
- Hosts may override any token after spreading a preset.
- Presets match the existing neutral playground palette.

## 6. Acceptance criteria

- Light and dark presets are exported and frozen.
- Both can be applied at creation and switched at runtime.
- No CSS or media-query access exists in core.
- Playground uses the presets instead of duplicating colors.
