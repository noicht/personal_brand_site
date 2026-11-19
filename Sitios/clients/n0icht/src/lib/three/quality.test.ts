import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveDpr,
  isSoftwareRenderer,
  MAX_DPR,
  MIN_DPR,
  nextLevel,
  pickQuality,
  SLOW_FRAME_MS,
  TIERS,
} from "./quality.ts";
import type { DeviceHints, QualityTier } from "./quality.ts";

const desktop: DeviceHints = { width: 1440, coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 8 };

describe("pickQuality", () => {
  it("una desktop da high", () => {
    assert.equal(pickQuality(desktop).name, "high");
    assert.equal(pickQuality(desktop), TIERS.high);
  });

  it("cada condición de low por separado da low", () => {
    assert.equal(pickQuality({ ...desktop, width: 767 }).name, "low");
    assert.equal(pickQuality({ ...desktop, width: 768 }).name, "high");
    assert.equal(pickQuality({ ...desktop, coarsePointer: true }).name, "low");
    assert.equal(pickQuality({ ...desktop, deviceMemory: 4 }).name, "low");
    assert.equal(pickQuality({ ...desktop, deviceMemory: 8 }).name, "high");
    assert.equal(pickQuality({ ...desktop, hardwareConcurrency: 4 }).name, "low");
    assert.equal(pickQuality({ ...desktop, hardwareConcurrency: 8 }).name, "high");
    assert.equal(pickQuality({ ...desktop, saveData: true }).name, "low");
    assert.equal(pickQuality({ ...desktop, saveData: false }).name, "high");
  });

  it("los datos undefined no fuerzan low", () => {
    assert.equal(pickQuality({ width: 1440, coarsePointer: false }).name, "high");
  });
});

describe("effectiveDpr", () => {
  const tiers: QualityTier[] = [TIERS.high, TIERS.low];

  it("nunca pasa de MAX_DPR en ningún tier ni nivel", () => {
    for (const tier of tiers) {
      for (let level = 0; level < 3; level++) {
        for (const dpr of [1, 1.5, 2, 3, 4]) {
          assert.ok(effectiveDpr(dpr, tier, level) <= MAX_DPR, `${tier.name} L${level} dpr${dpr}`);
        }
      }
    }
  });

  it("nunca baja de MIN_DPR", () => {
    for (const tier of tiers) {
      for (let level = 0; level < 3; level++) {
        assert.ok(effectiveDpr(0.1, tier, level) >= MIN_DPR);
      }
    }
  });

  it("un devicePixelRatio falso cuenta como 1", () => {
    assert.equal(effectiveDpr(0, TIERS.high, 0), 1);
    assert.equal(effectiveDpr(NaN, TIERS.high, 0), 1);
  });

  it("respeta el tope del tier", () => {
    assert.equal(effectiveDpr(3, TIERS.low, 0), TIERS.low.maxDpr);
    assert.equal(effectiveDpr(3, TIERS.high, 0), MAX_DPR);
  });
});

describe("nextLevel", () => {
  it("se queda si el cuadro entra en el presupuesto", () => {
    assert.equal(nextLevel(0, SLOW_FRAME_MS), 0);
    assert.equal(nextLevel(1, SLOW_FRAME_MS - 1), 1);
  });

  it("sube uno cuando el cuadro es lento y tiene tope", () => {
    assert.equal(nextLevel(0, SLOW_FRAME_MS + 1), 1);
    assert.equal(nextLevel(1, 60), 2);
    assert.equal(nextLevel(2, 60), 2);
  });
});

describe("TIERS", () => {
  it("low tiene menos nodos y paquetes que high y sin antialias", () => {
    assert.ok(TIERS.low.nodesPerCluster < TIERS.high.nodesPerCluster);
    assert.ok(TIERS.low.packets < TIERS.high.packets);
    assert.equal(TIERS.low.antialias, false);
    assert.equal(TIERS.high.antialias, true);
  });
});

describe("isSoftwareRenderer", () => {
  it("detecta renderers por CPU", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "Microsoft Basic Render Driver",
      "Mesa softpipe",
    ]) {
      assert.equal(isSoftwareRenderer(name), true, name);
    }
  });

  it("deja pasar GPU de verdad y valores vacíos", () => {
    for (const name of [
      "ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2), OpenGL ES 3.2)",
      "Adreno (TM) 619",
      "Apple GPU",
      "",
      null,
      undefined,
    ]) {
      assert.equal(isSoftwareRenderer(name), false, String(name));
    }
  });
});
