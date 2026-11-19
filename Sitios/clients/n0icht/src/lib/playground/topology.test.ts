import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUEUE_CAPACITY, coldStart, initialState, measure, normalizeConfig, run } from "./model.ts";
import type { Config } from "./model.ts";
import { PRESETS } from "./presets.ts";
import { NODE_IDS, NODE_STATUSES, edgesFor, layoutTopology, nodeStatuses, routesFor } from "./topology.ts";
import type { Edge, NodeBox, Orientation } from "./topology.ts";

const s0 = initialState();
const m = (config: Config, state = s0) => measure(config, state);
const edgeKey = (edge: Edge) => `${edge.from}>${edge.to}`;

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} no está a ${eps} de ${b}`);

const overlap = (a: NodeBox, b: NodeBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("layoutTopology", () => {
  for (const orientation of ["wide", "tall"] as Orientation[]) {
    it(`en ${orientation}: 7 nodos en orden, dentro del lienzo y sin solapes`, () => {
      const layout = layoutTopology(orientation);
      assert.equal(layout.nodes.length, NODE_IDS.length);
      assert.deepEqual(
        layout.nodes.map((node) => node.id),
        [...NODE_IDS],
      );
      for (const node of layout.nodes) {
        assert.ok(node.x >= 0 && node.y >= 0, `${node.id} fuera por arriba/izquierda`);
        assert.ok(node.x + node.width <= layout.width && node.y + node.height <= layout.height, `${node.id} fuera del lienzo`);
        near(node.cx, node.x + node.width / 2);
        near(node.cy, node.y + node.height / 2);
      }
      for (let i = 0; i < layout.nodes.length; i++) {
        for (let j = i + 1; j < layout.nodes.length; j++) {
          assert.ok(!overlap(layout.nodes[i], layout.nodes[j]), `${layout.nodes[i].id} pisa a ${layout.nodes[j].id}`);
        }
      }
    });
  }

  it("wide es 688x260 y tall es 292x452 (angosto para 360px)", () => {
    const wide = layoutTopology("wide");
    assert.equal(wide.width, 688);
    assert.equal(wide.height, 260);
    const tall = layoutTopology("tall");
    assert.equal(tall.width, 292);
    assert.equal(tall.height, 452);
    assert.ok(tall.width <= 296);
  });
});

describe("nodeStatuses", () => {
  it("naive: lb, cache, queue y replica apagados; el resto ok", () => {
    assert.deepEqual(nodeStatuses(PRESETS.naive, m(PRESETS.naive)), {
      client: "ok",
      lb: "off",
      api: "ok",
      cache: "off",
      queue: "off",
      db: "ok",
      replica: "off",
    });
  });

  it("fallas y carga marcan down y hot", () => {
    assert.equal(nodeStatuses({ ...PRESETS.naive, dbDown: true }, m({ ...PRESETS.naive, dbDown: true })).db, "down");
    assert.equal(nodeStatuses({ ...PRESETS.naive, apiDown: true }, m({ ...PRESETS.naive, apiDown: true })).api, "down");

    const base: Config = { ...PRESETS.naive, loadBalancer: true, instances: 3, rps: 1000 };
    assert.equal(nodeStatuses(base, m(base)).db, "hot"); // dbLoad 1200/720 > 0.9

    const frio = coldStart(s0);
    assert.equal(nodeStatuses(PRESETS.resilient, m(PRESETS.resilient, frio)).cache, "cold");

    const lleno = run(PRESETS.spike, s0, 80);
    assert.equal(nodeStatuses(PRESETS.spike, m(PRESETS.spike, lleno)).queue, "hot");

    const resCaida = { ...PRESETS.resilient, dbDown: true };
    const s1 = run(resCaida, s0, 1);
    const statuses = nodeStatuses(resCaida, m(resCaida, s1));
    assert.equal(statuses.queue, "hot");
    assert.equal(statuses.db, "down");
    assert.equal(statuses.replica, "ok");
  });

  it("solo usa estados de NODE_STATUSES", () => {
    const combos = [
      PRESETS.naive,
      { ...PRESETS.resilient, dbDown: true },
      { ...PRESETS.spike, queue: true },
    ];
    for (const config of combos) {
      for (const status of Object.values(nodeStatuses(config, m(config)))) {
        assert.ok(NODE_STATUSES.includes(status), `estado desconocido ${status}`);
      }
    }
  });
});

describe("edgesFor", () => {
  it("naive es exactamente client->api y api->db", () => {
    assert.deepEqual(edgesFor(PRESETS.naive), [
      { from: "client", to: "api", kind: "request" },
      { from: "api", to: "db", kind: "request" },
    ]);
  });

  it("resilient tiene las 8 aristas del recorrido completo", () => {
    assert.deepEqual(edgesFor(PRESETS.resilient), [
      { from: "client", to: "lb", kind: "request" },
      { from: "lb", to: "api", kind: "request" },
      { from: "api", to: "cache", kind: "request" },
      { from: "cache", to: "db", kind: "request" },
      { from: "cache", to: "replica", kind: "request" },
      { from: "api", to: "queue", kind: "request" },
      { from: "queue", to: "db", kind: "async" },
      { from: "db", to: "replica", kind: "async" },
    ]);
  });

  it("sin duplicados en las 16 combinaciones de toggles", () => {
    for (let mask = 0; mask < 16; mask++) {
      const config: Config = {
        ...PRESETS.naive,
        cache: Boolean(mask & 1),
        loadBalancer: Boolean(mask & 2),
        queue: Boolean(mask & 4),
        replica: Boolean(mask & 8),
      };
      const keys = edgesFor(config).map((edge) => `${edge.from}>${edge.to}`);
      assert.equal(new Set(keys).size, keys.length, `duplicada en mask ${mask}`);
    }
  });
});

describe("routesFor", () => {
  it("cada par consecutivo es una arista, los caudales cierran y no hay rutas vacías", () => {
    const toggles: Config[] = [];
    for (let mask = 0; mask < 16; mask++) {
      toggles.push({
        ...PRESETS.naive,
        cache: Boolean(mask & 1),
        loadBalancer: Boolean(mask & 2),
        queue: Boolean(mask & 4),
        replica: Boolean(mask & 8),
      });
    }
    const states = [s0, coldStart(s0), { cacheWarmth: 1, backlog: QUEUE_CAPACITY }];
    const rpsList = [50, 500, 1200, 2000];

    for (const base of toggles) {
      for (const dbDown of [false, true]) {
        for (const apiDown of [false, true]) {
          for (const rps of rpsList) {
            for (const state of states) {
              const config: Config = normalizeConfig({ ...base, rps, dbDown, apiDown });
              const metrics = m(config, state);
              const edges = new Set(edgesFor(config).map((edge) => edgeKey(edge)));
              const routes = routesFor(config, metrics);
              const etiqueta = `${JSON.stringify({ rps, dbDown, apiDown, mask: toggles.indexOf(base) })}`;

              let noAsync = 0;
              let ok = 0;
              for (const route of routes) {
                assert.ok(route.rate > 0, `${etiqueta}: ruta sin caudal`);
                for (let i = 0; i + 1 < route.path.length; i++) {
                  const pair = `${route.path[i]}>${route.path[i + 1]}`;
                  assert.ok(edges.has(pair), `${etiqueta}: ${pair} no es arista de ${[...edges].join(",")}`);
                }
                if (route.outcome !== "async") noAsync += route.rate;
                if (route.outcome === "ok") ok += route.rate;
              }
              near(noAsync, rps, 1e-6);
              near(ok, metrics.throughput, 1e-6);
            }
          }
        }
      }
    }
  });
});
