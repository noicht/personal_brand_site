/**
 * Matemática pura de la cámara del fondo 3D: dónde está la "línea de lectura" dentro de una
 * sección, la posición sobre el recorrido de las seis etapas, la spline Catmull-Rom entre las
 * paradas y una amortiguación que no depende de los fps. No toca el DOM ni three.
 */
import { STAGE_COUNT } from "./stages.ts";

/** Acota `value` al rango [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Curva suave 0..1 -> 0..1 (x*x*(3-2x)), con la entrada acotada. */
export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Cuánto recorrió la línea de lectura dentro de una región: 0 arriba, 1 abajo.
 * `height <= 0` da 0.
 */
export function alongRegion(line: number, top: number, height: number): number {
  if (height <= 0) return 0;
  return clamp((line - top) / height, 0, 1);
}

/**
 * Posición sobre el recorrido. En el medio de la región de la etapa i vale i; en el borde con
 * la siguiente, i + 0.5.
 */
export function stagePosition(stage: number, along: number, count = STAGE_COUNT): number {
  return clamp(stage + clamp(along, 0, 1) - 0.5, 0, count - 1);
}

/** Sin anclas: el progreso de toda la página (0 a 1) repartido entre las etapas. No finito da 0. */
export function stageFromProgress(progress: number, count = STAGE_COUNT): number {
  if (!Number.isFinite(progress)) return 0;
  return clamp(progress, 0, 1) * (count - 1);
}

/** Cluster destacado: el más cercano a la posición. No finito da 0. */
export function clusterAt(position: number, count = STAGE_COUNT): number {
  if (!Number.isFinite(position)) return 0;
  return clamp(Math.round(position), 0, count - 1);
}

/** Peso con que se destaca un cluster: 1 en su parada, 0 a una etapa de distancia. */
export function clusterWeight(position: number, cluster: number): number {
  return smoothstep(1 - Math.abs(position - cluster));
}

/** Acerca `current` a `target`; el resultado no depende de los fps. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Una pose de cámara: posición y punto al que mira. */
export interface CameraPose {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
}

/** Una parada por cluster: la cámara queda a un costado y arriba, mirando al centro. */
export function waypointsFor(centers: readonly { x: number; z: number }[]): CameraPose[] {
  return centers.map((center, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return { px: center.x + side * 4, py: 9, pz: center.z + 17, tx: center.x, ty: 1.2, tz: center.z };
  });
}

/** Un componente de la spline Catmull-Rom uniforme entre cuatro puntos de control. */
function spline(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

/**
 * Pose en una posición del recorrido: spline Catmull-Rom uniforme por las paradas.
 * Escribe en `out` y lo devuelve.
 */
export function cameraPoseAt(
  position: number,
  waypoints: readonly CameraPose[],
  out: CameraPose,
  distance = 1,
): CameraPose {
  const n = waypoints.length;
  if (n === 0) {
    out.px = out.py = out.pz = out.tx = out.ty = out.tz = 0;
    return out;
  }

  const p = clamp(position, 0, n - 1);
  if (n === 1) {
    const w = waypoints[0];
    out.px = w.px;
    out.py = w.py;
    out.pz = w.pz;
    out.tx = w.tx;
    out.ty = w.ty;
    out.tz = w.tz;
  } else {
    const i = Math.min(Math.floor(p), n - 2);
    const t = p - i;
    const w0 = waypoints[Math.max(i - 1, 0)];
    const w1 = waypoints[i];
    const w2 = waypoints[i + 1];
    const w3 = waypoints[Math.min(i + 2, n - 1)];
    out.px = spline(w0.px, w1.px, w2.px, w3.px, t);
    out.py = spline(w0.py, w1.py, w2.py, w3.py, t);
    out.pz = spline(w0.pz, w1.pz, w2.pz, w3.pz, t);
    out.tx = spline(w0.tx, w1.tx, w2.tx, w3.tx, t);
    out.ty = spline(w0.ty, w1.ty, w2.ty, w3.ty, t);
    out.tz = spline(w0.tz, w1.tz, w2.tz, w3.tz, t);
  }

  // `distance` aleja la cámara del objetivo en vertical (pantallas angostas): el target no se mueve
  out.px = out.tx + (out.px - out.tx) * distance;
  out.py = out.ty + (out.py - out.ty) * distance;
  out.pz = out.tz + (out.pz - out.tz) * distance;
  return out;
}

/** En vertical la cámara retrocede para que el cluster entre en el ancho. */
export function distanceForAspect(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return clamp(1.2 / aspect, 1, 2);
}

/** Pose fija para movimiento reducido. */
export const STILL_POSE: CameraPose = { px: -12, py: 12, pz: 20, tx: 22, ty: 0, tz: -7 };

export const FOG_NEAR = 24;
export const FOG_FAR = 74;
