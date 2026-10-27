import { fail } from "./errors";
import {
  mergeDrawingOptions,
  resolveDrawingOptions,
  type ResolvedDrawingOptions,
} from "./drawings";
import type {
  DrawingAnchor,
  DrawingApi,
  DrawingOptions,
  DrawingToolDefinition,
  SerializedDrawing,
} from "./types";

export interface DrawingHost {
  assertAlive(): void;
  requestRender(): void;
  emitUpdated(drawing: Drawing): void;
  removeDrawing(drawing: Drawing): void;
}

export class Drawing implements DrawingApi {
  readonly id: string;
  readonly toolId: string;
  readonly paneId: string;
  readonly definition: DrawingToolDefinition;

  private anchors: DrawingAnchor[];
  private options: ResolvedDrawingOptions;
  private removed = false;

  constructor(
    id: string,
    paneId: string,
    definition: DrawingToolDefinition,
    anchors: readonly DrawingAnchor[],
    options: DrawingOptions | undefined,
    private readonly host: DrawingHost,
  ) {
    this.id = id;
    this.toolId = definition.id;
    this.paneId = paneId;
    this.definition = definition;
    this.anchors = validateAnchors(anchors, definition);
    this.options = resolveDrawingOptions(definition.defaultOptions, options);
  }

  getAnchors(): readonly DrawingAnchor[] {
    this.assertAlive();
    return this.anchors.map((anchor) => ({ ...anchor }));
  }

  setAnchors(anchors: readonly DrawingAnchor[]): void {
    this.assertAlive();
    this.anchors = validateAnchors(anchors, this.definition);
    this.host.emitUpdated(this);
    this.host.requestRender();
  }

  setOptions(options: Partial<DrawingOptions>): void {
    this.assertAlive();
    this.options = mergeDrawingOptions(this.options, options);
    this.host.emitUpdated(this);
    this.host.requestRender();
  }

  remove(): void {
    this.assertAlive();
    this.removed = true;
    this.host.removeDrawing(this);
  }

  destroyInternal(): void {
    this.removed = true;
  }

  isRemoved(): boolean {
    return this.removed;
  }

  isLocked(): boolean {
    return this.options.locked;
  }

  getOptions(): ResolvedDrawingOptions {
    return { ...this.options };
  }

  getAnchorsInternal(): readonly DrawingAnchor[] {
    return this.anchors;
  }

  toSerialized(): SerializedDrawing | null {
    if (this.definition.persist === false) {
      return null;
    }

    return {
      id: this.id,
      toolId: this.toolId,
      paneId: this.paneId,
      anchors: this.anchors.map((anchor) => ({ ...anchor })),
      options: { ...this.options },
    };
  }

  private assertAlive(): void {
    this.host.assertAlive();
    if (this.removed) {
      fail("DISPOSED", "Drawing is disposed");
    }
  }
}

function validateAnchors(
  anchors: readonly DrawingAnchor[],
  definition: DrawingToolDefinition,
): DrawingAnchor[] {
  if (anchors.length !== definition.anchors) {
    fail("INVALID_ARGUMENT", `${definition.meta.name} requires ${definition.anchors} anchors`);
  }

  return anchors.map((anchor) => {
    if (!Number.isFinite(anchor.time) || !Number.isFinite(anchor.price)) {
      fail("INVALID_ARGUMENT", "Drawing anchors must have finite time and price");
    }
    return { time: anchor.time, price: anchor.price };
  });
}
