# Rendering baseline

|          |                                                                                      |
| -------- | ------------------------------------------------------------------------------------ |
| Date     | 2026-10-26                                                                           |
| Machine  | Apple M2, macOS 27.2                                                                 |
| Runtime  | Node 24.11.1, Playwright 1.64.1, Chromium 156.0.8078.4                               |
| Dataset  | 100,000 synthetic 1m OHLC bars                                                       |
| Workload | Full fit, continuous pan of 0.01% of the visible span per frame, 179 measured frames |
| Result   | median 16.7 ms, p95 16.7 ms, 59.9 fps (vsync-limited)                                |
| Command  | `pnpm --filter @wicklib/playground test:visual -g "benchmark"`                       |

The chart renders the aggregated 100k-bar path every frame: about 736 canvas columns, each
aggregated from the visible bars. The benchmark runs through Playwright against the
production build, so it measures the same code path the app uses.

CI asserts `p95 < 50 ms`, leaving headroom for shared runners. The recorded local result is
the 60 fps target. Re-run the command after renderer changes and update this table if the
baseline moves.
