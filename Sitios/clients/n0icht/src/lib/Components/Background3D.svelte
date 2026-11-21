<script>
  /**
   * Fondo 3D del sitio: un grafo de arquitectura que sigue el scroll por las seis etapas.
   *
   * La escena vive en un Web Worker (`src/lib/three/scene.worker.ts`) con el canvas
   * transferido por `transferControlToOffscreen()`: three, la creación de la escena
   * y cada cuadro corren fuera del hilo principal, que solo reenvía inputs. Three
   * no está en el bundle inicial: el worker se crea recién cuando la página cargó,
   * pintó su primer contenido, pasó un margen de asentamiento y el navegador está
   * ocioso. Si no hay Worker, no hay
   * transferControlToOffscreen, no hay WebGL2 de hardware, el render es por software
   * o el contexto se pierde, el div `.n0-bg` queda con su fondo CSS de respaldo.
   *
   * - `data-scene` dice el estado (`idle`, `live`, `still`, `fallback`) y `is-live` prende el
   *   canvas; la opacidad la maneja `--scene-intensity` en site.css.
   * - Con `prefers-reduced-motion` la escena queda en un cuadro fijo (`still`); el
   *   worker avisa el estado nuevo, acá no se setea a mano.
   * - `?debug3d` muestra un HUD con fps, cluster y calidad; `?debug3d=low|high` fuerza el tier.
   * - Los clics sobre el fondo mandan un pulso al nodo más cercano; los pulsos pedidos
   *   desde afuera (`deploy --prod` en la terminal, las fallas del playground) llegan por
   *   `pulseRequests`.
   */
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { activeStage, pulseRequests, readStagePosition, sceneStatus } from "$lib/stores/scene.js";
  import { pickQuality, TIERS } from "$lib/three/quality.ts";
  import { STAGES } from "$lib/three/stages.ts";

  /** Selectores cuyo click no dispara un pulso: la UI siempre gana. */
  const EXCLUDED =
    'a, button, input, textarea, select, label, summary, dialog, [role="button"], ' +
    '[tabindex]:not([tabindex="-1"]), .n0-panel, .site-header';

  /**
   * Margen entre el primer pintado y el pedido de arranque de la escena. La escena es
   * decorativa y su arranque satura el proceso de GPU; en el primer segundo después de
   * que aparece la página el hilo principal todavía está hidratando, y el propio Chrome
   * desmonta el compositor del documento anterior ~1 s después de la navegación, lo que
   * espera sobre ese mismo proceso de GPU: arrancar el worker en ese momento bloqueó el
   * hilo principal 30–90 ms (medido). Por eso la escena espera 1,2 s después del primer
   * pintado y recién ahí pide un hueco ocioso.
   */
  const SCENE_SETTLE_MS = 1200;

  /** @type {HTMLCanvasElement} */
  let canvas;
  /** @type {import("$lib/three/quality.ts").QualityTier | null} */
  let tier = null;
  /** @type {Worker | null} */
  let worker = null;
  /** Últimos stats que mandó el worker, para el HUD. */
  /** @type {import("$lib/three/scene.ts").SceneStats | null} */
  let latestStats = null;

  let status = "idle";
  let debug = false;
  let hud = "";

  // El estado se refleja al store para que otros componentes (la terminal) lo lean
  $: sceneStatus.set(status);

  onMount(() => {
    const params = new URLSearchParams(location.search);
    debug = params.has("debug3d");
    const forcedTier = params.get("debug3d");

    // Pistas del dispositivo para elegir el tier (deviceMemory y connection no son estándar:
    // se leen por `any` para que el chequeo de tipos no se queje)
    const nav = /** @type {any} */ (navigator);
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    tier =
      forcedTier === "low" || forcedTier === "high"
        ? TIERS[forcedTier]
        : pickQuality({
            width: window.innerWidth,
            coarsePointer,
            deviceMemory: nav.deviceMemory,
            hardwareConcurrency: nav.hardwareConcurrency,
            saveData: nav.connection?.saveData === true,
          });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let visible = !document.hidden;
    let onScreen = true;

    // ---------- HUD de debug (existe aunque la escena no llegue a cargar) ----------

    const buildHud = () => {
      if (!latestStats || !tier) {
        const stage = get(activeStage);
        hud = `scene=${status} · cluster=${stage + 1}/6 ${STAGES[stage]}`;
        return;
      }
      const s = latestStats;
      hud =
        `scene=${status} · fps=${Math.round(s.fps)} · cluster=${s.cluster + 1}/6 ${STAGES[s.cluster]} · ` +
        `pos=${s.position.toFixed(2)} · quality=${tier.name}/${s.level} · dpr=${s.dpr.toFixed(2)} · ` +
        `nodes=${s.nodes} · calls=${s.calls} · frames=${s.frames} · pulses=${s.pulses}`;
    };
    let hudTimer = 0;
    if (debug) {
      buildHud();
      hudTimer = setInterval(buildHud, 500);
    }

    // Ahorro de datos: ni worker ni three; el fondo queda en el CSS de respaldo
    if (nav.connection?.saveData === true) {
      status = "fallback";
      buildHud();
      return () => clearInterval(hudTimer);
    }

    // ---------- helpers ----------

    const readPalette = () => {
      const styles = getComputedStyle(canvas);
      const token = (name) => (styles.getPropertyValue(name) || "").trim();
      return {
        bg: token("--c-bg"),
        panel: token("--c-panel"),
        border: token("--c-border"),
        borderStrong: token("--c-border-strong"),
        amber: token("--c-amber"),
        green: token("--c-green"),
        cyan: token("--c-cyan"),
        text: token("--c-text"),
        muted: token("--c-muted"),
      };
    };

    // ---------- mensajes del worker ----------

    /** El worker cayó en respaldo (o el script falló): se termina y se limpia el listener de scroll. */
    const failToFallback = () => {
      worker?.terminate();
      worker = null;
      window.removeEventListener("scroll", markStageDirty);
      status = "fallback";
      buildHud();
    };

    const onWorkerMessage = (event) => {
      const data = event.data;
      if (data?.type === "status") {
        if (data.status === "fallback") failToFallback();
        else {
          status = data.status;
          buildHud();
        }
      } else if (data?.type === "stats") {
        latestStats = data.stats;
        buildHud();
      }
    };

    const onWorkerError = (event) => {
      // Worker no soportado como módulo, script que no cargó, error no capturado
      event.preventDefault();
      failToFallback();
    };

    // ---------- reenvío de inputs, coalescido a un frame ----------

    const pointer = { x: 0, y: 0, inside: false };
    let pointerDirty = false;
    let stageDirty = false;
    // La etapa cambió: el invalidate va DESPUÉS del stage en la cola del worker, así el
    // cuadro fijo del modo still se redibuja con la posición nueva (si llega antes,
    // dibuja con el stage viejo y stats queda trabado).
    let stageInvalidate = false;
    let flushRaf = 0;
    let lastStage = 0;

    const flush = () => {
      flushRaf = 0;
      if (!worker) {
        pointerDirty = false;
        stageDirty = false;
        stageInvalidate = false;
        return;
      }
      if (pointerDirty) {
        pointerDirty = false;
        worker.postMessage({ type: "pointer", x: pointer.x, y: pointer.y, inside: pointer.inside });
      }
      if (stageDirty) {
        stageDirty = false;
        const position = readStagePosition();
        if (position !== lastStage) {
          lastStage = position;
          worker.postMessage({ type: "stage", position });
        }
      }
      if (stageInvalidate) {
        stageInvalidate = false;
        worker.postMessage({ type: "invalidate" });
      }
    };

    // Un rAF por frame y solo cuando algo cambió: no hay loop permanente en el hilo principal
    const scheduleFlush = () => {
      if (flushRaf || !worker) return;
      flushRaf = requestAnimationFrame(flush);
    };
    const markPointerDirty = () => {
      pointerDirty = true;
      scheduleFlush();
    };
    const markStageDirty = () => {
      stageDirty = true;
      scheduleFlush();
    };

    // ---------- arranque: load -> primer paint -> idle -> worker ----------

    let idleHandle = 0;
    let idleViaCallback = false;
    let settleTimer = 0;
    /** @type {PerformanceObserver | null} */
    let paintObserver = null;
    /** @type {(() => void) | null} */
    let loadListener = null;

    const cancelScheduled = () => {
      if (loadListener) window.removeEventListener("load", loadListener);
      paintObserver?.disconnect();
      clearTimeout(settleTimer);
      if (idleViaCallback && typeof cancelIdleCallback === "function") cancelIdleCallback(idleHandle);
      else clearTimeout(idleHandle);
    };

    const scheduleIdle = () => {
      if (typeof requestIdleCallback === "function") {
        idleViaCallback = true;
        idleHandle = requestIdleCallback(start, { timeout: 2500 });
      } else {
        idleViaCallback = false;
        idleHandle = setTimeout(start, 300);
      }
    };

    // El primer pintado llega solo cuando la pestaña se ve: una pestaña en segundo plano
    // espera a hacerse visible para arrancar la escena
    const waitFirstPaint = (done) => {
      if (performance.getEntriesByName("first-contentful-paint").length > 0) {
        done();
        return;
      }
      if (!PerformanceObserver.supportedEntryTypes?.includes("paint")) {
        done();
        return;
      }
      paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            paintObserver?.disconnect();
            paintObserver = null;
            done();
            return;
          }
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });
    };

    const afterLoad = (done) => {
      if (document.readyState === "complete") {
        done();
        return;
      }
      loadListener = () => {
        loadListener = null;
        done();
      };
      window.addEventListener("load", loadListener, { once: true });
    };

    // ---------- el worker: canvas transferido + init ----------

    const start = () => {
      if (typeof Worker === "undefined" || typeof canvas.transferControlToOffscreen !== "function") {
        status = "fallback";
        buildHud();
        return;
      }
      let offscreen;
      try {
        offscreen = canvas.transferControlToOffscreen();
      } catch {
        status = "fallback";
        buildHud();
        return;
      }
      worker = new Worker(new URL("../three/scene.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = onWorkerMessage;
      worker.onerror = onWorkerError;
      // La posición sobre el recorrido se empuja al worker cuando scrollea la página
      window.addEventListener("scroll", markStageDirty, { passive: true });
      const stage = readStagePosition();
      lastStage = stage;
      worker.postMessage(
        {
          type: "init",
          canvas: offscreen,
          tier,
          palette: readPalette(),
          still: reduce.matches,
          hover,
          debug,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          dpr: window.devicePixelRatio || 1,
          running: visible && onScreen,
          stage,
        },
        [offscreen],
      );
    };

    afterLoad(() => {
      waitFirstPaint(() => {
        settleTimer = setTimeout(scheduleIdle, SCENE_SETTLE_MS);
      });
    });

    // ---------- listeners y suscripciones ----------

    const resizeObserver = new ResizeObserver(() => {
      markStageDirty();
      worker?.postMessage({
        type: "resize",
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        dpr: window.devicePixelRatio || 1,
      });
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen = entry.isIntersecting;
      worker?.postMessage({ type: "running", value: visible && onScreen });
    });
    intersectionObserver.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
      worker?.postMessage({ type: "running", value: visible && onScreen });
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onReduceChange = (event) => {
      // El worker reenvía el estado (still/live) por su cuenta
      worker?.postMessage({ type: "still", value: event.matches });
    };
    reduce.addEventListener("change", onReduceChange);

    const onPointerMove = (event) => {
      if (event.pointerType === "touch") return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      markPointerDirty();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onPointerLeave = () => {
      pointer.inside = false;
      markPointerDirty();
    };
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const onClick = (event) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      if (window.getSelection()?.toString()) return;
      if (event.target instanceof Element && event.target.closest(EXCLUDED)) return;
      worker?.postMessage({ type: "pulse-at", x: event.clientX, y: event.clientY });
    };
    window.addEventListener("click", onClick);

    // Hook de prueba del harness: con ?debug3d el worker acepta debug-lose-context
    const onDebugLose = () => {
      worker?.postMessage({ type: "debug-lose-context" });
    };
    if (debug) window.addEventListener("n0icht:debug3d-lose", onDebugLose);

    // Un pulso pedido desde afuera (deploy --prod en la terminal, fallas del playground)
    // enciende el cluster de su etapa; el cambio de etapa marca el stage para el
    // próximo flush y redibuja el cuadro fijo del modo still
    let pulseFirst = true;
    const unsubscribePulses = pulseRequests.subscribe((request) => {
      if (pulseFirst) {
        pulseFirst = false;
        return;
      }
      worker?.postMessage({ type: "pulse-stage", stage: request.stage });
    });
    const unsubscribeStage = activeStage.subscribe(() => {
      markStageDirty();
      stageInvalidate = true;
      scheduleFlush();
    });

    // ---------- limpieza única ----------

    return () => {
      clearInterval(hudTimer);
      cancelScheduled();
      if (flushRaf) cancelAnimationFrame(flushRaf);
      window.removeEventListener("scroll", markStageDirty);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onReduceChange);
      window.removeEventListener("n0icht:debug3d-lose", onDebugLose);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      unsubscribePulses();
      unsubscribeStage();
      worker?.terminate();
      worker = null;
    };
  });
</script>


<!-- El canvas es decorativo: aria-hidden y sin pointer-events para que la UI quede arriba.
     El estado viaja en data-scene (idle, live, still, fallback) y en el store sceneStatus. -->
<div class="n0-bg" class:is-live={status === "live" || status === "still"} data-scene={status} aria-hidden="true">
  <canvas class="n0-bg-canvas" bind:this={canvas} aria-hidden="true"></canvas>
</div>

{#if debug}
  <p class="n0-bg-hud" aria-hidden="true">{hud}</p>
{/if}
