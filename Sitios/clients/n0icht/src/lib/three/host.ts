/**
 * La máquina de estados del worker de la escena 3D: recibe los mensajes del hilo
 * principal, crea el contexto WebGL2, recién ahí carga la escena y reenvía las
 * actualizaciones. Pura: todas las APIs del navegador entran por `HostDeps`, así
 * corre bajo `node --test`.
 *
 * Fases: `idle` → (`init`) → `loading` → `ready`; `closed` es terminal. Lo que no
 * es `init` en `idle`, un segundo `init` y todo lo que llega en `closed` se ignora.
 */
import { effectiveDpr, isSoftwareRenderer } from "./quality.ts";
import type { QualityTier } from "./quality.ts";
import type { Palette, SceneHandle } from "./scene.ts";
import type { FromWorker, InitMessage, ToWorker } from "./protocol.ts";

export interface HostDeps {
  post(message: FromWorker): void;
  /** Contexto WebGL2 de hardware, o null. */
  createContext(canvas: OffscreenCanvas, tier: QualityTier): WebGL2RenderingContext | null;
  /** UNMASKED_RENDERER_WEBGL, o RENDERER si la extensión no está. */
  rendererName(gl: WebGL2RenderingContext): string;
  loseContext(gl: WebGL2RenderingContext): void;
  /** El módulo de la escena; se pide recién cuando el contexto sirve. */
  loadScene(): Promise<Pick<typeof import("./scene.ts"), "loadThree" | "createScene">>;
  /** Llama a `fn` cada `ms`; devuelve cómo cancelarlo. */
  every(ms: number, fn: () => void): () => void;
  warn(message: string, error: unknown): void;
}

export interface SceneHost {
  /** Resuelve cuando el mensaje terminó de aplicarse (para `init`: escena lista o en respaldo). */
  handle(message: ToWorker): Promise<void>;
  /** El canvas perdió el contexto. */
  contextLost(): void;
}

type Phase = "idle" | "loading" | "ready" | "closed";

interface PointerState {
  x: number;
  y: number;
  inside: boolean;
}

/** Lo último pedido: se aplica al crear la escena y queda vigente en `ready`. */
interface Memory {
  tier: QualityTier | null;
  palette: Palette | null;
  still: boolean;
  hover: boolean;
  debug: boolean;
  width: number;
  height: number;
  dpr: number;
  running: boolean;
  stage: number;
  pointer: PointerState;
}

export function createSceneHost(deps: HostDeps): SceneHost {
  let phase: Phase = "idle";
  let canvas: OffscreenCanvas | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let scene: SceneHandle | null = null;
  let cancelStats: (() => void) | null = null;

  const mem: Memory = {
    tier: null,
    palette: null,
    still: false,
    hover: false,
    debug: false,
    width: 0,
    height: 0,
    dpr: 1,
    running: false,
    stage: 0,
    pointer: { x: 0, y: 0, inside: false },
  };

  const disposeScene = () => {
    if (scene) {
      scene.dispose();
      scene = null;
    }
  };

  const stopStats = () => {
    if (cancelStats) {
      cancelStats();
      cancelStats = null;
    }
  };

  /** Los mensajes que cambian el estado recordado (resize, running, still, pointer, stage). */
  const remember = (message: ToWorker) => {
    switch (message.type) {
      case "resize":
        mem.width = message.width;
        mem.height = message.height;
        mem.dpr = message.dpr;
        break;
      case "running":
        mem.running = message.value;
        break;
      case "still":
        mem.still = message.value;
        break;
      case "pointer":
        mem.pointer = { x: message.x, y: message.y, inside: message.inside };
        break;
      case "stage":
        mem.stage = message.position;
        break;
    }
  };

  /** En `ready` el mensaje además se reenvía a la escena. */
  const forward = (message: ToWorker) => {
    if (!scene) return;
    switch (message.type) {
      case "resize":
        scene.resize(message.width, message.height, message.dpr);
        break;
      case "running":
        scene.setRunning(message.value);
        break;
      case "still":
        scene.setStill(message.value);
        deps.post({ type: "status", status: message.value ? "still" : "live" });
        break;
      case "pointer":
        scene.setPointer(message.x, message.y, message.inside);
        break;
      case "stage":
        // La escena lee `readStage` en cada cuadro: no hay nada que empujar.
        break;
      case "pulse-at":
        scene.pulseAt(message.x, message.y);
        break;
      case "pulse-stage":
        scene.pulseStage(message.stage);
        break;
      case "invalidate":
        scene.invalidate();
        break;
    }
  };

  const postFallback = (reason: "no-webgl2" | "software" | "context-lost" | "error") => {
    phase = "closed";
    deps.post({ type: "status", status: "fallback", reason });
  };

  /** `dispose` o `contextLost` llegaron durante la carga: soltar lo creado sin postear. */
  const bailAfterAbort = () => {
    disposeScene();
  };

  /** La secuencia de `init`: contexto → carga → escena → estado recordado → listo. */
  const boot = async (init: InitMessage) => {
    // El drawing buffer nace a tamaño final: el canvas se mide antes del contexto
    if (init.width > 0 && init.height > 0) {
      const dpr = effectiveDpr(init.dpr, init.tier, 0);
      canvas!.width = Math.floor(init.width * dpr);
      canvas!.height = Math.floor(init.height * dpr);
    }

    gl = deps.createContext(canvas!, init.tier);
    if (!gl) {
      postFallback("no-webgl2");
      return;
    }

    // Render por CPU (SwiftShader, llvmpipe): respaldo sin bajar three
    if (isSoftwareRenderer(deps.rendererName(gl))) {
      deps.loseContext(gl);
      postFallback("software");
      return;
    }

    phase = "loading";
    try {
      const mod = await deps.loadScene();
      if (phase !== "loading") return bailAfterAbort();
      const T = await mod.loadThree();
      if (phase !== "loading") return bailAfterAbort();
      scene = mod.createScene(T, canvas!, gl, {
        tier: init.tier,
        palette: init.palette,
        still: mem.still,
        hover: init.hover,
        readStage: () => mem.stage,
      });
      // Lo último pedido durante la carga gana sobre lo del init
      scene.resize(mem.width, mem.height, mem.dpr);
      scene.setPointer(mem.pointer.x, mem.pointer.y, mem.pointer.inside);
      scene.setRunning(mem.running);
      await scene.ready;
      if (phase !== "loading") return bailAfterAbort();
      phase = "ready";
      deps.post({ type: "status", status: mem.still ? "still" : "live" });
      if (mem.debug) {
        cancelStats = deps.every(250, () => {
          if (scene) deps.post({ type: "stats", stats: { ...scene.stats } });
        });
      }
    } catch (error) {
      deps.warn("[n0icht] el fondo 3D no está disponible", error);
      disposeScene();
      postFallback("error");
    }
  };

  const handle = async (message: ToWorker): Promise<void> => {
    if (phase === "closed") return;
    if (message.type === "dispose") {
      disposeScene();
      stopStats();
      if (gl) deps.loseContext(gl);
      gl = null;
      phase = "closed";
      return;
    }
    if (message.type === "debug-lose-context") {
      if (mem.debug && gl) deps.loseContext(gl);
      return;
    }
    if (phase === "idle") {
      if (message.type !== "init") return;
      canvas = message.canvas;
      mem.tier = message.tier;
      mem.palette = message.palette;
      mem.still = message.still;
      mem.hover = message.hover;
      mem.debug = message.debug;
      mem.width = message.width;
      mem.height = message.height;
      mem.dpr = message.dpr;
      mem.running = message.running;
      mem.stage = message.stage;
      mem.pointer = { x: 0, y: 0, inside: false };
      await boot(message);
      return;
    }
    remember(message);
    if (phase === "ready") forward(message);
  };

  const contextLost = () => {
    if (phase === "closed") return;
    disposeScene();
    stopStats();
    phase = "closed";
    deps.post({ type: "status", status: "fallback", reason: "context-lost" });
  };

  return { handle, contextLost };
}
