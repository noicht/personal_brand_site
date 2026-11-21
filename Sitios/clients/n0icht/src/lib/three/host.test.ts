/**
 * La máquina de estados del worker (`host.ts`) con dependencias falsas: contexto,
 * escena y timers son objetos de prueba, nada del navegador corre acá.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSceneHost } from "./host.ts";
import type { HostDeps } from "./host.ts";
import { TIERS } from "./quality.ts";
import type { Palette, SceneHandle, SceneOptions, SceneStats } from "./scene.ts";
import type { FromWorker, InitMessage } from "./protocol.ts";

const PALETTE: Palette = {
  bg: "#0b0d10",
  panel: "#111418",
  border: "#2a3138",
  borderStrong: "#3d4750",
  amber: "#ff6a00",
  green: "#39ff88",
  cyan: "#5ce1e6",
  text: "#e6edf3",
  muted: "#8b98a5",
};

const STATS: SceneStats = {
  fps: 60,
  frames: 7,
  position: 1.25,
  cluster: 2,
  level: 0,
  dpr: 1.5,
  nodes: 60,
  calls: 12,
  pulses: 4,
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

interface FakeScene extends SceneHandle {
  calls: unknown[][];
  deferred: Deferred<void>;
  disposed: boolean;
}

function makeScene(): FakeScene {
  const ready = deferred<void>();
  const calls: unknown[][] = [];
  const scene: FakeScene = {
    calls,
    deferred: ready,
    disposed: false,
    ready: ready.promise,
    stats: { ...STATS },
    resize: (width: number, height: number, dpr: number) => {
      calls.push(["resize", width, height, dpr]);
    },
    setRunning: (value: boolean) => {
      calls.push(["setRunning", value]);
    },
    setStill: (value: boolean) => {
      calls.push(["setStill", value]);
    },
    setPointer: (x: number, y: number, inside: boolean) => {
      calls.push(["setPointer", x, y, inside]);
    },
    pulseAt: (x: number, y: number) => {
      calls.push(["pulseAt", x, y]);
    },
    pulseStage: (stage: number) => {
      calls.push(["pulseStage", stage]);
    },
    invalidate: () => {
      calls.push(["invalidate"]);
    },
    dispose: () => {
      scene.disposed = true;
      calls.push(["dispose"]);
    },
  };
  return scene;
}

interface WorldOptions {
  /** null simula que no hay contexto WebGL2. */
  context?: WebGL2RenderingContext | null;
  rendererName?: string;
  /** Si está, `loadScene` espera este deferred: la fase queda en `loading`. */
  gate?: Deferred<void>;
  makeScene?: () => FakeScene;
}

function makeWorld(options: WorldOptions = {}) {
  const posts: FromWorker[] = [];
  const warns: [string, unknown][] = [];
  const lost: WebGL2RenderingContext[] = [];
  const intervals: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  const created: { options: SceneOptions; scene: FakeScene }[] = [];
  const ctxCalls: { width: number; height: number }[] = [];
  const gl = { fake: "gl" } as unknown as WebGL2RenderingContext;
  let loadSceneCalls = 0;

  const deps: HostDeps = {
    post: (message) => posts.push(message),
    createContext: (canvas) => {
      ctxCalls.push({ width: canvas.width, height: canvas.height });
      return options.context === undefined ? gl : options.context;
    },
    rendererName: () =>
      options.rendererName ?? "ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    loseContext: (context) => lost.push(context),
    loadScene: async () => {
      loadSceneCalls++;
      if (options.gate) await options.gate.promise;
      return {
        loadThree: async () => ({}) as never,
        createScene: (_T: never, _canvas: OffscreenCanvas, _gl: WebGL2RenderingContext, sceneOptions: SceneOptions) => {
          const scene = options.makeScene ? options.makeScene() : makeScene();
          created.push({ options: sceneOptions, scene });
          return scene;
        },
      } as never;
    },
    every: (ms, fn) => {
      const record = { ms, fn, cancelled: false };
      intervals.push(record);
      return () => {
        record.cancelled = true;
      };
    },
    warn: (message, error) => warns.push([message, error]),
  };

  return {
    host: createSceneHost(deps),
    posts,
    warns,
    lost,
    intervals,
    created,
    ctxCalls,
    get loadSceneCalls() {
      return loadSceneCalls;
    },
  };
}

function initMessage(overrides: Partial<InitMessage> = {}): InitMessage {
  return {
    type: "init",
    canvas: { width: 0, height: 0 } as unknown as OffscreenCanvas,
    tier: TIERS.high,
    palette: PALETTE,
    still: false,
    hover: true,
    debug: false,
    width: 800,
    height: 600,
    dpr: 2,
    running: true,
    stage: 2.5,
    ...overrides,
  };
}

/** Deja correr la carga hasta que `createScene` ya fue llamado (fase `loading`, `ready` pendiente). */
async function untilCreated(world: ReturnType<typeof makeWorld>) {
  for (let i = 0; i < 10 && world.created.length === 0; i++) await tick();
  assert.equal(world.created.length, 1, "la escena tenía que existir");
  return world.created[0];
}

/** Igual que `untilCreated` pero además resuelve `ready`: fase `ready`. */
async function untilReady(world: ReturnType<typeof makeWorld>) {
  const entry = await untilCreated(world);
  entry.scene.deferred.resolve();
  for (let i = 0; i < 10; i++) await tick();
  return entry;
}

describe("createSceneHost", () => {
  it("sin contexto WebGL2 postea fallback no-webgl2 y no carga la escena", async () => {
    const world = makeWorld({ context: null });
    await world.host.handle(initMessage());
    assert.deepEqual(world.posts, [{ type: "status", status: "fallback", reason: "no-webgl2" }]);
    assert.equal(world.loadSceneCalls, 0);
    assert.equal(world.created.length, 0);
  });

  it("renderer por software: pierde el contexto, postea fallback software y no carga", async () => {
    const world = makeWorld({ rendererName: "Google SwiftShader" });
    await world.host.handle(initMessage());
    assert.deepEqual(world.posts, [{ type: "status", status: "fallback", reason: "software" }]);
    assert.equal(world.lost.length, 1);
    assert.equal(world.loadSceneCalls, 0);
  });

  it("hardware: mide el canvas antes del contexto, pasa las opciones y postea live/still", async () => {
    for (const still of [false, true]) {
      const world = makeWorld();
      const pending = world.host.handle(initMessage({ still }));
      const entry = await untilReady(world);
      await pending;
      // El drawing buffer nació a tamaño final antes de crear el contexto
      assert.deepEqual(world.ctxCalls, [{ width: 1600, height: 1200 }]);
      assert.equal(entry.options.tier, TIERS.high);
      assert.equal(entry.options.palette, PALETTE);
      assert.equal(entry.options.still, still);
      assert.equal(entry.options.hover, true);
      assert.equal(typeof entry.options.readStage, "function");
      // Lo recordado del init se aplica una vez que la escena existe
      assert.deepEqual(entry.scene.calls.slice(0, 3), [
        ["resize", 800, 600, 2],
        ["setPointer", 0, 0, false],
        ["setRunning", true],
      ]);
      assert.deepEqual(
        world.posts.filter((m) => m.type === "status"),
        [{ type: "status", status: still ? "still" : "live" }],
      );
    }
  });

  it("readStage devuelve el stage del init y después el último mensaje stage", async () => {
    const gate = deferred<void>();
    const world = makeWorld({ gate });
    const pending = world.host.handle(initMessage({ stage: 1.5 }));
    gate.resolve();
    const { options, scene } = await untilCreated(world);
    assert.equal(options.readStage(), 1.5);
    // stage solo se recuerda: vale también durante loading, sin redraw forzado
    await world.host.handle({ type: "stage", position: 4.25 });
    assert.equal(options.readStage(), 4.25);
    scene.deferred.resolve();
    await pending;
    await world.host.handle({ type: "stage", position: 0.5 });
    assert.equal(options.readStage(), 0.5);
  });

  it("resize/running/pointer durante loading se aplican con el último valor; en ready se reenvían", async () => {
    const gate = deferred<void>();
    const world = makeWorld({ gate });
    const pending = world.host.handle(initMessage());
    await world.host.handle({ type: "resize", width: 1024, height: 768, dpr: 1 });
    await world.host.handle({ type: "running", value: false });
    await world.host.handle({ type: "pointer", x: 5, y: 6, inside: true });
    gate.resolve();
    const { scene } = await untilCreated(world);
    assert.deepEqual(scene.calls.slice(0, 3), [
      ["resize", 1024, 768, 1],
      ["setPointer", 5, 6, true],
      ["setRunning", false],
    ]);
    scene.deferred.resolve();
    await pending;
    await world.host.handle({ type: "resize", width: 500, height: 400, dpr: 1 });
    await world.host.handle({ type: "running", value: true });
    await world.host.handle({ type: "pointer", x: 9, y: 9, inside: false });
    assert.deepEqual(scene.calls.slice(3), [
      ["resize", 500, 400, 1],
      ["setRunning", true],
      ["setPointer", 9, 9, false],
    ]);
  });

  it("still en ready llama setStill y postea el estado; al volver postea live", async () => {
    const world = makeWorld();
    const pending = world.host.handle(initMessage());
    const { scene } = await untilReady(world);
    await pending;
    await world.host.handle({ type: "still", value: true });
    assert.deepEqual(scene.calls.at(-1), ["setStill", true]);
    assert.deepEqual(world.posts.at(-1), { type: "status", status: "still" });
    await world.host.handle({ type: "still", value: false });
    assert.deepEqual(scene.calls.at(-1), ["setStill", false]);
    assert.deepEqual(world.posts.at(-1), { type: "status", status: "live" });
  });

  it("pulse-at, pulse-stage e invalidate se reenvían en ready y se descartan antes", async () => {
    const gate = deferred<void>();
    const world = makeWorld({ gate });
    const pending = world.host.handle(initMessage());
    // todavía en loading: los pulsos se caen
    await world.host.handle({ type: "pulse-at", x: 1, y: 2 });
    await world.host.handle({ type: "pulse-stage", stage: 3 });
    await world.host.handle({ type: "invalidate" });
    gate.resolve();
    const { scene } = await untilCreated(world);
    assert.equal(scene.calls.filter((c) => c[0] === "pulseAt").length, 0);
    scene.deferred.resolve();
    await pending;
    await world.host.handle({ type: "pulse-at", x: 30, y: 40 });
    await world.host.handle({ type: "pulse-stage", stage: 2 });
    await world.host.handle({ type: "invalidate" });
    assert.deepEqual(scene.calls.slice(-3), [
      ["pulseAt", 30, 40],
      ["pulseStage", 2],
      ["invalidate"],
    ]);
  });

  it("dispose durante loading suelta la escena si existe y no postea nada", async () => {
    // (a) antes de que loadScene resuelva
    const gateA = deferred<void>();
    const worldA = makeWorld({ gate: gateA });
    const pendingA = worldA.host.handle(initMessage());
    await worldA.host.handle({ type: "dispose" });
    assert.equal(worldA.lost.length, 1); // el contexto se pierde
    gateA.resolve();
    for (let i = 0; i < 10; i++) await tick();
    await pendingA;
    assert.equal(worldA.created.length, 0);
    assert.deepEqual(worldA.posts, []);
    await worldA.host.handle({ type: "resize", width: 1, height: 1, dpr: 1 });
    assert.deepEqual(worldA.posts, []);

    // (b) con la escena creada pero ready pendiente
    const gateB = deferred<void>();
    const worldB = makeWorld({ gate: gateB });
    const pendingB = worldB.host.handle(initMessage());
    gateB.resolve();
    const entryB = await untilCreated(worldB);
    await worldB.host.handle({ type: "dispose" });
    assert.equal(entryB.scene.disposed, true);
    entryB.scene.deferred.resolve();
    await pendingB;
    assert.deepEqual(worldB.posts, []);
    await worldB.host.handle({ type: "pulse-at", x: 1, y: 1 });
    assert.deepEqual(worldB.posts, []);
  });

  it("contextLost postea fallback context-lost una sola vez y cierra", async () => {
    const world = makeWorld();
    const pending = world.host.handle(initMessage());
    const { scene } = await untilReady(world);
    await pending;
    world.host.contextLost();
    world.host.contextLost();
    assert.equal(scene.disposed, true);
    assert.deepEqual(
      world.posts.filter((m) => m.type === "status" && m.status === "fallback"),
      [{ type: "status", status: "fallback", reason: "context-lost" }],
    );
    const callsBefore = scene.calls.length;
    await world.host.handle({ type: "resize", width: 10, height: 10, dpr: 1 });
    assert.equal(scene.calls.length, callsBefore);
  });

  it("createScene que tira o ready que rechaza: warn + fallback error", async () => {
    const boom = new Error("boom");
    const worldThrow = makeWorld({ makeScene: () => { throw boom; } });
    await worldThrow.host.handle(initMessage());
    assert.equal(worldThrow.warns.length, 1);
    assert.deepEqual(worldThrow.posts.at(-1), { type: "status", status: "fallback", reason: "error" });

    const worldReject = makeWorld();
    const pending = worldReject.host.handle(initMessage());
    const { scene } = await untilCreated(worldReject);
    scene.deferred.reject(boom);
    await pending;
    assert.equal(scene.disposed, true);
    assert.equal(worldReject.warns.length, 1);
    assert.deepEqual(worldReject.posts.at(-1), { type: "status", status: "fallback", reason: "error" });
  });

  it("debug: stats cada 250 ms como copia; debug-lose-context solo con debug", async () => {
    const world = makeWorld();
    const pending = world.host.handle(initMessage({ debug: true }));
    const { scene } = await untilReady(world);
    await pending;
    assert.equal(world.intervals.length, 1);
    assert.equal(world.intervals[0].ms, 250);
    world.intervals[0].fn();
    const statsPost = world.posts.find((m) => m.type === "stats");
    assert.ok(statsPost && statsPost.type === "stats");
    if (statsPost?.type === "stats") {
      assert.notEqual(statsPost.stats, scene.stats);
      assert.deepEqual(statsPost.stats, scene.stats);
      scene.stats.fps = 999;
      world.intervals[0].fn();
      const last = world.posts.filter((m) => m.type === "stats").at(-1);
      assert.equal(last?.type === "stats" ? last.stats.fps : null, 999);
    }
    await world.host.handle({ type: "debug-lose-context" });
    assert.equal(world.lost.length, 1);

    const quiet = makeWorld();
    const pendingQuiet = quiet.host.handle(initMessage({ debug: false }));
    await untilReady(quiet);
    await pendingQuiet;
    assert.equal(quiet.intervals.length, 0);
    await quiet.host.handle({ type: "debug-lose-context" });
    assert.equal(quiet.lost.length, 0);
  });

  it("antes del init y un segundo init se ignoran", async () => {
    const world = makeWorld();
    await world.host.handle({ type: "resize", width: 1, height: 1, dpr: 1 });
    await world.host.handle({ type: "pulse-at", x: 0, y: 0 });
    assert.equal(world.loadSceneCalls, 0);
    assert.deepEqual(world.posts, []);

    const pending = world.host.handle(initMessage());
    const { scene } = await untilReady(world);
    await pending;
    // segundo init en ready: no reinicia nada
    await world.host.handle(initMessage({ width: 999, height: 999 }));
    assert.equal(world.loadSceneCalls, 1);
    assert.equal(world.created.length, 1);
    assert.equal(scene.calls.filter((c) => c[0] === "dispose").length, 0);
  });
});
