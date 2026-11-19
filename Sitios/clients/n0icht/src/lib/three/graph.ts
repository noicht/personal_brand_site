/**
 * El grafo de arquitectura que dibuja el fondo: seis clusters (uno por etapa del pipeline),
 * cada uno con un hub central, nodos de servicio/base de datos/cola/caché alrededor y aristas
 * internas y entre clusters vecinos. Determinista: mismo seed, mismo grafo.
 */
import { STAGES, STAGE_COUNT } from "./stages.ts";
import type { StageId } from "./stages.ts";

export type NodeKind = "service" | "db" | "queue" | "cache";

export const NODE_KINDS: readonly NodeKind[] = ["service", "db", "queue", "cache"];

export interface GraphNode {
  kind: NodeKind;
  cluster: number;
  x: number;
  y: number;
  z: number;
}

export interface Cluster {
  stage: StageId;
  x: number;
  z: number;
  /** Índice del nodo central dentro de `nodes`. */
  hub: number;
}

export interface Graph {
  nodes: GraphNode[];
  /** Pares [a0, b0, a1, b1, …] de índices de nodo. */
  edges: Uint16Array;
  clusters: Cluster[];
}

/** Centros de los clusters en el plano XZ, en el orden de `STAGES`. */
export const CLUSTER_CENTERS: readonly { x: number; z: number }[] = [
  { x: 0, z: 0 },
  { x: 15, z: -9 },
  { x: 31, z: -2 },
  { x: 46, z: -13 },
  { x: 62, z: -5 },
  { x: 77, z: -16 },
];

export const CLUSTER_RADIUS = 5.5;

/** PRNG con semilla (mulberry32), valores en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Secuencia de tipos por cluster, ciclando por índice de nodo (j = 0 es el hub). */
const KIND_CYCLES: readonly (readonly NodeKind[])[] = [
  ["service", "cache", "service", "queue"],
  ["db", "service", "queue", "service", "cache"],
  ["service", "service", "db", "service", "queue", "cache"],
  ["queue", "service", "service", "cache", "db"],
  ["service", "cache", "service", "db", "service", "queue"],
  ["db", "queue", "service", "cache", "service"],
];

const dist3 = (a: GraphNode, b: GraphNode) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

/**
 * Arma el grafo completo. `nodesPerCluster` nodos por etapa (el hub cuenta); con 1 queda solo
 * el hub de cada cluster. `seed` hace la distribución de nodos reproducible.
 */
export function buildGraph(nodesPerCluster: number, seed = 0x6e30): Graph {
  const n = Math.max(1, Math.floor(nodesPerCluster));
  const rand = mulberry32(seed);
  const nodes: GraphNode[] = [];
  const clusters: Cluster[] = [];
  const pairs: number[] = [];
  const seen = new Set<number>();

  // a-b y b-a son la misma arista; la clave viaja como a * 65536 + b con a < b
  const link = (a: number, b: number) => {
    if (a === b) return;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = lo * 65536 + hi;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(lo, hi);
  };

  for (let c = 0; c < STAGE_COUNT; c++) {
    const center = CLUSTER_CENTERS[c];
    const kinds = KIND_CYCLES[c];
    const base = nodes.length;

    for (let j = 0; j < n; j++) {
      const kind = kinds[j % kinds.length];
      if (j === 0) {
        nodes.push({ kind, cluster: c, x: center.x, y: 2.2, z: center.z });
      } else {
        const angle = j * 2.39996 + rand() * 0.5;
        const r = CLUSTER_RADIUS * Math.sqrt(j / (n - 1)) * (0.75 + 0.25 * rand());
        nodes.push({
          kind,
          cluster: c,
          x: center.x + Math.cos(angle) * r,
          y: 0.9 + rand() * 2.8,
          z: center.z + Math.sin(angle) * r * 0.8,
        });
      }
    }

    clusters.push({ stage: STAGES[c], x: center.x, z: center.z, hub: base });
  }

  // Aristas dentro de cada cluster: cada nodo se cuelga del ya colocado más cercano y, cada
  // tres, también del hub
  for (let c = 0; c < STAGE_COUNT; c++) {
    const base = clusters[c].hub;
    for (let j = 1; j < n; j++) {
      const node = base + j;
      let best = base;
      let bestDist = Infinity;
      for (let jp = 0; jp < j; jp++) {
        const other = base + jp;
        const d = dist3(nodes[node], nodes[other]);
        if (d < bestDist) {
          bestDist = d;
          best = other;
        }
      }
      link(node, best);
      if (j % 3 === 0 && j >= 3) link(node, base);
    }
  }

  // Entre clusters vecinos: hub con hub y el par más cercano (uno de cada lado)
  for (let c = 0; c < STAGE_COUNT - 1; c++) {
    link(clusters[c].hub, clusters[c + 1].hub);
    let bestA = clusters[c].hub;
    let bestB = clusters[c + 1].hub;
    let bestDist = Infinity;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const ga = clusters[c].hub + a;
        const gb = clusters[c + 1].hub + b;
        const d = dist3(nodes[ga], nodes[gb]);
        if (d < bestDist) {
          bestDist = d;
          bestA = ga;
          bestB = gb;
        }
      }
    }
    link(bestA, bestB);
  }

  return { nodes, edges: new Uint16Array(pairs), clusters };
}

/** Vecinos de cada nodo, en el mismo orden en que aparecen las aristas. */
export function adjacency(graph: Graph): number[][] {
  const neighbors: number[][] = graph.nodes.map(() => []);
  for (let i = 0; i < graph.edges.length; i += 2) {
    const a = graph.edges[i];
    const b = graph.edges[i + 1];
    neighbors[a].push(b);
    neighbors[b].push(a);
  }
  return neighbors;
}
