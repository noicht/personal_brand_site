/**
 * La onda de un pulso (el click o `deploy --prod`) sobre el grafo: cuántos saltos tarda en
 * llegar a cada nodo, el brillo de la onda en cada uno y el avance de los paquetes de la
 * cascada. Puro: los buffers los presta quien llama.
 */

export const PULSE_STEP = 0.14; // segundos que tarda la onda en cada salto
export const PULSE_DECAY = 0.45; // segundos en que cae el brillo de un nodo
export const PULSE_MAX_HOPS = 7;

/**
 * Saltos desde `origin` a cada nodo (BFS). Escribe en `out` (-1 = no llega) y devuelve el
 * máximo. `queue` es un buffer reutilizable (largo >= nodos).
 */
export function hopDistances(
  neighbors: readonly (readonly number[])[],
  origin: number,
  out: Int16Array,
  queue: Uint16Array,
): number {
  const count = neighbors.length;
  out.fill(-1, 0, count);

  let head = 0;
  let tail = 0;
  queue[tail++] = origin;
  out[origin] = 0;
  let max = 0;

  while (head < tail) {
    const node = queue[head++];
    const hops = out[node] + 1;
    const list = neighbors[node];
    for (let i = 0; i < list.length; i++) {
      const next = list[i];
      if (out[next] === -1) {
        out[next] = hops;
        queue[tail++] = next;
        if (hops > max) max = hops;
      }
    }
  }
  return max;
}

/**
 * Índice del punto más cercano a (x, y) entre los primeros `count`; -1 si no hay ninguno a
 * menos de `maxDistance`. Ignora los no finitos.
 */
export function nearestPoint(
  xs: Float32Array,
  ys: Float32Array,
  count: number,
  x: number,
  y: number,
  maxDistance = Infinity,
): number {
  const limit = maxDistance * maxDistance;
  let best = -1;
  let bestDist = limit;
  for (let i = 0; i < count; i++) {
    const px = xs[i];
    const py = ys[i];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const dx = px - x;
    const dy = py - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Brillo de la onda en un nodo: 0 antes de llegar, máximo al llegar, después cae. */
export function pulseLevel(elapsed: number, hops: number): number {
  if (hops < 0 || hops > PULSE_MAX_HOPS) return 0;
  const t = elapsed - hops * PULSE_STEP;
  if (t < 0) return 0;
  return Math.exp(-t / PULSE_DECAY) * (1 - hops / (PULSE_MAX_HOPS + 1));
}

/** Avance (0 a 1) del paquete de la cascada que sale en el salto `hops`; -1 si no salió o ya llegó. */
export function cascadeProgress(elapsed: number, hops: number): number {
  const t = (elapsed - hops * PULSE_STEP) / PULSE_STEP;
  if (t < 0 || t > 1) return -1;
  return t;
}
