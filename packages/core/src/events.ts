import { fail, WickError } from "./errors";
import type { ChartErrorEvent, ChartEventMap, Unsubscribe } from "./types";

type AnyHandler = (payload: unknown) => void;

/**
 * Type-safe event bus with listener isolation.
 *
 * A throwing listener cannot break other listeners or the renderer. Its error is
 * surfaced through the `error` event; a throwing `error` listener is swallowed.
 */
export class EventBus {
  private readonly listeners = new Map<keyof ChartEventMap, Set<AnyHandler>>();
  private disposed = false;

  on<K extends keyof ChartEventMap>(
    event: K,
    handler: (payload: ChartEventMap[K]) => void,
  ): Unsubscribe {
    if (this.disposed) {
      fail("DISPOSED", "Chart is disposed");
    }

    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    const stored = handler as AnyHandler;
    set.add(stored);

    return () => {
      set.delete(stored);
    };
  }

  emit<K extends keyof ChartEventMap>(
    event: K,
    payload: ChartEventMap[K],
    source: ChartErrorEvent["source"] = "chart",
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) {
      return;
    }

    for (const handler of Array.from(set)) {
      try {
        (handler as (value: ChartEventMap[K]) => void)(payload);
      } catch (cause) {
        if (event === "error") {
          continue;
        }
        this.reportListenerError(source, cause);
      }
    }
  }

  private reportListenerError(source: ChartErrorEvent["source"], cause: unknown): void {
    const errorSet = this.listeners.get("error");
    if (!errorSet || errorSet.size === 0) {
      return;
    }

    const error =
      cause instanceof WickError
        ? cause
        : new WickError("INVALID_ARGUMENT", "Event listener threw", {
            cause: String(cause),
          });

    const payload: ChartErrorEvent = { error, source };

    for (const handler of Array.from(errorSet)) {
      try {
        (handler as (value: ChartErrorEvent) => void)(payload);
      } catch {
        // A throwing error listener is swallowed to avoid recursion.
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.clear();
  }
}
