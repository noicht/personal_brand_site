import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_MS,
  CACHE_WARMUP_S,
  DB_CAPACITY,
  DB_READ_MS,
  LB_MS,
  NET_MS,
  QUEUE_CAPACITY,
  RPS_MAX,
  RPS_MIN,
  RPS_STEP,
  TICK_SECONDS,
  coldStart,
  healthOf,
  initialState,
  measure,
  normalizeConfig,
  run,
  step,
} from "./model.ts";
import type { Config, Metrics, SimState } from "./model.ts";
import { PRESET_IDS, PRESETS } from "./presets.ts";

const P = PRESETS;
const s0 = initialState();
const m = (config: Config, state: SimState = s0) => measure(config, state);

/** Comparación de flotantes con tolerancia. */
const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} no está a ${eps} de ${b}`);

describe("measure", () => {
  it("es determinista y no muta config ni estado", () => {
    const config = Object.freeze({ ...P.spike });
    const state = Object.freeze({ ...s0 });
    assert.deepEqual(measure(config, state), measure(config, state));
    assert.deepEqual(run(config, state, 30), run(config, state, 30));
    assert.equal(step(P.naive, s0, TICK_SECONDS), s0);
  });

  it("naive: un cliente, una API y una base, todo nominal", () => {
    const mm = m(P.naive);
    assert.equal(mm.apiLoad, 0.4);
    near(mm.dbLoad ?? 0, 240 / 720);
    assert.equal(mm.throughput, 200);
    assert.equal(mm.errorRate, 0);
    assert.equal(mm.hitRatio, 0);
    assert.equal(mm.backlog, 0);
    assert.equal(healthOf(mm), "ok");
    assert.ok((mm.p50 ?? 0) < (mm.p95 ?? 0));
  });

  it("una sola clase de latencia da la forma cerrada", () => {
    const mm = m({ ...P.naive, readRatio: 1 });
    const mean = API_MS / 0.6 + DB_READ_MS / (1 - 200 / DB_CAPACITY);
    near(mm.p50 ?? 0, NET_MS + mean * Math.LN2, 1e-6);
    near(mm.p95 ?? 0, NET_MS + mean * Math.log(20), 1e-6);
  });

  it("la API rechaza lo que excede su capacidad", () => {
    const mm = m({ ...P.naive, rps: 1000 });
    assert.equal(mm.flows.shed, 500);
    near(mm.throughput, 500);
    near(mm.errorRate, 0.5);
    assert.equal(mm.apiLoad, 2);
    near(mm.dbLoad ?? 0, 600 / 720);
  });

  it("el balanceador suma capacidad y un hop de latencia", () => {
    const withCache = { ...P.naive, cache: true, rps: 900 };
    near(m(withCache).errorRate, 400 / 900, 1e-9);
    const lb2 = m({ ...withCache, loadBalancer: true, instances: 2 });
    assert.equal(lb2.errorRate, 0);
    assert.equal(lb2.apiLoad, 0.9);
    const lb3 = m({ ...withCache, loadBalancer: true, instances: 3 });
    assert.equal(lb3.apiLoad, 0.6);

    // Mismo tráfico todo-lectura: el LB cambia el piso (NET_MS -> NET_MS + LB_MS) y el apiLoad
    const solo: Config = { ...P.naive, readRatio: 1, rps: 50 };
    const conLb: Config = { ...solo, loadBalancer: true, instances: 2 };
    const stretch = 1 / (1 - 50 / DB_CAPACITY);
    near(m(solo).p50 ?? 0, NET_MS + (API_MS / (1 - 0.1) + DB_READ_MS * stretch) * Math.LN2, 1e-6);
    near(
      m(conLb).p50 ?? 0,
      NET_MS + LB_MS + (API_MS / (1 - 0.05) + DB_READ_MS * stretch) * Math.LN2,
      1e-6,
    );
    assert.equal(m(solo).apiLoad, 0.1);
    assert.equal(m(conLb).apiLoad, 0.05);
  });

  it("una base sobrecargada falla la fracción que excede su capacidad", () => {
    const mm = m({ ...P.naive, loadBalancer: true, instances: 3, rps: 1000 });
    assert.equal(mm.flows.shed, 0);
    near(mm.dbLoad ?? 0, 1200 / 720);
    near(mm.throughput, 600);
    near(mm.errorRate, 0.4);
  });

  it("la caché absorbe lecturas y baja la carga y la latencia", () => {
    const base: Config = { ...P.naive, loadBalancer: true, instances: 3, rps: 1000 };
    const mm = m({ ...base, cache: true, cacheHitRatio: 0.8 });
    assert.equal(mm.flows.hits, 640);
    near(mm.dbLoad ?? 0, 560 / 720);
    assert.equal(mm.errorRate, 0);
    near(mm.throughput, 1000);

    const sinCache = m(base);
    const conCache = m({ ...base, cache: true });
    assert.ok((conCache.p50 ?? 0) < (sinCache.p50 ?? 0));
    assert.ok((conCache.p95 ?? 0) < (sinCache.p95 ?? 0));
    assert.ok((conCache.dbLoad ?? 0) < (sinCache.dbLoad ?? 0));

    const loads = [0.5, 0.65, 0.8, 0.95].map((hit) => m({ ...base, cache: true, cacheHitRatio: hit }).dbLoad ?? 0);
    for (let i = 1; i < loads.length; i++) assert.ok(loads[i] < loads[i - 1], `dbLoad no bajó: ${loads}`);
  });

  it("la réplica reparte las lecturas pero no las escrituras", () => {
    const base: Config = { ...P.naive, loadBalancer: true, instances: 3, rps: 1000 };
    const mm = m({ ...base, replica: true });
    near(mm.dbLoad ?? 0, 800 / 720);
    near(mm.throughput, 900);
    near(mm.errorRate, 0.1);

    const conReplica = { ...base, replica: true, rps: 200, readRatio: 0 };
    const sinReplica = { ...base, rps: 200, readRatio: 0 };
    near(m(conReplica).dbLoad ?? 0, 400 / 720);
    near(m(sinReplica).dbLoad ?? 0, 400 / 720);
  });

  it("la cola absorbe el pico de escrituras y la base drena después", () => {
    const sinCola = { ...P.spike, queue: false };
    const mmNoQ = m(sinCola);
    near(mmNoQ.dbLoad ?? 0, 1104 / 720);
    near(mmNoQ.errorRate, 1 - (576 + (624 * 720) / 1104) / 1200, 1e-9);

    const mmQ = m(P.spike);
    assert.equal(mmQ.errorRate, 0);
    near(mmQ.dbLoad ?? 0, 0.8, 1e-9);
    assert.equal(mmQ.queueIn, 480);
    assert.equal(mmQ.queueOut, 216);
    assert.equal(mmQ.backlog, 0);
    assert.ok((mmQ.p95 ?? 0) < (mmNoQ.p95 ?? 0));

    const s1 = run(P.spike, s0, 1);
    near(s1.backlog, 264, 1e-9);

    const s80 = run(P.spike, s0, 80);
    assert.equal(s80.backlog, QUEUE_CAPACITY);
    const mm80 = m(P.spike, s80);
    assert.equal(mm80.queueFull, true);
    near(mm80.errorRate, 264 / 1200, 1e-9);
    assert.equal(healthOf(mm80), "degraded");

    const bajoRps = { ...P.spike, rps: 200 };
    const drenada = run(bajoRps, s80, 110);
    assert.equal(drenada.backlog, 0);
    const mmD = m(bajoRps, drenada);
    assert.equal(mmD.queueOut, 80);
    assert.equal(mmD.queueLag, 0);
  });

  it("apagar la cola tira el backlog", () => {
    const conBacklog: SimState = { cacheWarmth: 1, backlog: 500 };
    const sinCola = { ...P.spike, queue: false };
    assert.equal(step(sinCola, conBacklog, TICK_SECONDS).backlog, 0);
    assert.equal(m(sinCola, conBacklog).backlog, 0);
  });

  it("matar la base: lecturas por caché y réplica, escrituras fallan o encolan", () => {
    const caida = m({ ...P.naive, dbDown: true });
    assert.equal(caida.throughput, 0);
    assert.equal(caida.errorRate, 1);
    assert.equal(caida.p50, null);
    assert.equal(caida.p95, null);
    assert.equal(caida.dbLoad, null);
    assert.equal(healthOf(caida), "down");

    const cacheCaida = m({ ...P.naive, cache: true, dbDown: true });
    near(cacheCaida.throughput, 128);
    near(cacheCaida.errorRate, 0.36, 1e-9);
    assert.notEqual(cacheCaida.p50, null);
    assert.equal(cacheCaida.dbLoad, null);

    const replicaCaida = m({ ...P.naive, replica: true, dbDown: true });
    assert.equal(replicaCaida.throughput, 160);
    near(replicaCaida.errorRate, 0.2, 1e-9);
    near(replicaCaida.dbLoad ?? 0, 160 / 720);

    const resCaida = { ...P.resilient, dbDown: true };
    const mm = m(resCaida);
    assert.equal(mm.errorRate, 0);
    assert.equal(mm.queueOut, 0);
    near(mm.dbLoad ?? 0, 128 / 720);

    const s10 = run(resCaida, s0, 10);
    near(s10.backlog, 1600, 1e-9);
    assert.equal(m(resCaida, s10).queueLag, null);
    assert.equal(healthOf(m(resCaida, s10)), "degraded");

    const s20 = run(P.resilient, s10, 20);
    assert.equal(s20.backlog, 0);
    assert.equal(healthOf(m(P.resilient, s20)), "ok");
  });

  it("matar una instancia de API", () => {
    const caida = m({ ...P.naive, apiDown: true });
    assert.equal(caida.apiAlive, 0);
    assert.equal(caida.apiLoad, null);
    assert.equal(caida.throughput, 0);
    assert.equal(caida.errorRate, 1);
    assert.equal(healthOf(caida), "down");

    const resCaida = m({ ...P.resilient, apiDown: true });
    assert.equal(resCaida.apiAlive, 2);
    assert.equal(resCaida.apiLoad, 0.8);
    assert.equal(resCaida.errorRate, 0);
    assert.ok((resCaida.p50 ?? 0) > (m(P.resilient).p50 ?? 0));
    assert.equal(healthOf(resCaida), "ok");

    const lb2 = m({ ...P.naive, loadBalancer: true, instances: 2, apiDown: true });
    assert.equal(lb2.apiAlive, 1);
  });

  it("cache cold start: enfría la caché y se calienta en CACHE_WARMUP_S", () => {
    const frio = coldStart(s0);
    const mmCold = m(P.readHeavy, frio);
    assert.equal(mmCold.hitRatio, 0);
    near(mmCold.dbLoad ?? 0, 575 / 720);
    near(m({ ...P.readHeavy, cache: false }).dbLoad ?? 0, 575 / 720);
    assert.ok((mmCold.p95 ?? 0) > (m(P.readHeavy).p95 ?? 0));

    // La carga de base nunca sube mientras se calienta
    let state = frio;
    let prev = m(P.readHeavy, state).dbLoad ?? 0;
    for (let i = 0; i < Math.round(CACHE_WARMUP_S / TICK_SECONDS) + 8; i++) {
      state = step(P.readHeavy, state, TICK_SECONDS);
      const load = m(P.readHeavy, state).dbLoad ?? 0;
      assert.ok(load <= prev + 1e-12, `dbLoad subió: ${prev} -> ${load}`);
      prev = load;
    }

    const s4 = run(P.readHeavy, frio, 4);
    near(m(P.readHeavy, s4).hitRatio, 0.45, 1e-9);
    const s8 = run(P.readHeavy, frio, CACHE_WARMUP_S);
    assert.equal(s8.cacheWarmth, 1);
    assert.deepEqual(m(P.readHeavy, s8), m(P.readHeavy, s0));
  });
});

describe("invariantes del modelo", () => {
  it("se mantienen en los cuatro presets y todo el rango de tráfico", () => {
    for (const id of PRESET_IDS) {
      const base = { ...P[id] };
      let prevError = Number.NEGATIVE_INFINITY;
      let prevP50: number | null = null;
      let prevP95: number | null = null;
      let erroresEnCero = true;
      for (let rps = RPS_MIN; rps <= RPS_MAX; rps += RPS_STEP) {
        const mm = m({ ...base, rps });
        assert.ok(mm.errorRate >= 0 && mm.errorRate <= 1, `${id}@${rps}: errorRate ${mm.errorRate}`);
        assert.ok(mm.throughput <= rps + 1e-9, `${id}@${rps}: throughput ${mm.throughput} > ${rps}`);
        const f = mm.flows;
        const suma = f.shed + f.hits + f.dbReadsOk + f.dbReadsFailed + f.writesOk + f.writesFailed;
        near(suma, rps, 1e-6);
        if (mm.p50 !== null && mm.p95 !== null) assert.ok(mm.p50 <= mm.p95, `${id}@${rps}: p50 > p95`);
        assert.ok(mm.errorRate >= prevError - 1e-12, `${id}@${rps}: errorRate bajó ${prevError} -> ${mm.errorRate}`);
        if (erroresEnCero && mm.errorRate === 0) {
          if (prevP50 !== null) {
            assert.ok((mm.p50 ?? 0) >= prevP50 - 1e-12, `${id}@${rps}: p50 bajó ${prevP50} -> ${mm.p50}`);
            assert.ok((mm.p95 ?? 0) >= prevP95! - 1e-12, `${id}@${rps}: p95 bajó ${prevP95} -> ${mm.p95}`);
          }
          prevP50 = mm.p50;
          prevP95 = mm.p95;
        } else {
          erroresEnCero = false;
        }
        prevError = mm.errorRate;
      }
    }
  });
});

describe("normalizeConfig", () => {
  it("acota y redondea rps, readRatio y cacheHitRatio", () => {
    assert.equal(normalizeConfig({ rps: 7 }).rps, RPS_MIN);
    assert.equal(normalizeConfig({ rps: 99999 }).rps, RPS_MAX);
    assert.equal(normalizeConfig({ rps: 1234 }).rps, 1250);
    assert.equal(normalizeConfig({ cacheHitRatio: 0.1 }).cacheHitRatio, 0.5);
    assert.equal(normalizeConfig({ cacheHitRatio: 1 }).cacheHitRatio, 0.95);
    near(normalizeConfig({ cacheHitRatio: 0.8500000001 }).cacheHitRatio, 0.85);
    assert.equal(normalizeConfig({ readRatio: 1.7 }).readRatio, 1);
    assert.equal(normalizeConfig({ readRatio: -2 }).readRatio, 0);
  });

  it("instances, booleanos y defaults", () => {
    assert.equal(normalizeConfig({ instances: 5 as unknown as Config["instances"] }).instances, 2);
    assert.equal(normalizeConfig({ instances: 3 }).instances, 3);
    assert.equal(normalizeConfig({ rps: Number.NaN }).rps, RPS_MIN);
    assert.deepEqual(normalizeConfig({}), {
      rps: RPS_MIN,
      readRatio: 0.8,
      cache: false,
      cacheHitRatio: 0.8,
      loadBalancer: false,
      instances: 2,
      queue: false,
      replica: false,
      dbDown: false,
      apiDown: false,
    });
    assert.equal(normalizeConfig({ cache: 1 as unknown as boolean }).cache, false);
  });
});

describe("healthOf", () => {
  const base = (): Metrics => ({
    p50: 30,
    p95: 80,
    throughput: 100,
    errorRate: 0,
    dbLoad: 0.5,
    apiLoad: 0.5,
    apiInstances: 1,
    apiAlive: 1,
    hitRatio: 0,
    backlog: 0,
    queueIn: 0,
    queueOut: 0,
    queueLag: 0,
    queueFull: false,
    flows: {
      shed: 0,
      hits: 0,
      dbReadsOk: 0,
      dbReadsFailed: 0,
      writesOk: 0,
      writesFailed: 0,
      drain: 0,
      replicated: 0,
    },
  });

  it("down cuando casi nada responde", () => {
    assert.equal(healthOf({ ...base(), errorRate: 0.999 }), "down");
    assert.equal(healthOf({ ...base(), errorRate: 1 }), "down");
  });

  it("degraded por cada condición", () => {
    assert.equal(healthOf({ ...base(), errorRate: 0.001 }), "degraded");
    assert.equal(healthOf({ ...base(), apiLoad: 0.91 }), "degraded");
    assert.equal(healthOf({ ...base(), dbLoad: 0.91 }), "degraded");
    assert.equal(healthOf({ ...base(), queueFull: true }), "degraded");
    assert.equal(healthOf({ ...base(), queueLag: null }), "degraded");
    assert.equal(healthOf({ ...base(), queueLag: 10.5 }), "degraded");
  });

  it("ok en régimen nominal y en los bordes", () => {
    assert.equal(healthOf(base()), "ok");
    assert.equal(healthOf({ ...base(), errorRate: 0.0005 }), "ok");
    assert.equal(healthOf({ ...base(), apiLoad: 0.9, dbLoad: 0.9, queueLag: 10 }), "ok");
  });
});
