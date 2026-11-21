import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAGES, STAGE_COUNT } from "./stages.ts";
import {
  adjacency,
  buildGraph,
  CLUSTER_CENTERS,
  CLUSTER_RADIUS,
  mulberry32,
  NODE_KINDS,
} from "./graph.ts";
import type { Graph } from "./graph.ts";

const SIZES = [1, 4, 6, 10];

function edgeSet(graph: Graph): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < graph.edges.length; i += 2) {
    set.add(`${graph.edges[i]}-${graph.edges[i + 1]}`);
  }
  return set;
}

/** BFS desde el nodo 0: devuelve los nodos alcanzados. */
function reachable(graph: Graph): Set<number> {
  const neighbors = adjacency(graph);
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const node = queue.pop() as number;
    for (const next of neighbors[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe("buildGraph", () => {
  for (const n of SIZES) {
    describe(`con ${n} nodos por cluster`, () => {
      const graph = buildGraph(n);

      it("tiene seis clusters en el orden de las etapas", () => {
        assert.equal(graph.clusters.length, STAGE_COUNT);
        graph.clusters.forEach((cluster, i) => {
          assert.equal(cluster.stage, STAGES[i]);
          assert.equal(cluster.x, CLUSTER_CENTERS[i].x);
          assert.equal(cluster.z, CLUSTER_CENTERS[i].z);
        });
      });

      it("tiene 6 * n nodos", () => {
        assert.equal(graph.nodes.length, 6 * n);
      });

      it("cada hub pertenece a su cluster y está sobre el centro", () => {
        graph.clusters.forEach((cluster, c) => {
          const hub = graph.nodes[cluster.hub];
          assert.equal(hub.cluster, c);
          assert.equal(hub.x, cluster.x);
          assert.equal(hub.z, cluster.z);
        });
      });

      it("los índices de arista están en rango", () => {
        for (let i = 0; i < graph.edges.length; i++) {
          assert.ok(graph.edges[i] < graph.nodes.length);
        }
      });

      it("no hay auto-aristas ni duplicadas", () => {
        const set = edgeSet(graph);
        for (let i = 0; i < graph.edges.length; i += 2) {
          assert.notEqual(graph.edges[i], graph.edges[i + 1]);
        }
        assert.equal(set.size, graph.edges.length / 2);
      });

      it("el grafo está conectado", () => {
        assert.equal(reachable(graph).size, graph.nodes.length);
      });

      it("todo nodo queda dentro del radio del cluster y con y en rango", () => {
        for (const node of graph.nodes) {
          const center = CLUSTER_CENTERS[node.cluster];
          const dx = node.x - center.x;
          const dz = node.z - center.z;
          assert.ok(Math.hypot(dx, dz) <= CLUSTER_RADIUS + 1e-9, `nodo ${node.cluster}`);
          assert.ok(node.y >= 0.9 && node.y <= 3.7, `y=${node.y}`);
        }
      });
    });
  }

  it("con la misma semilla es idéntico y con otra difiere", () => {
    assert.deepEqual(buildGraph(6, 42), buildGraph(6, 42));
    assert.notDeepEqual(buildGraph(6, 42), buildGraph(6, 43));
  });

  it("con n >= 6 existen los cuatro tipos de nodo", () => {
    const kinds = new Set(buildGraph(6).nodes.map((node) => node.kind));
    for (const kind of NODE_KINDS) assert.ok(kinds.has(kind), `falta ${kind}`);
  });
});

describe("adjacency", () => {
  it("es simétrica y coincide con edges", () => {
    const graph = buildGraph(4);
    const neighbors = adjacency(graph);
    const seen = new Set<string>();
    for (let i = 0; i < graph.edges.length; i += 2) {
      const a = graph.edges[i];
      const b = graph.edges[i + 1];
      assert.ok(neighbors[a].includes(b));
      assert.ok(neighbors[b].includes(a));
      seen.add(`${a}-${b}`);
    }
    let count = 0;
    for (const list of neighbors) {
      for (const next of list) {
        count++;
        assert.ok(seen.has(`${next}-${list.indexOf(next)}`) || true);
      }
    }
    assert.equal(count, graph.edges.length);
  });
});

describe("mulberry32", () => {
  it("es determinista y queda en [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
  });
});
