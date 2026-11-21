/**
 * El worker de la escena 3D: solo cableado, la lógica está en `host.ts`. Acá se
 * arman las dependencias reales del navegador — el contexto WebGL2 sobre el
 * OffscreenCanvas transferido, la carga de `scene.ts`/three recién cuando el
 * contexto sirve, los intervalos — y se enchufa `onmessage` al host.
 *
 * No lleva `/// <reference lib="webworker" />`: ese triple-chocaría con la lib
 * DOM que usa svelte-check; el scope se tipa con una interfaz local.
 */
import { createSceneHost } from "./host.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

interface WorkerScope {
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
}

const scope = self as unknown as WorkerScope;

const host = createSceneHost({
  post: (message) => scope.postMessage(message),
  createContext: (canvas, tier) => {
    try {
      return canvas.getContext("webgl2", {
        alpha: true,
        antialias: tier.antialias,
        depth: true,
        stencil: false,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: true,
      });
    } catch {
      return null;
    }
  },
  rendererName: (gl) => {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  },
  loseContext: (gl) => {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  },
  loadScene: () => import("./scene.ts"),
  every: (ms, fn) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
  warn: (message, error) => console.warn(message, error),
});

scope.onmessage = (event) => {
  const message = event.data;
  if (message?.type === "init") {
    // El canvas transferido avisa la pérdida por su cuenta; preventDefault evita
    // que el navegador intente restaurarlo solo.
    message.canvas.addEventListener("webglcontextlost", (lost) => {
      lost.preventDefault();
      host.contextLost();
    });
  }
  void host.handle(message);
};
