import { fail } from "./errors";
import type { Feature, LicenseContext } from "./types";

/**
 * Throws `WickError("LICENSE_REQUIRED")` when the active license does not grant the
 * feature. Commercial extensions call this before enabling a paid capability.
 */
export function assertFeature(context: LicenseContext, feature: Feature): void {
  if (!context.hasFeature(feature)) {
    fail("LICENSE_REQUIRED", `License does not grant feature: ${feature}`, { feature });
  }
}
