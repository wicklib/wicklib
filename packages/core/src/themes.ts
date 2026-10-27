/**
 * Visual tokens shared by chart chrome. Series and drawing colors are intentionally not
 * part of a theme.
 */
export interface ChartTheme {
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

/**
 * Neutral light chart theme.
 */
export const LightTheme: ChartTheme = Object.freeze({
  layout: Object.freeze({
    background: "#ffffff",
    textColor: "#131722",
  }),
  grid: Object.freeze({
    vertLines: Object.freeze({ color: "#eef0f3" }),
    horzLines: Object.freeze({ color: "#eef0f3" }),
  }),
  crosshair: Object.freeze({
    color: "#9598a1",
    labelBackground: "#131722",
  }),
});

/**
 * Neutral dark chart theme.
 */
export const DarkTheme: ChartTheme = Object.freeze({
  layout: Object.freeze({
    background: "#0b0e14",
    textColor: "#d1d4dc",
  }),
  grid: Object.freeze({
    vertLines: Object.freeze({ color: "#161b24" }),
    horzLines: Object.freeze({ color: "#161b24" }),
  }),
  crosshair: Object.freeze({
    color: "#9598a1",
    labelBackground: "#2a2e39",
  }),
});

/**
 * Named neutral presets for hosts that switch themes dynamically.
 */
export const ChartThemes: Readonly<{ light: ChartTheme; dark: ChartTheme }> = Object.freeze({
  light: LightTheme,
  dark: DarkTheme,
});
