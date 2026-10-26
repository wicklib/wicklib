/**
 * Wicklib built-in indicator catalog.
 *
 * Phase 1 only reserves the package and freezes the boundary. Implementations are
 * deferred; when they land they will be authored in WickTS from day one.
 *
 * @packageDocumentation
 */

/**
 * Descriptor for a built-in indicator.
 */
export interface IndicatorDescriptor {
  /** Stable identifier, for example `sma`. */
  id: string;
  /** Human-readable name. */
  name: string;
}

/**
 * Marks the catalog as deferred during Phase 1.
 */
export const INDICATORS_DEFERRED = true;
