import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Diagram } from "../content/types.js";
import { CELL_H, CELL_W, describeEdges, layoutDiagram, NODE_H, NODE_W, PAD } from "./diagram.ts";

const diagram: Diagram = {
  summary: "Prueba",
  nodes: [
    { id: "a", label: "A", kind: "client", col: 0, row: 1 },
    { id: "b", label: "B", kind: "service", col: 1, row: 1 },
    { id: "c", label: "C", kind: "db", col: 1, row: 2 },
    { id: "d", label: "D", kind: "queue", col: 2, row: 2 },
  ],
  edges: [
    { from: "a", to: "b", label: "REST" },
    { from: "b", to: "c", label: "SQL" },
    { from: "a", to: "d", label: "jobs" },
    { from: "a", to: "ghost" },
  ],
};

/** Los números de un path `M x y L/H/V …` como lista. */
const numbers = (path: string) => path.match(/-?[\d.]+/g)?.map(Number) ?? [];

describe("layoutDiagram", () => {
  const layout = layoutDiagram(diagram);
  const node = (id: string) => layout.nodes.find((n) => n.id === id)!;
  const edge = (from: string, to: string) => layout.edges.find((e) => e.from === from && e.to === to)!;

  it("normaliza la grilla al mínimo col/row ocupado", () => {
    // La fila 0 queda vacía en el diagrama: no entra al alto ni a las posiciones
    assert.equal(layout.width, PAD * 2 + 3 * CELL_W);
    assert.equal(layout.height, PAD * 2 + 2 * CELL_H);
    assert.equal(node("a").y, PAD + (CELL_H - NODE_H) / 2);
    assert.equal(node("c").y, PAD + 1 * CELL_H + (CELL_H - NODE_H) / 2);
  });

  it("centra cada nodo en su celda normalizada", () => {
    assert.equal(node("a").x, PAD + (CELL_W - NODE_W) / 2);
    assert.equal(node("c").x, PAD + 1 * CELL_W + (CELL_W - NODE_W) / 2);
    assert.equal(node("d").x, PAD + 2 * CELL_W + (CELL_W - NODE_W) / 2);
  });

  it("una arista en la misma fila es un segmento entre los lados que se enfrentan", () => {
    // `M x1 y H x2`: tres números, la y es la de ambos extremos
    const [x1, y, x2] = numbers(edge("a", "b").path);
    assert.equal(x1, node("a").x + NODE_W); // sale por la derecha
    assert.equal(x2, node("b").x); // entra por la izquierda
    assert.equal(y, node("a").y + NODE_H / 2);
    assert.equal(y, node("b").y + NODE_H / 2);
  });

  it("el rótulo de una arista horizontal va centrado sobre la línea", () => {
    const e = edge("a", "b");
    const a = node("a");
    const b = node("b");
    assert.equal(e.labelAnchor, "middle");
    assert.equal(e.labelX, (a.x + NODE_W + b.x) / 2);
    assert.equal(e.labelY, a.y + NODE_H / 2 - 6);
  });

  it("una arista en la misma columna es un segmento vertical entre los bordes", () => {
    // `M x y1 V y2`: tres números, la x es la de ambos extremos
    const [x, y1, y2] = numbers(edge("b", "c").path);
    assert.equal(x, node("b").x + NODE_W / 2);
    assert.equal(x, node("c").x + NODE_W / 2);
    assert.equal(y1, node("b").y + NODE_H); // sale por abajo
    assert.equal(y2, node("c").y); // entra por arriba
  });

  it("el rótulo de una arista vertical va a la derecha de la línea", () => {
    const e = edge("b", "c");
    const b = node("b");
    const c = node("c");
    assert.equal(e.labelAnchor, "start");
    assert.equal(e.labelX, b.x + NODE_W / 2 + 8);
    assert.equal(e.labelY, (b.y + NODE_H + c.y) / 2 + 3);
  });

  it("una arista en diagonal es un codo que sale vertical del origen y entra por el costado del destino", () => {
    const e = edge("a", "d");
    const a = node("a");
    const d = node("d");
    const [x1, y1, y2, x2] = numbers(e.path);
    assert.equal(x1, a.x + NODE_W / 2); // sale por la base del origen
    assert.equal(y1, a.y + NODE_H);
    assert.equal(y2, d.y + NODE_H / 2); // el tramo horizontal corre a la altura del destino
    assert.equal(x2, d.x); // entra por la izquierda
  });

  it("el rótulo de un codo va centrado sobre el tramo horizontal", () => {
    const e = edge("a", "d");
    const a = node("a");
    const d = node("d");
    assert.equal(e.labelAnchor, "middle");
    assert.equal(e.labelX, (a.x + NODE_W / 2 + d.x) / 2);
    assert.equal(e.labelY, d.y + NODE_H / 2 - 6);
  });

  it("omite aristas cuyos extremos no existen", () => {
    assert.equal(layout.edges.length, 3);
  });
});

describe("describeEdges", () => {
  it("describe cada arista con sus etiquetas, en orden", () => {
    assert.deepEqual(describeEdges(diagram), ["A → B: REST", "B → C: SQL", "A → D: jobs"]);
  });

  it("deja la etiqueta afuera cuando no la hay", () => {
    const noLabels: Diagram = {
      summary: "Prueba",
      nodes: [
        { id: "a", label: "A", kind: "client", col: 0, row: 0 },
        { id: "b", label: "B", kind: "service", col: 1, row: 0 },
      ],
      edges: [{ from: "a", to: "b" }],
    };
    assert.deepEqual(describeEdges(noLabels), ["A → B"]);
  });
});
