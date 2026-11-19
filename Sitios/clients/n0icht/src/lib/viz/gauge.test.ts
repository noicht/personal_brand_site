import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arcPath, gaugeFraction, gaugeTicks, polar } from "./gauge.ts";

describe("gaugeFraction", () => {
  it("reparte el valor sobre el máximo y lo acota a 0..1", () => {
    assert.equal(gaugeFraction(3, 6), 0.5);
    assert.equal(gaugeFraction(-2, 6), 0);
    assert.equal(gaugeFraction(9, 6), 1);
  });

  it("entradas no válidas dan 0", () => {
    assert.equal(gaugeFraction(Number.NaN, 6), 0);
    assert.equal(gaugeFraction(3, 0), 0);
    assert.equal(gaugeFraction(3, -1), 0);
    assert.equal(gaugeFraction(3, Number.NaN), 0);
  });
});

describe("polar", () => {
  it("0 es el extremo izquierdo, 0.5 arriba y 1 el derecho", () => {
    assert.deepEqual(polar(100, 100, 50, 0), { x: 50, y: 100 });
    const top = polar(100, 100, 50, 0.5);
    assert.ok(Math.abs(top.x - 100) < 1e-9 && Math.abs(top.y - 50) < 1e-9);
    assert.deepEqual(polar(100, 100, 50, 1), { x: 150, y: 100 });
  });
});

describe("arcPath", () => {
  it("va del punto de la fracción inicial al de la final, en un solo arco", () => {
    assert.equal(arcPath(100, 100, 50, 0, 1), "M 50 100 A 50 50 0 0 1 150 100");
    assert.equal(arcPath(100, 100, 50, 0, 0.5), "M 50 100 A 50 50 0 0 1 100 50");
  });
});

describe("gaugeTicks", () => {
  it("devuelve la fracción de cada unidad entera, con 0 y 1", () => {
    assert.deepEqual(gaugeTicks(4), [0, 0.25, 0.5, 0.75, 1]);
    assert.equal(gaugeTicks(6).length, 7);
    assert.equal(gaugeTicks(6).at(-1), 1);
  });

  it("un máximo no válido devuelve solo los extremos", () => {
    assert.deepEqual(gaugeTicks(0), [0, 1]);
    assert.deepEqual(gaugeTicks(Number.NaN), [0, 1]);
  });
});
