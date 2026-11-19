/**
 * La topología que dibuja el diagrama del playground: dónde va cada nodo, cómo está cada uno,
 * qué aristas existen según la config y qué rutas (con caudal y resultado) lleva el tráfico.
 * TypeScript puro, sin DOM: lo usa `PlaygroundDiagram.svelte` y los tests.
 *
 * Los 7 nodos siempre tienen caja (los apagados se dibujan como fantasmas). La grilla lógica es
 * [col, row]: client [0,1], lb [1,1], api [2,1], cache [3,0], queue [3,2], replica [4,0],
 * db [4,1] — el carril de arriba son las lecturas, el de abajo las escrituras.
 */
import type { Config, Metrics } from "./model.ts";
import { HOT_LOAD, LAG_WARN_S } from "./model.ts";

export const NODE_IDS = ["client", "lb", "api", "cache", "queue", "db", "replica"] as const;
export type NodeId = (typeof NODE_IDS)[number];
export const NODE_STATUSES = ["ok", "hot", "cold", "down", "off"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];
export type Orientation = "wide" | "tall";

export interface NodeBox {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface TopologyLayout {
  width: number;
  height: number;
  nodes: NodeBox[]; // los 7 nodos, en el orden de NODE_IDS
}

export interface Edge {
  from: NodeId;
  to: NodeId;
  kind: "request" | "async";
}

export interface Route {
  path: NodeId[];
  rate: number;
  outcome: "ok" | "fail" | "async";
}

/** Celda lógica [col, row] de cada nodo. */
const CELLS: Record<NodeId, readonly [number, number]> = {
  client: [0, 1],
  lb: [1, 1],
  api: [2, 1],
  cache: [3, 0],
  queue: [3, 2],
  replica: [4, 0],
  db: [4, 1],
};

/**
 * Posiciones de los nodos para una orientación. No depende de la config:
 * - `wide` (horizontal): nodo 112x60, paso de columna 140, de fila 92, padding 8 → 688x260.
 * - `tall` (vertical, la de un teléfono de 360px): transpuesta, nodo 88x60, paso x 98, y 96,
 *   padding 4 → 292x452 (el ancho queda ≤ 296).
 */
export function layoutTopology(orientation: Orientation): TopologyLayout {
  if (orientation === "tall") {
    const width = 292;
    const height = 452;
    const nodes = NODE_IDS.map((id) => {
      const [col, row] = CELLS[id];
      const x = row * 98 + 4;
      const y = col * 96 + 4;
      return { id, x, y, width: 88, height: 60, cx: x + 44, cy: y + 30 };
    });
    return { width, height, nodes };
  }
  const width = 688;
  const height = 260;
  const nodes = NODE_IDS.map((id) => {
    const [col, row] = CELLS[id];
    const x = col * 140 + 8;
    const y = row * 92 + 8;
    return { id, x, y, width: 112, height: 60, cx: x + 56, cy: y + 30 };
  });
  return { width, height, nodes };
}

/** Estado visual de cada nodo según la config y las métricas del instante. */
export function nodeStatuses(config: Config, metrics: Metrics): Record<NodeId, NodeStatus> {
  const load = metrics.dbLoad ?? 0;
  return {
    client: "ok",
    lb: config.loadBalancer ? "ok" : "off",
    api:
      metrics.apiAlive === 0 ? "down" : (metrics.apiLoad ?? 0) > HOT_LOAD ? "hot" : "ok",
    cache: !config.cache
      ? "off"
      : metrics.hitRatio < config.cacheHitRatio
        ? "cold"
        : "ok",
    queue: !config.queue
      ? "off"
      : metrics.queueFull || metrics.queueLag === null || metrics.queueLag > LAG_WARN_S
        ? "hot"
        : "ok",
    db: config.dbDown ? "down" : load > HOT_LOAD ? "hot" : "ok",
    replica: !config.replica ? "off" : load > HOT_LOAD ? "hot" : "ok",
  };
}

/**
 * Aristas del grafo, deduplicadas y en orden fijo: entrada (con o sin balanceador), caché,
 * lecturas a la base (el origen S es la caché si está, si no la API), escrituras (cola o
 * directo) y la replicación asincrónica primario -> réplica.
 */
export function edgesFor(config: Config): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const add = (from: NodeId, to: NodeId, kind: Edge["kind"] = "request") => {
    const key = `${from}>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, kind });
  };

  if (config.loadBalancer) {
    add("client", "lb");
    add("lb", "api");
  } else {
    add("client", "api");
  }
  if (config.cache) add("api", "cache");

  const source: NodeId = config.cache ? "cache" : "api";
  add(source, "db");
  if (config.replica) add(source, "replica");

  if (config.queue) {
    add("api", "queue");
    add("queue", "db", "async");
  } else {
    add("api", "db");
  }
  if (config.replica) add("db", "replica", "async");

  return edges;
}

/**
 * Rutas del tráfico con su caudal (req/s) y resultado. Salta las de caudal ~0: un toggle apagado
 * o un caudal en cero no dibuja paquetes.
 */
export function routesFor(config: Config, metrics: Metrics): Route[] {
  const entry: NodeId[] = config.loadBalancer ? ["client", "lb", "api"] : ["client", "api"];
  const via: NodeId[] = config.cache ? ["cache"] : [];
  const f = metrics.flows;
  const routes: Route[] = [];

  const push = (path: NodeId[], rate: number, outcome: Route["outcome"]) => {
    if (rate > 1e-9) routes.push({ path, rate, outcome });
  };

  // Lo que la API rechaza
  push(entry, f.shed, "fail");
  // Hits de caché
  push([...entry, "cache"], f.hits, "ok");
  // Lecturas a la base: repartidas parejo entre los nodos de lectura vivos
  const targets: NodeId[] = [];
  if (!config.dbDown) targets.push("db");
  if (config.replica) targets.push("replica");
  if (targets.length === 0) {
    push([...entry, ...via, "db"], f.dbReadsFailed, "fail");
  } else {
    for (const target of targets) {
      push([...entry, ...via, target], f.dbReadsOk / targets.length, "ok");
      push([...entry, ...via, target], f.dbReadsFailed / targets.length, "fail");
    }
  }
  // Escrituras: encoladas o directo a la base
  const writeTarget: NodeId = config.queue ? "queue" : "db";
  push([...entry, writeTarget], f.writesOk, "ok");
  push([...entry, writeTarget], f.writesFailed, "fail");
  // Flujos internos asincrónicos
  push(["queue", "db"], f.drain, "async");
  push(["db", "replica"], f.replicated, "async");

  return routes;
}
