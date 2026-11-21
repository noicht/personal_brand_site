/**
 * Paquetes del diagrama: puntos que viajan por las rutas del playground. Es el único módulo con
 * azar (PRNG con seed de `three/graph.ts`): el modelo es determinista, el dibujo no necesita
 * serlo, solo reproducible con el mismo seed y la misma secuencia de llamadas.
 *
 * Un `PacketField` son `capacity` slots en typed arrays (kind/x/y públicos, el resto interno):
 * `advance` no reserva memoria — mueve los vivos por su ruta (pierna a pierna entre centros de nodo,
 * con un offset perpendicular fijo en [-3, 3] para que no se solapen), libera al que termina y
 * después spawnea `perSecond * dt` unidades eligiendo ruta proporcional al caudal.
 */
import { mulberry32 } from "../three/graph.ts";
import { RPS_MAX, RPS_MIN } from "./model.ts";
import type { NodeId, Route } from "./topology.ts";

export const PACKET_CAPACITY = 48;
/** Unidades del viewBox por segundo. */
export const PACKET_SPEED = 240;

export interface Point {
  x: number;
  y: number;
}

export interface PacketField {
  readonly capacity: number;
  /** 0 libre; 1 ok; 2 fail; 3 async. */
  readonly kind: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Libera todo (cambió la topología); el PRNG sigue su secuencia. */
  reset(): void;
  advance(
    dt: number,
    routes: readonly Route[],
    centers: Readonly<Record<NodeId, Point>>,
    perSecond: number,
  ): void;
}

/** Paquetes por segundo que se dibujan: 3 con RPS_MIN, 12 con RPS_MAX, lineal y acotado. */
export function spawnRate(rps: number): number {
  if (!Number.isFinite(rps)) return 3;
  const clamped = Math.min(Math.max(rps, RPS_MIN), RPS_MAX);
  return 3 + ((clamped - RPS_MIN) / (RPS_MAX - RPS_MIN)) * 9;
}

const KIND_OF: Record<Route["outcome"], number> = { ok: 1, fail: 2, async: 3 };

/** Largo de la pierna `leg` de una ruta (0 si falta un centro). */
function legLength(route: Route, leg: number, centers: Readonly<Record<NodeId, Point>>): number {
  const a = centers[route.path[leg]];
  const b = centers[route.path[leg + 1]];
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Posición del slot: punto sobre la pierna actual más el offset perpendicular. */
function place(
  route: Route,
  leg: number,
  dist: number,
  offset: number,
  centers: Readonly<Record<NodeId, Point>>,
  out: { x: number; y: number },
): void {
  const a = centers[route.path[leg]];
  const b = centers[route.path[leg + 1]];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  out.x = a.x + ux * dist - uy * offset;
  out.y = a.y + uy * dist + ux * offset;
}

export function createPacketField(seed: number, capacity: number = PACKET_CAPACITY): PacketField {
  const rand = mulberry32(seed);
  const size = Math.max(1, Math.floor(capacity));

  const kind = new Uint8Array(size);
  const x = new Float32Array(size);
  const y = new Float32Array(size);
  const routes: (Route | null)[] = new Array(size).fill(null);
  const legIndex = new Uint8Array(size);
  const dist = new Float32Array(size);
  const speed = new Float32Array(size);
  const offset = new Float32Array(size);
  const pos = { x: 0, y: 0 };
  let acc = 0;

  function spawnOne(route: Route, centers: Readonly<Record<NodeId, Point>>): void {
    let slot = -1;
    for (let i = 0; i < size; i++) {
      if (kind[i] === 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return; // sin slot libre: se descarta la unidad
    const u = rand();
    speed[slot] = PACKET_SPEED * (0.85 + 0.3 * u);
    offset[slot] = (rand() * 2 - 1) * 3;
    routes[slot] = route;
    legIndex[slot] = 0;
    dist[slot] = 0;
    kind[slot] = KIND_OF[route.outcome];
    place(route, 0, 0, offset[slot], centers, pos);
    x[slot] = pos.x;
    y[slot] = pos.y;
  }

  function advance(
    dt: number,
    routeList: readonly Route[],
    centers: Readonly<Record<NodeId, Point>>,
    perSecond: number,
  ): void {
    const step = Math.min(Math.max(dt, 0), 0.1);

    // Mover los vivos a lo largo de su ruta
    for (let i = 0; i < size; i++) {
      const route = routes[i];
      if (kind[i] === 0 || !route || route.path.length < 2) continue;
      const last = route.path.length - 2;
      let d = dist[i] + speed[i] * step;
      let leg = legIndex[i];
      while (leg < last) {
        const len = legLength(route, leg, centers);
        if (d < len) break;
        d -= len;
        leg++;
      }
      if (leg === last && d >= legLength(route, leg, centers)) {
        kind[i] = 0;
        routes[i] = null;
        continue;
      }
      legIndex[i] = leg;
      dist[i] = d;
      place(route, leg, d, offset[i], centers, pos);
      x[i] = pos.x;
      y[i] = pos.y;
    }

    // Spawn: acc acumula fracciones; cada unidad entera elige ruta ∝ caudal
    acc += perSecond * step;
    const whole = Math.floor(acc);
    if (whole <= 0) return;
    acc -= whole;

    let total = 0;
    for (const route of routeList) if (route.rate > 0) total += route.rate;
    if (routeList.length === 0 || total <= 0) {
      acc = 0;
      return;
    }

    let free = 0;
    for (let i = 0; i < size; i++) if (kind[i] === 0) free++;
    const toSpawn = Math.min(whole, free);

    for (let n = 0; n < toSpawn; n++) {
      let pick = rand() * total;
      let chosen = routeList[routeList.length - 1];
      for (const route of routeList) {
        if (route.rate <= 0) continue;
        pick -= route.rate;
        if (pick <= 0) {
          chosen = route;
          break;
        }
      }
      spawnOne(chosen, centers);
    }
  }

  function reset(): void {
    kind.fill(0);
    for (let i = 0; i < size; i++) routes[i] = null;
    acc = 0;
  }

  return { capacity: size, kind, x, y, reset, advance };
}
