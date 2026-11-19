/**
 * Geometría de los medidores del stack: un medio dial (semicírculo) con una aguja y un tick por
 * unidad. TypeScript puro, sin DOM: devuelve coordenadas y paths para el SVG.
 */

/** Fracción del dial (0..1) que representa `value` sobre `max`. Entradas no válidas dan 0. */
export function gaugeFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

/**
 * Punto del semicírculo para una fracción: 0 es el extremo izquierdo, 0.5 arriba, 1 el derecho.
 */
export function polar(cx: number, cy: number, r: number, fraction: number): { x: number; y: number } {
  const angle = Math.PI * (1 - fraction);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Path `d` de un arco del dial entre dos fracciones (siempre recorrido hacia la derecha). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const start = polar(cx, cy, r, from);
  const end = polar(cx, cy, r, to);
  return `M ${round(start.x)} ${round(start.y)} A ${round(r)} ${round(r)} 0 0 1 ${round(end.x)} ${round(end.y)}`;
}

/** Fracción de cada unidad entera, con 0 y 1 incluidos. */
export function gaugeTicks(max: number): number[] {
  const units = Math.floor(max);
  if (!Number.isFinite(units) || units < 1) return [0, 1];
  const ticks: number[] = [];
  for (let i = 0; i <= units; i++) ticks.push(i / units);
  return ticks;
}
