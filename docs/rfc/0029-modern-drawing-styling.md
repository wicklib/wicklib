# RFC-0029: Modern drawing styling

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted), RFC-0028 (accepted)

## 1. Context

Several drawing tools need richer, modern presentation controls and the default price precision
should preserve cents for high-priced instruments.

## 2. Price precision

Automatic linear price precision now has a minimum of two decimal places. Explicit
`priceFormat.precision` and `priceFormat.minMove` still take precedence.

## 3. Position stats boxes

- Default `statsPosition` is center.
- Each stop/entry/profit stats box renders one horizontal line.
- Selected metrics are separated horizontally.
- `priceLabels` controls axis labels and stats boxes together.
- Rounded corners remain.

## 4. Freehand drawings

- Brush, highlighter, and path show selection handles only at endpoints.
- Added `lineOpacity`.

## 5. Parallel channel and regression trend

Channel and regression lines gain top, middle, and bottom appearance settings:

- `topLineColor`, `topLineWidth`, `topLineStyle`
- `middleLineColor`, `middleLineWidth`, `middleLineStyle`, `middleLineVisible`
- `bottomLineColor`, `bottomLineWidth`, `bottomLineStyle`
- `channelBackgroundVisible`
- Existing `fillColor`, `fillOpacity`, `extendLeft`, and `extendRight`

Parallel channel no longer draws left/right vertical borders. It draws top, middle (default
enabled), and bottom lines, with background disabled by default. Regression trend uses the same
line settings and has a full-range selection hit area.

## 6. Fibonacci levels

Fib retracement and extension accept `fibLevels` with per-level ratio, visibility, color, width,
style, label visibility, and label color. `fibBackgroundVisible`, `extendLeft`, and
`extendRight` complete the style controls. Default level ratios remain unchanged.

## 7. Price/time ranges

Price Range uses only top/bottom lines. Time Range uses only left/right lines. Both keep fill
backgrounds and existing range options.

## 8. Text drawing

Text drawings support `fontFamily`, size, text style, alignment, background color/opacity,
border color/width, border radius, and padding. Hit testing uses the styled bounds.

## 9. Acceptance criteria

- Existing drawings without new options keep prior defaults except the modern range border and
  minimum cents precision.
- Channel and regression line settings render independently.
- Custom Fibonacci levels drive rendering and hit testing.
- Text and freehand style options resolve and render correctly.
- Price labels show at least two decimals unless explicitly overridden.
