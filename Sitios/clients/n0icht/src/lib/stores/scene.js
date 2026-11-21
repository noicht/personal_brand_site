// @ts-check
/**
 * Seguimiento del scroll para el fondo 3D y el estado que comparte con él.
 *
 * `stageAnchor` es una acción de Svelte que marca una sección como parada del recorrido:
 * mientras su caja cruza la línea del medio de la ventana (o la última que la pasó), esa
 * sección manda sobre la posición de la cámara. No hay listeners de scroll: un
 * IntersectionObserver con rootMargin -50% arriba y abajo detecta el cruce, y un
 * ResizeObserver invalida las medidas cacheadas.
 *
 * `readStagePosition` la usa `Background3D.svelte`: se la empuja al worker cuando
 * cambia el scroll o la sección activa (la escena la consulta en cada cuadro).
 * Devuelve la posición sobre el recorrido (0 = idea … 5 = observe, con decimales en
 * los bordes). Sin anclas usa el progreso de scroll de toda la página.
 */
import { writable } from "svelte/store";
import { alongRegion, stageFromProgress, stagePosition } from "../three/camera.ts";
import { stageIndex } from "../three/stages.ts";

/** Índice del cluster destacado (0 = idea … 5 = observe). */
export const activeStage = writable(0);

/** @typedef {"idle" | "live" | "still" | "fallback"} SceneStatus */

/** Estado de la escena 3D; lo escribe `Background3D.svelte`. */
export const sceneStatus = writable(/** @type {SceneStatus} */ ("idle"));

/**
 * Pulsos pedidos desde afuera del fondo: el contador sube en cada pedido y `stage` es la
 * parada del recorrido que lo recibe (deploy por defecto; el playground usa observe).
 * @type {import("svelte/store").Writable<{ count: number, stage: number }>}
 */
export const pulseRequests = writable({ count: 0, stage: stageIndex("deploy") });

/**
 * Pide un pulso en una etapa del recorrido (por defecto deploy, la del `deploy --prod`
 * de la terminal; el playground del sitio pide `observe`).
 * @param {import("../three/stages.ts").StageId | number} [stage]
 */
export function requestPulse(stage = "deploy") {
  pulseRequests.update((request) => ({ count: request.count + 1, stage: stageIndex(stage) }));
}

/** @typedef {{ stage: number, inView: boolean, passed: boolean }} Region */
/** @type {Map<Element, Region>} */
const regions = new Map();

/** @type {IntersectionObserver | null} */
let intersectionObserver = null;
/** @type {ResizeObserver | null} */
let resizeObserver = null;
/** @type {Element | null} */
let activeNode = null;
/** @type {Region | null} */
let activeRegion = null;
let top = 0;
let height = 0;
let stale = true;

/**
 * Orden de documento entre dos nodos anclados.
 * @param {Element} a
 * @param {Element} b
 */
function documentOrder(a, b) {
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

/**
 * Elige la región activa: la última que está cruzando la línea de lectura; si ninguna, la
 * última que ya la pasó; si ninguna, la primera en orden de documento.
 */
function pickActive() {
  const ordered = [...regions.keys()].sort(documentOrder);
  // La línea de lectura es la mitad de la ventana (el rootMargin -50% del observer).
  // inView/passed se miden en vivo: el observer solo avisa cuando un ancla CRUZA la
  // línea, y una que nunca la cruza (la última etapa, al fondo de la página) igual
  // tiene que contar como pasada.
  const line = window.innerHeight / 2;
  /** @type {Element | null} */
  let lastInView = null;
  /** @type {Element | null} */
  let lastPassed = null;
  for (const node of ordered) {
    const region = regions.get(node);
    if (!region) continue;
    const rect = node.getBoundingClientRect();
    region.inView = rect.top <= line && rect.bottom >= line;
    region.passed = rect.top < line;
    if (region.inView) lastInView = node;
    if (region.passed) lastPassed = node;
  }
  const chosen = lastInView ?? lastPassed ?? ordered[0] ?? null;

  if (chosen !== activeNode) {
    activeNode = chosen;
    activeRegion = chosen ? regions.get(chosen) ?? null : null;
    stale = true;
  }
  if (activeRegion) activeStage.set(activeRegion.stage);
}

/** Observadores compartidos, creados con el primer ancla. */
function ensureObservers() {
  if (intersectionObserver) return;
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const region = regions.get(/** @type {Element} */ (entry.target));
        if (!region) continue;
        region.inView = entry.isIntersecting;
        region.passed =
          entry.boundingClientRect.top < (entry.rootBounds ? entry.rootBounds.top : window.innerHeight / 2);
      }
      pickActive();
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
  );
  resizeObserver = new ResizeObserver(() => {
    stale = true;
  });
  resizeObserver.observe(document.body);
  // Un salto por ancla (o a un ancla) puede no cruzar la línea de lectura en ningún
  // ancla: el observer no dispara y la etapa activa queda vieja. scrollend reevalúa
  // al terminar el salto. Safari todavía no tiene scrollend: ahí queda el
  // comportamiento anterior (la etapa se actualiza en el próximo cruce).
  window.addEventListener("scrollend", pickActive, { passive: true });
}

/**
 * Acción de Svelte: `use:stageAnchor={"build"}` o `use:stageAnchor={2}` marca una sección
 * como parada del recorrido 3D. Sin IntersectionObserver (SSR o navegador viejo) no hace nada.
 * @param {Element} node
 * @param {import("../three/stages.ts").StageId | number} stage
 */
export function stageAnchor(node, stage) {
  if (typeof IntersectionObserver === "undefined") return {};
  ensureObservers();
  /** @type {Region} */
  const region = { stage: stageIndex(stage), inView: false, passed: false };
  regions.set(node, region);
  if (intersectionObserver) intersectionObserver.observe(node);
  pickActive();

  return {
    /** @param {import("../three/stages.ts").StageId | number} next */
    update(next) {
      const index = stageIndex(next);
      if (index === region.stage) return;
      region.stage = index;
      pickActive();
    },
    destroy() {
      if (intersectionObserver) intersectionObserver.unobserve(node);
      regions.delete(node);
      pickActive();
      if (regions.size === 0) {
        if (intersectionObserver) intersectionObserver.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
        intersectionObserver = null;
        resizeObserver = null;
        window.removeEventListener("scrollend", pickActive);
      }
    },
  };
}

/**
 * Posición sobre el recorrido (0..STAGE_COUNT-1), para la cámara. `Background3D.svelte`
 * la manda al worker cuando scrollea la página o cambia la sección activa; cuando la
 * región activa no cambió de tamaño solo lee scrollY e innerHeight.
 */
export function readStagePosition() {
  if (!activeRegion || !activeNode) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return stageFromProgress(max > 0 ? window.scrollY / max : 0);
  }
  if (stale) {
    const rect = activeNode.getBoundingClientRect();
    top = rect.top + window.scrollY;
    height = rect.height;
    stale = false;
  }
  return stagePosition(activeRegion.stage, alongRegion(window.scrollY + window.innerHeight / 2, top, height));
}
