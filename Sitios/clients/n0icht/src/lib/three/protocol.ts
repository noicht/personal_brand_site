/**
 * Los mensajes entre `Background3D.svelte` (hilo principal) y `scene.worker.ts`
 * (worker con OffscreenCanvas). Solo tipos: el protocolo se comparte por `postMessage`.
 */
import type { QualityTier } from "./quality.ts";
import type { Palette, SceneStats } from "./scene.ts";

export type SceneState = "live" | "still" | "fallback";
export type FallbackReason = "no-webgl2" | "software" | "context-lost" | "error";

export interface InitMessage {
  type: "init";
  canvas: OffscreenCanvas;
  tier: QualityTier;
  palette: Palette;
  still: boolean;
  hover: boolean;
  /** `?debug3d`: el worker manda `stats` y acepta `debug-lose-context`. */
  debug: boolean;
  /** Tamaño del canvas en px de CSS y pixel ratio del dispositivo. */
  width: number;
  height: number;
  dpr: number;
  running: boolean;
  /** Posición sobre el recorrido (0..5). */
  stage: number;
}

export type ToWorker =
  | InitMessage
  | { type: "resize"; width: number; height: number; dpr: number }
  | { type: "running"; value: boolean }
  | { type: "still"; value: boolean }
  | { type: "pointer"; x: number; y: number; inside: boolean }
  | { type: "stage"; position: number }
  | { type: "pulse-at"; x: number; y: number }
  | { type: "pulse-stage"; stage: number }
  | { type: "invalidate" }
  | { type: "debug-lose-context" }
  | { type: "dispose" };

export type FromWorker =
  | { type: "status"; status: SceneState; reason?: FallbackReason }
  | { type: "stats"; stats: SceneStats };
