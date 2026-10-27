import { useEffect, useRef } from "react";
import type { ChartApi, ChartOptions } from "@wicklib/core";

/**
 * Props for {@link WickChart}.
 */
export interface WickChartProps extends ChartOptions {
  className?: string;
}

/**
 * Declarative chart mount. Phase 1 renders an empty container.
 */
export function WickChart({ className }: WickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void containerRef.current;
  }, []);

  return <div ref={containerRef} className={className} />;
}

/**
 * Returns the chart owned by the nearest {@link WickChart}, once implemented.
 */
export function useChart(_options?: ChartOptions): ChartApi | null {
  return null;
}
