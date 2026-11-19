import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCount, formatMs, formatPercent, formatSeconds } from "./format.ts";

describe("formatMs", () => {
  it("redondea a entero", () => {
    assert.equal(formatMs(12.4), "12");
    assert.equal(formatMs(12.6), "13");
    assert.equal(formatMs(0), "0");
  });
});

describe("formatCount", () => {
  it("enteros bajo 1000 y miles con k desde 1000", () => {
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(999), "999");
    assert.equal(formatCount(1000), "1k");
    assert.equal(formatCount(1234), "1.2k");
    assert.equal(formatCount(1500), "1.5k");
    assert.equal(formatCount(20000), "20k");
  });
});

describe("formatPercent", () => {
  it("sin signo %, con los cortes del copy", () => {
    assert.equal(formatPercent(0), "0");
    assert.equal(formatPercent(0.0009), "<0.1"); // 0.09%
    assert.equal(formatPercent(0.001), "0.1"); // justo 0.1%
    assert.equal(formatPercent(0.042), "4.2");
    assert.equal(formatPercent(0.0999), "10.0"); // 9.99% redondea a un decimal
    assert.equal(formatPercent(0.1), "10"); // 10% ya no lleva decimal
    assert.equal(formatPercent(0.3649), "36");
    assert.equal(formatPercent(1.84), "184");
  });
});

describe("formatSeconds", () => {
  it("un decimal bajo 100, entero desde 100", () => {
    assert.equal(formatSeconds(0), "0.0");
    assert.equal(formatSeconds(9.94), "9.9");
    assert.equal(formatSeconds(99.94), "99.9");
    assert.equal(formatSeconds(100), "100");
    assert.equal(formatSeconds(123.4), "123");
  });
});
