/**
 * Qué tan pesada es la escena según el dispositivo, y cómo baja sola cuando los cuadros
 * tardan. Puro: los datos del navegador los junta `Background3D.svelte`.
 */

export interface QualityTier {
  name: "high" | "low";
  nodesPerCluster: number;
  packets: number;
  cascade: number;
  maxDpr: number;
  antialias: boolean;
  halos: boolean;
}

export const MAX_DPR = 2; // tope absoluto
export const MIN_DPR = 0.75;

export const TIERS: Record<"high" | "low", QualityTier> = {
  high: { name: "high", nodesPerCluster: 10, packets: 96, cascade: 96, maxDpr: 2, antialias: true, halos: true },
  low: { name: "low", nodesPerCluster: 6, packets: 40, cascade: 48, maxDpr: 1.5, antialias: false, halos: false },
};

export interface DeviceHints {
  width: number;
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
}

/** `low` si: ancho < 768, o puntero táctil, o deviceMemory <= 4, o hardwareConcurrency <= 4, o saveData. */
export function pickQuality(hints: DeviceHints): QualityTier {
  const low =
    hints.width < 768 ||
    hints.coarsePointer ||
    (hints.deviceMemory !== undefined && hints.deviceMemory <= 4) ||
    (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= 4) ||
    hints.saveData === true;
  return low ? TIERS.low : TIERS.high;
}

/** Niveles a los que baja la escena sola cuando los cuadros tardan. No vuelve a subir. */
export const LEVELS = [
  { dprScale: 1, packetScale: 1, halos: true },
  { dprScale: 0.75, packetScale: 1, halos: false },
  { dprScale: 0.5, packetScale: 0.5, halos: false },
] as const;

export const SLOW_FRAME_MS = 24;

/** Sube un nivel si el cuadro promedio supera el presupuesto; con tope en el último. */
export function nextLevel(level: number, averageFrameMs: number): number {
  if (averageFrameMs > SLOW_FRAME_MS) return Math.min(level + 1, LEVELS.length - 1);
  return level;
}

/**
 * Pixel ratio efectivo: el del dispositivo acotado por el tier y el tope, escalado por el
 * nivel de calidad y nunca por debajo de MIN_DPR ni por encima de MAX_DPR.
 */
export function effectiveDpr(devicePixelRatio: number, tier: QualityTier, level: number): number {
  const scale = LEVELS[level]?.dprScale ?? 1;
  return Math.max(MIN_DPR, Math.min(devicePixelRatio || 1, tier.maxDpr, MAX_DPR) * scale);
}

/** El nombre del renderer de WebGL dice que dibuja la CPU (SwiftShader, llvmpipe…): ahí la escena no va. */
export function isSoftwareRenderer(renderer: string | null | undefined): boolean {
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer ?? "");
}
