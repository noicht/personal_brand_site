<script>
  /**
   * Fondo 3D del sitio: un grafo de arquitectura que sigue el scroll por las seis etapas.
   *
   * Three no está en el bundle inicial: el módulo de la escena (`src/lib/three/scene.ts`) y la
   * librería llegan con un `import()` dinámico que corre recién cuando la página cargó, pintó
   * su primer contenido y el navegador está ocioso. Si no hay WebGL2 de hardware, hay ahorro
   * de datos, el render es por software o el contexto se pierde, el div `.n0-bg` queda con su
   * fondo CSS de respaldo y no se descarga nada de three.
   *
   * - `data-scene` dice el estado (`idle`, `live`, `still`, `fallback`) y `is-live` prende el
   *   canvas; la opacidad la maneja `--scene-intensity` en site.css.
   * - Con `prefers-reduced-motion` la escena queda en un cuadro fijo (`still`).
   * - `?debug3d` muestra un HUD con fps, cluster y calidad; `?debug3d=low|high` fuerza el tier.
   * - Los clics sobre el fondo mandan un pulso al nodo más cercano; los pulsos pedidos
   *   desde afuera (`deploy --prod` en la terminal, las fallas del playground) llegan por
   *   `pulseRequests`.
   */
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { activeStage, pulseRequests, readStagePosition, sceneStatus } from "$lib/stores/scene.js";
  import { effectiveDpr, isSoftwareRenderer, pickQuality, TIERS } from "$lib/three/quality.ts";
  import { STAGES } from "$lib/three/stages.ts";

  /** Selectores cuyo click no dispara un pulso: la UI siempre gana. */
  const EXCLUDED =
    'a, button, input, textarea, select, label, summary, dialog, [role="button"], ' +
    '[tabindex]:not([tabindex="-1"]), .n0-panel, .site-header';

  /** @type {HTMLCanvasElement} */
  let canvas;
  /** @type {import("$lib/three/scene.ts").SceneHandle | null} */
  let scene = null;
  /** @type {import("$lib/three/quality.ts").QualityTier | null} */
  let tier = null;
  /** @type {WebGL2RenderingContext | null} */
  let gl = null;

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
    let destroyed = false;

    // ---------- HUD de debug (existe aunque la escena no llegue a cargar) ----------

    const buildHud = () => {
      if (!scene || !tier) {
        const stage = get(activeStage);
        hud = `scene=${status} · cluster=${stage + 1}/6 ${STAGES[stage]}`;
        return;
      }
      const s = scene.stats;
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

    // Ahorro de datos: ni contexto ni three; el fondo queda en el CSS de respaldo
    if (nav.connection?.saveData === true) {
      status = "fallback";
      buildHud();
      return () => clearInterval(hudTimer);
    }

    // ---------- helpers de la escena ----------

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

    const applySize = () => {
      if (scene) scene.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    };

    const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

    // ---------- arranque: load -> primer paint -> idle -> start ----------

    let idleHandle = 0;
    let idleViaCallback = false;
    /** @type {PerformanceObserver | null} */
    let paintObserver = null;
    /** @type {(() => void) | null} */
    let loadListener = null;

    const cancelScheduled = () => {
      if (loadListener) window.removeEventListener("load", loadListener);
      paintObserver?.disconnect();
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

    // ---------- la escena: cada paso en su propia tarea ----------

    const start = async () => {
      // 1. El drawing buffer nace a tamaño final: el canvas se mide antes del contexto
      const dpr = effectiveDpr(window.devicePixelRatio || 1, tier, 0);
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
      }

      // 2. Contexto WebGL2
      try {
        gl = canvas.getContext("webgl2", {
          alpha: true,
          antialias: tier.antialias,
          depth: true,
          stencil: false,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: true,
        });
      } catch {
        gl = null;
      }
      if (!gl) {
        status = "fallback";
        buildHud();
        return;
      }

      // 3. Render por CPU (SwiftShader, llvmpipe): respaldo sin bajar three
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const rendererName = String(
        info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      );
      if (isSoftwareRenderer(rendererName)) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        gl = null;
        status = "fallback";
        buildHud();
        return;
      }

      // Después de cada await: destruido -> liberar lo que haya; contexto perdido
      // (status "fallback" por webglcontextlost) -> salir sin tocar el estado
      const bail = () => {
        if (destroyed && scene) {
          scene.dispose();
          scene = null;
        }
        return destroyed || status === "fallback";
      };

      try {
        // 4. El módulo de la escena y three
        const mod = await import("$lib/three/scene.ts");
        if (bail()) return;
        const T = await mod.loadThree();
        if (bail()) return;
        // 5. Evaluación de three y armado de la escena en tareas separadas
        await nextTask();
        if (bail()) return;
        // 6.
        scene = mod.createScene(T, canvas, gl, {
          tier,
          palette: readPalette(),
          still: reduce.matches,
          hover,
          readStage: readStagePosition,
        });
        // 7.
        await nextTask();
        if (bail()) return;
        applySize();
        scene.setRunning(visible && onScreen);
        // 8.
        await scene.ready;
        if (bail()) return;
        if (!scene) return;
        status = reduce.matches ? "still" : "live";
        buildHud();
      } catch (error) {
        console.warn("[n0icht] el fondo 3D no está disponible", error);
        if (scene) {
          scene.dispose();
          scene = null;
        }
        status = "fallback";
        buildHud();
      }
    };

    afterLoad(() => {
      waitFirstPaint(scheduleIdle);
    });

    // ---------- listeners y suscripciones ----------

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) onScreen = entry.isIntersecting;
      if (scene) scene.setRunning(visible && onScreen);
    });
    intersectionObserver.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
      if (scene) scene.setRunning(visible && onScreen);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onReduceChange = (event) => {
      if (!scene) return;
      scene.setStill(event.matches);
      status = event.matches ? "still" : "live";
      buildHud();
    };
    reduce.addEventListener("change", onReduceChange);

    const onPointerMove = (event) => {
      if (event.pointerType === "touch" || !scene) return;
      scene.setPointer(event.clientX, event.clientY, true);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onPointerLeave = () => {
      if (scene) scene.setPointer(0, 0, false);
    };
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const onClick = (event) => {
      if (!scene || event.button !== 0 || event.defaultPrevented) return;
      if (window.getSelection()?.toString()) return;
      if (event.target instanceof Element && event.target.closest(EXCLUDED)) return;
      scene.pulseAt(event.clientX, event.clientY);
    };
    window.addEventListener("click", onClick);

    const onContextLost = (event) => {
      event.preventDefault();
      if (scene) {
        scene.dispose();
        scene = null;
      }
      status = "fallback";
      buildHud();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    // Un pulso pedido desde afuera (deploy --prod en la terminal, fallas del playground)
    // enciende el cluster de su etapa; el cambio de etapa redibuja el cuadro fijo del
    // modo still
    let pulseFirst = true;
    const unsubscribePulses = pulseRequests.subscribe((request) => {
      if (pulseFirst) {
        pulseFirst = false;
        return;
      }
      if (scene) scene.pulseStage(request.stage);
    });
    const unsubscribeStage = activeStage.subscribe(() => {
      if (scene) scene.invalidate();
    });

    // ---------- limpieza única ----------

    return () => {
      destroyed = true;
      clearInterval(hudTimer);
      cancelScheduled();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
      reduce.removeEventListener("change", onReduceChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      unsubscribePulses();
      unsubscribeStage();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (scene) {
        scene.dispose();
        scene = null;
      }
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
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
