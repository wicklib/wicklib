/**
 * Copies only defined keys from `patch` onto a copy of `base`.
 *
 * This keeps `exactOptionalPropertyTypes` honest: an explicit `undefined` never erases a
 * default.
 */
export function mergeDefined<T extends object>(base: T, patch: Partial<T> | undefined): T {
  const result: T = { ...base };
  if (!patch) {
    return result;
  }

  for (const key of Object.keys(patch) as Array<keyof T>) {
    const value = patch[key];
    if (value !== undefined) {
      (result as Record<string, unknown>)[key as string] = value;
    }
  }

  return result;
}

export function scheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(() => {
      callback();
    });
  }
  return setTimeout(callback, 16) as unknown as number;
}

export function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  }
}
