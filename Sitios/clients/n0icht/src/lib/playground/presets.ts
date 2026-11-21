/**
 * Los presets del playground: configuraciones de partida que muestran un escenario cada uno.
 * `matchPreset` reconoce cuándo la config actual es exactamente un preset (para marcar el
 * botón activo y distinguir "custom").
 */
import type { Config } from "./model.ts";

export const PRESET_IDS = ["naive", "readHeavy", "spike", "resilient"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const PRESETS: Record<PresetId, Config> = {
  naive: {
    rps: 200,
    readRatio: 0.8,
    cache: false,
    cacheHitRatio: 0.8,
    loadBalancer: false,
    instances: 2,
    queue: false,
    replica: false,
    dbDown: false,
    apiDown: false,
  },
  readHeavy: {
    rps: 1000,
    readRatio: 0.95,
    cache: true,
    cacheHitRatio: 0.9,
    loadBalancer: true,
    instances: 3,
    queue: false,
    replica: true,
    dbDown: false,
    apiDown: false,
  },
  spike: {
    rps: 1200,
    readRatio: 0.6,
    cache: true,
    cacheHitRatio: 0.8,
    loadBalancer: true,
    instances: 3,
    queue: true,
    replica: false,
    dbDown: false,
    apiDown: false,
  },
  resilient: {
    rps: 800,
    readRatio: 0.8,
    cache: true,
    cacheHitRatio: 0.8,
    loadBalancer: true,
    instances: 3,
    queue: true,
    replica: true,
    dbDown: false,
    apiDown: false,
  },
};

/** El preset cuya config es igual campo por campo a `config`, o null. */
export function matchPreset(config: Config): PresetId | null {
  for (const id of PRESET_IDS) {
    const preset = PRESETS[id];
    const same = (Object.keys(preset) as (keyof Config)[]).every((key) => preset[key] === config[key]);
    if (same) return id;
  }
  return null;
}
