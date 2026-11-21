import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { healthOf, initialState, measure, normalizeConfig } from "./model.ts";
import type { Config } from "./model.ts";
import { PRESET_IDS, PRESETS, matchPreset } from "./presets.ts";

const s0 = initialState();

describe("presets", () => {
  it("cada preset es igual a su propia normalizeConfig", () => {
    for (const id of PRESET_IDS) {
      assert.deepEqual(normalizeConfig(PRESETS[id]), PRESETS[id], id);
    }
  });

  it("matchPreset reconoce cada preset", () => {
    for (const id of PRESET_IDS) {
      assert.equal(matchPreset(PRESETS[id]), id);
    }
  });

  it("un campo cambiado devuelve null", () => {
    const cambios: Partial<Config>[] = [
      { rps: 300 },
      { readRatio: 0.5 },
      { cache: true },
      { cacheHitRatio: 0.9 },
      { loadBalancer: true },
      { instances: 3 },
      { queue: true },
      { replica: true },
      { dbDown: true },
      { apiDown: true },
    ];
    for (const cambio of cambios) {
      assert.equal(matchPreset({ ...PRESETS.naive, ...cambio }), null, JSON.stringify(cambio));
    }
    assert.equal(matchPreset({ ...PRESETS.resilient, rps: 850 }), null);
  });

  it("naive, readHeavy y resilient están ok; spike no falla en régimen", () => {
    for (const id of ["naive", "readHeavy", "resilient"] as const) {
      assert.equal(healthOf(measure(PRESETS[id], s0)), "ok", id);
    }
    assert.equal(measure(PRESETS.spike, s0).errorRate, 0);
  });
});
