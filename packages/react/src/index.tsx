import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createChart, type ChartApi, type ChartOptions, type WickExtension } from "@wicklib/core";

const ChartContext = createContext<ChartApi | null | undefined>(undefined);

/**
 * Props for {@link WickChart}.
 *
 * Chart options are forwarded to {@link createChart}. Changes are applied with
 * `chart.setOptions()`; changing `extensions` recreates the chart because extensions are
 * snapshotted at creation.
 */
export interface WickChartProps extends ChartOptions {
  /** Class name applied to the wrapper element. */
  className?: string;
  /** Inline styles applied to the wrapper element. */
  style?: CSSProperties;
  /** Called with each chart instance created by this component. */
  onChart?: (chart: ChartApi) => void;
  /**
   * Overlay content rendered above the chart. Descendants can call {@link useChart} to
   * access the chart instance.
   */
  children?: ReactNode;
}

/**
 * Mounts a Wicklib chart and disposes it on unmount.
 *
 * Rendering is client-only: the chart is created in an effect, so server rendering emits
 * only the container. Give the wrapper a measurable size through `className` or `style`.
 *
 * @example
 * ```tsx
 * <WickChart style={{ height: 420 }} autoSize />
 * ```
 */
export function WickChart({
  className,
  style,
  onChart,
  children,
  ...options
}: WickChartProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartApi | null>(null);
  const optionsRef = useRef<ChartOptions>(options);
  const onChartRef = useRef(onChart);
  const [chart, setChart] = useState<ChartApi | null>(null);

  const { extensions, ...optionsPatch } = options;
  const extensionKey = extensionSignature(extensions);
  const optionsKey = JSON.stringify(optionsPatch);

  useEffect(() => {
    optionsRef.current = options;
    onChartRef.current = onChart;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const instance = createChart(container, optionsRef.current);
    chartRef.current = instance;
    setChart(instance);
    onChartRef.current?.(instance);

    return () => {
      if (chartRef.current === instance) {
        chartRef.current = null;
      }
      setChart((current) => (current === instance ? null : current));
      queueMicrotask(() => instance.destroy());
    };
  }, [extensionKey]);

  useEffect(() => {
    if (!chart || chartRef.current !== chart || optionsKey === "{}") {
      return;
    }
    chart.setOptions(optionsPatch);
  }, [chart, optionsKey]);

  return (
    <ChartContext.Provider value={chart}>
      <div className={className} style={{ position: "relative", ...style }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </ChartContext.Provider>
  );
}

/**
 * Returns the chart owned by the nearest {@link WickChart}.
 *
 * Returns `null` until the chart has mounted. Throws when used outside a `WickChart`.
 */
export function useChart(): ChartApi | null {
  const chart = useContext(ChartContext);
  if (chart === undefined) {
    throw new Error("useChart must be used within a <WickChart>");
  }
  return chart;
}

function extensionSignature(extensions: readonly WickExtension[] | undefined): string {
  if (!extensions || extensions.length === 0) {
    return "";
  }
  return extensions
    .map((extension) => `${extension.kind}:${extension.meta.id}@${extension.meta.version}`)
    .join("|");
}
