# RFC-0007: Series annotations and chart export

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted)

## 1. Context

Host applications need to annotate a series with horizontal price levels and time-aligned
markers, and need to export the rendered chart. These primitives are required for trade
journaling and notebook embeds and must not depend on drawings or pro packages.

## 2. Goals

- Add series-owned price lines with a live handle.
- Add replaceable series markers for buy/sell/event annotations.
- Support markers at bar-relative positions and explicit prices.
- Export the composited chart as a canvas or data URL.
- Keep rendering, hit-testing, and persistence out of these primitives.

## 3. Non-goals

- Marker dragging, editing, selection, or persistence.
- Tooltips or rich HTML marker labels.
- Multi-line labels, custom glyphs, or image markers.
- Export file downloads, server rendering, or PDF output.
- lightweight-charts option compatibility; that belongs in the host adapter.

## 4. Public API

```ts
interface PriceLineOptions {
  price: number;
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
  lineVisible?: boolean;
  axisLabelVisible?: boolean;
  title?: string;
}

interface PriceLineApi {
  applyOptions(options: Partial<PriceLineOptions>): void;
  remove(): void;
}

interface SeriesMarker {
  time: Time;
  position: "aboveBar" | "belowBar" | "inBar" | "atPriceTop" | "atPriceBottom" | "atPriceMiddle";
  shape?: "circle" | "square" | "arrowUp" | "arrowDown";
  color?: string;
  text?: string;
  size?: number;
  price?: number;
}

interface SeriesApi {
  createPriceLine(options: PriceLineOptions): PriceLineApi;
  setMarkers(markers: readonly SeriesMarker[]): void;
  takeScreenshot(): HTMLCanvasElement;
  exportImage(type?: string, quality?: number): string;
}
```

`SeriesApi.takeScreenshot()` / `exportImage()` are chart-level in the implementation and are
listed here only by their call sites. The chart API owns them.

## 5. Behavior

- Price lines default to visible, axis label visible, solid, width 1.
- Price line options are validated; invalid prices or widths throw `INVALID_ARGUMENT`.
- `applyOptions()` after `remove()` is a no-op.
- Markers replace the complete marker set; an empty array clears them.
- Marker times resolve to the nearest stored bar. Bar-relative markers use the bar high, low,
  or midpoint; price markers require a finite `price`.
- Markers are clipped to the pane plot and rendered above candles and indicators.
- Screenshots flush a pending frame, then composite grid, series, extensions, drawings, and
  the overlay layer at backing-store resolution.
- `exportImage()` defaults to PNG; quality is validated in `[0, 1]`.

## 6. Acceptance criteria

- Price lines can be created, updated, and removed without redrawing the chart manually.
- Markers can be replaced and cleared and reject missing prices for price positions.
- Screenshots contain every canvas layer.
- No new runtime dependencies and no changes to the extension license boundary.
