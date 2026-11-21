import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RPS_MAX, RPS_MIN } from "./model.ts";
import { PACKET_CAPACITY, PACKET_SPEED, createPacketField, spawnRate } from "./packets.ts";
import { layoutTopology, routesFor } from "./topology.ts";
import type { NodeId, Route } from "./topology.ts";
import { PRESETS } from "./presets.ts";
import { initialState, measure } from "./model.ts";

const centers = Object.fromEntries(
  layoutTopology("wide").nodes.map((node) => [node.id, { x: node.cx, y: node.cy }]),
) as Record<NodeId, { x: number; y: number }>;

const routes = routesFor(PRESETS.resilient, measure(PRESETS.resilient, initialState()));

const liveCount = (field: ReturnType<typeof createPacketField>) =>
  field.kind.reduce((total, kind) => total + (kind > 0 ? 1 : 0), 0);

/** Distancia del punto al segmento ab. */
const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / len2, 0), 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

describe("createPacketField", () => {
  it("mismo seed y mismas llamadas dan los mismos arrays; otro seed difiere", () => {
    const a = createPacketField(42);
    const b = createPacketField(42);
    const c = createPacketField(43);
    for (let i = 0; i < 30; i++) {
      a.advance(0.05, routes, centers, 20);
      b.advance(0.05, routes, centers, 20);
      c.advance(0.05, routes, centers, 20);
    }
    assert.deepEqual(a.kind, b.kind);
    assert.deepEqual(a.x, b.x);
    assert.deepEqual(a.y, b.y);
    assert.ok(
      !(
        a.kind.every((kind, i) => kind === c.kind[i]) &&
        a.x.every((x, i) => x === c.x[i]) &&
        a.y.every((y, i) => y === c.y[i])
      ),
      "otro seed debería dar otra secuencia",
    );
  });

  it("sin rutas o con caudales en cero no spawnea nada", () => {
    const field = createPacketField(7);
    field.advance(0.1, [], centers, 1000);
    field.advance(0.1, [{ path: ["client", "api"], rate: 0, outcome: "ok" }], centers, 1000);
    assert.equal(liveCount(field), 0);
  });

  it("nunca supera la capacidad, ni con perSecond enorme", () => {
    const field = createPacketField(9);
    for (let i = 0; i < 30; i++) field.advance(0.1, routes, centers, 1e6);
    assert.ok(liveCount(field) <= field.capacity);
    assert.ok(liveCount(field) <= PACKET_CAPACITY);
  });

  it("con solo rutas fail todo paquete vivo es kind 2", () => {
    const field = createPacketField(11);
    const failRoutes: Route[] = [{ path: ["client", "api"], rate: 10, outcome: "fail" }];
    for (let i = 0; i < 10; i++) field.advance(0.1, failRoutes, centers, 20);
    assert.ok(liveCount(field) > 0);
    for (let i = 0; i < field.capacity; i++) {
      if (field.kind[i] > 0) assert.equal(field.kind[i], 2);
    }
  });

  it("en una ruta de dos nodos cada paquete queda a menos de 3.5 de la recta", () => {
    const field = createPacketField(13);
    const oneLeg: Route[] = [{ path: ["client", "api"], rate: 10, outcome: "ok" }];
    const a = centers.client;
    const b = centers.api;
    for (let i = 0; i < 15; i++) field.advance(0.1, oneLeg, centers, 20);
    assert.ok(liveCount(field) > 0);
    for (let i = 0; i < field.capacity; i++) {
      if (field.kind[i] === 0) continue;
      const d = distToSegment(field.x[i], field.y[i], a.x, a.y, b.x, b.y);
      assert.ok(d <= 3.5, `paquete ${i} a ${d} del segmento`);
    }
  });

  it("sin rutas los slots se liberan en length / (SPEED * 0.85) segundos", () => {
    const field = createPacketField(17);
    const long: Route[] = [{ path: ["client", "lb", "api", "cache", "db"], rate: 10, outcome: "ok" }];
    for (let i = 0; i < 10; i++) field.advance(0.1, long, centers, 30);
    assert.ok(liveCount(field) > 0);

    // Largo total del camino en unidades del viewBox
    let length = 0;
    const path = long[0].path;
    for (let i = 0; i + 1 < path.length; i++) {
      length += Math.hypot(centers[path[i + 1]].x - centers[path[i]].x, centers[path[i + 1]].y - centers[path[i]].y);
    }
    const budget = length / (PACKET_SPEED * 0.85) + 0.1; // + un paso de dt (0.1 s)

    let elapsed = 0;
    while (liveCount(field) > 0 && elapsed < budget + 1) {
      field.advance(0.1, [], centers, 0);
      elapsed += 0.1;
    }
    assert.equal(liveCount(field), 0);
    assert.ok(elapsed <= budget, `tardó ${elapsed}s, presupuesto ${budget}s`);
  });

  it("reset libera todo y el PRNG sigue su secuencia", () => {
    const field = createPacketField(19);
    for (let i = 0; i < 10; i++) field.advance(0.1, routes, centers, 20);
    assert.ok(liveCount(field) > 0);
    field.reset();
    assert.equal(liveCount(field), 0);
    // Sigue spawneando después del reset
    for (let i = 0; i < 10; i++) field.advance(0.1, routes, centers, 20);
    assert.ok(liveCount(field) > 0);
  });

  it("advance(10, …) no mueve más que SPEED * 1.15 * 0.1 más el offset", () => {
    const field = createPacketField(23);
    const oneLeg: Route[] = [{ path: ["client", "api"], rate: 10, outcome: "ok" }];
    field.advance(0.1, oneLeg, centers, 10);
    const i = field.kind.findIndex((kind) => kind > 0);
    assert.ok(i >= 0, "tenía que haber un paquete vivo");
    const x0 = field.x[i];
    const y0 = field.y[i];
    field.advance(10, oneLeg, centers, 0); // dt se acota a 0.1 s
    const moved = Math.hypot(field.x[i] - x0, field.y[i] - y0);
    const bound = PACKET_SPEED * 1.15 * 0.1 + 3; // velocidad máxima + offset perpendicular
    assert.ok(moved <= bound + 1e-3, `se movió ${moved}, límite ${bound}`);
  });
});

describe("spawnRate", () => {
  it("3 con RPS_MIN, 12 con RPS_MAX, lineal y acotado afuera", () => {
    assert.equal(spawnRate(RPS_MIN), 3);
    assert.equal(spawnRate(RPS_MAX), 12);
    assert.ok(spawnRate(0) === 3 && spawnRate(10_000) === 12);
    assert.ok(spawnRate(1025) > 3 && spawnRate(1025) < 12);
  });
});
