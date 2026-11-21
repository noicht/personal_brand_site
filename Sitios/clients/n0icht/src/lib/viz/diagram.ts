/**
 * Geometría de los diagramas de arquitectura de los casos de estudio.
 *
 * Recibe un `Diagram` (nodos con `col`/`row` en una grilla lógica y aristas)
 * y devuelve posiciones en pixeles para dibujarlo en SVG. Antes de ubicar,
 * normaliza la grilla a su mínimo `col`/`row` ocupado, así no quedan bandas
 * vacías. Las aristas terminan exactamente sobre el borde de su nodo; el
 * `<marker>` de la punta lo agrega el componente.
 *
 * Puro, sin DOM: lo usan `ArchDiagram.svelte` (para el `viewBox`, los nodos
 * y los paths) y los tests. El SVG generado es `aria-hidden`; la alternativa
 * textual del diagrama la da `describeEdges`.
 */

import type { Diagram, DiagramEdge, DiagramNode } from "../content/types.js";

/** Ancho de la celda lógica (incluye el gap entre nodos vecinos). */
export const CELL_W = 200;
/** Alto de la celda lógica. */
export const CELL_H = 104;
/** Ancho del nodo dibujado, centrado en su celda. */
export const NODE_W = 132;
/** Alto del nodo dibujado, centrado en su celda. */
export const NODE_H = 52;
/** Margen alrededor de la grilla dentro del viewBox. */
export const PAD = 20;

/** Punto en pixeles. */
interface Point {
  x: number;
  y: number;
}

/** Nodo ya ubicado: su `x`/`y` es la esquina superior izquierda. */
export interface PlacedNode extends DiagramNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ancla del `<text>` del rótulo de la arista. */
export type LabelAnchor = "middle" | "start";

/** Arista lista para dibujar: el `path` termina en los bordes de los nodos. */
export interface PlacedEdge {
  from: string;
  to: string;
  label?: string;
  path: string;
  /** Posición final del `<text>` del rótulo. */
  labelX: number;
  labelY: number;
  /** `text-anchor` que corresponde a esa posición. */
  labelAnchor: LabelAnchor;
}

/** Resultado de `layoutDiagram`. */
export interface DiagramLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

/** Centro del nodo, en pixeles. */
function center(node: PlacedNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/**
 * Ubica los nodos en la grilla normalizada (sin filas/columnas vacías a la
 * izquierda ni arriba) y calcula el path de cada arista. Las aristas con
 * extremos inexistentes se omiten (la validación las detecta aparte).
 */
export function layoutDiagram(diagram: Diagram): DiagramLayout {
  const minCol = Math.min(...diagram.nodes.map((node) => node.col));
  const minRow = Math.min(...diagram.nodes.map((node) => node.row));
  const maxCol = Math.max(...diagram.nodes.map((node) => node.col));
  const maxRow = Math.max(...diagram.nodes.map((node) => node.row));

  const nodes: PlacedNode[] = diagram.nodes.map((node) => ({
    ...node,
    x: PAD + (node.col - minCol) * CELL_W + (CELL_W - NODE_W) / 2,
    y: PAD + (node.row - minRow) * CELL_H + (CELL_H - NODE_H) / 2,
    width: NODE_W,
    height: NODE_H,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const edges = diagram.edges
    .map((edge) => layoutEdge(edge, byId))
    .filter((edge): edge is PlacedEdge => edge !== null);

  return {
    width: PAD * 2 + (maxCol - minCol + 1) * CELL_W,
    height: PAD * 2 + (maxRow - minRow + 1) * CELL_H,
    nodes,
    edges,
  };
}

/**
 * Calcula el path de una arista y la posición de su rótulo.
 * - Misma fila: segmento horizontal entre los lados que se enfrentan.
 * - Misma columna: segmento vertical entre el tope y la base.
 * - Distinto: codo que sale vertical del origen y entra por la izquierda o
 *   derecha del destino (`M x1 y1 V toCy H x2`).
 */
function layoutEdge(edge: DiagramEdge, byId: Map<string, PlacedNode>): PlacedEdge | null {
  const from = byId.get(edge.from);
  const to = byId.get(edge.to);
  if (!from || !to) return null;

  const a = center(from);
  const b = center(to);
  let path: string;
  let labelX: number;
  let labelY: number;
  let labelAnchor: LabelAnchor = "middle";

  if (from.row === to.row) {
    // Horizontal: de lado a lado
    const goingRight = b.x >= a.x;
    const x1 = goingRight ? from.x + from.width : from.x;
    const x2 = goingRight ? to.x : to.x + to.width;
    path = `M ${x1} ${a.y} H ${x2}`;
    labelX = (x1 + x2) / 2;
    labelY = a.y - 6;
  } else if (from.col === to.col) {
    // Vertical: de tope a base; el rótulo va a la derecha de la línea
    const goingDown = b.y >= a.y;
    const y1 = goingDown ? from.y + from.height : from.y;
    const y2 = goingDown ? to.y : to.y + to.height;
    path = `M ${a.x} ${y1} V ${y2}`;
    labelX = a.x + 8;
    labelY = (y1 + y2) / 2 + 3;
    labelAnchor = "start";
  } else {
    // Codo: sale vertical del origen y entra horizontal al destino
    const goingDown = b.y >= a.y;
    const goingRight = b.x >= a.x;
    const x1 = a.x;
    const y1 = goingDown ? from.y + from.height : from.y;
    const x2 = goingRight ? to.x : to.x + to.width;
    const y2 = b.y;
    path = `M ${x1} ${y1} V ${y2} H ${x2}`;
    labelX = (x1 + x2) / 2;
    labelY = y2 - 6;
  }

  return { from: edge.from, to: edge.to, label: edge.label, path, labelX, labelY, labelAnchor };
}

/**
 * Devuelve las conexiones en orden, una frase por arista:
 * "API gateway → Ledger service: REST" (el rótulo solo si la arista lo tiene).
 * Es la alternativa textual del diagrama para lectores de pantalla.
 */
export function describeEdges(diagram: Diagram): string[] {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const lines: string[] = [];
  for (const edge of diagram.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    lines.push(edge.label ? `${from.label} → ${to.label}: ${edge.label}` : `${from.label} → ${to.label}`);
  }
  return lines;
}
