import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGraph } from "./graph.ts";
import { adjacency } from "./graph.ts";
import {
  cascadeProgress,
  hopDistances,
  nearestPoint,
  PULSE_MAX_HOPS,
  PULSE_STEP,
  pulseLevel,
} from "./pulse.ts";

describe("hopDistances", () => {
  it("cuenta saltos en un camino y deja -1 al desconectado", () => {
    // 0 - 1 - 2, y el nodo 3 suelto
    const neighbors = [[1], [0, 2], [1], []];
    const out = new Int16Array(4);
    const queue = new Uint16Array(4);
    const max = hopDistances(neighbors, 0, out, queue);
    assert.deepEqual([...out], [0, 1, 2, -1]);
    assert.equal(max, 2);
  });

  it("devuelve 0 cuando solo está el origen", () => {
    const neighbors = [[], [0], []];
    const out = new Int16Array(3);
    const queue = new Uint16Array(3);
    const max = hopDistances(neighbors, 2, out, queue);
    assert.equal(max, 0);
    assert.deepEqual([...out], [-1, -1, 0]);
  });

  it("reutiliza los buffers sin reallocar", () => {
    const graph = buildGraph(4);
    const neighbors = adjacency(graph);
    const out = new Int16Array(neighbors.length);
    const queue = new Uint16Array(neighbors.length);
    hopDistances(neighbors, 0, out, queue);
    const first = [...out];
    hopDistances(neighbors, 10, out, queue);
    assert.notDeepEqual([...out], first);
    assert.ok(out[10] === 0);
  });

  it("desde cada hub de buildGraph(10) llega a todos los nodos", () => {
    const graph = buildGraph(10);
    const neighbors = adjacency(graph);
    const out = new Int16Array(neighbors.length);
    const queue = new Uint16Array(neighbors.length);
    for (const cluster of graph.clusters) {
      hopDistances(neighbors, cluster.hub, out, queue);
      for (let i = 0; i < neighbors.length; i++) {
        assert.ok(out[i] >= 0, `nodo ${i} no llega desde hub ${cluster.hub}`);
      }
    }
  });
});

describe("nearestPoint", () => {
  it("elige el punto más cercano", () => {
    const xs = new Float32Array([0, 10, 20]);
    const ys = new Float32Array([0, 0, 0]);
    assert.equal(nearestPoint(xs, ys, 3, 12, 1), 1);
  });

  it("respeta count", () => {
    const xs = new Float32Array([0, 10, 1]);
    const ys = new Float32Array([0, 0, 0]);
    assert.equal(nearestPoint(xs, ys, 2, 0.5, 0), 0);
  });

  it("respeta maxDistance y devuelve -1 si no hay ninguno", () => {
    const xs = new Float32Array([0, 100]);
    const ys = new Float32Array([0, 0]);
    assert.equal(nearestPoint(xs, ys, 2, 10, 0, 5), -1);
    assert.equal(nearestPoint(xs, ys, 2, 10, 0, 50), 0);
    assert.equal(nearestPoint(xs, ys, 0, 0, 0), -1);
  });

  it("salta los no finitos", () => {
    const xs = new Float32Array([NaN, 5]);
    const ys = new Float32Array([0, 0]);
    assert.equal(nearestPoint(xs, ys, 2, 4, 0), 1);
    xs[1] = Infinity;
    assert.equal(nearestPoint(xs, ys, 2, 4, 0), -1);
  });
});

describe("pulseLevel", () => {
  it("es 0 antes de llegar y máximo al llegar", () => {
    assert.equal(pulseLevel(0.05, 1), 0);
    assert.ok(pulseLevel(1 * PULSE_STEP, 1) > pulseLevel(1 * PULSE_STEP + 0.2, 1));
    assert.ok(pulseLevel(1 * PULSE_STEP, 1) > 0);
  });

  it("cae después de llegar", () => {
    const arrival = pulseLevel(2 * PULSE_STEP, 2);
    assert.ok(pulseLevel(2 * PULSE_STEP + 0.3, 2) < arrival);
  });

  it("es más débil con más saltos", () => {
    for (const hops of [0, 1, 2, 3]) {
      assert.ok(pulseLevel(hops * PULSE_STEP, hops) > pulseLevel((hops + 1) * PULSE_STEP, hops + 1));
    }
  });

  it("es 0 más allá del alcance y para hops negativos", () => {
    assert.equal(pulseLevel(PULSE_MAX_HOPS * PULSE_STEP + 3, PULSE_MAX_HOPS + 1), 0);
    assert.equal(pulseLevel(1, -1), 0);
    assert.equal(pulseLevel(1, PULSE_MAX_HOPS + 1), 0);
  });
});

describe("cascadeProgress", () => {
  it("es -1 antes de salir y después de llegar", () => {
    assert.equal(cascadeProgress(0, 1), -1);
    assert.equal(cascadeProgress(PULSE_STEP * 2 + 0.01, 1), -1);
    assert.equal(cascadeProgress(PULSE_STEP * 1 + PULSE_STEP + 0.001, 1), -1);
  });

  it("va de 0 a 1 durante el salto", () => {
    assert.equal(cascadeProgress(PULSE_STEP, 1), 0);
    assert.equal(cascadeProgress(PULSE_STEP * 1.5, 1), 0.5);
    assert.equal(cascadeProgress(PULSE_STEP * 2, 1), 1);
  });
});
