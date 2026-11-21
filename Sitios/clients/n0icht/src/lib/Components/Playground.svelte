<script>
  /**
   * Raíz lazy del playground: tiene la config y el estado de la simulación, corre el tick
   * fijo (`TICK_SECONDS`) solo mientras la sección está en pantalla y la pestaña visible, y
   * mantiene la región viva (`role="status"`) con un resumen de la salud.
   *
   * - `config` arranca en `PRESETS.naive`; los presets la reemplazan y `sim` vuelve a
   *   `initialState()`. Los controles avisan `change` (`Partial<Config>`) y `coldstart`.
   * - `requestPulse("observe")` suena en el fondo 3D cuando una falla se prende y en cada
   *   cold start.
   * - El texto vivo se reescribe con debounce de 900 ms después de una acción del usuario y
   *   cuando `health` cambia entre ticks — nunca por tick ni al montar.
   * - `data-sim` expone `running`/`paused` para las pruebas y el debugging.
   *
   * Importa `playground.css` acá para que el CSS viaje en el mismo chunk lazy.
   */
  import { onMount } from "svelte";
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import { fill } from "$lib/terminal/commands.ts";
  import { requestPulse } from "$lib/stores/scene.js";
  import { formatMs, formatPercent } from "$lib/playground/format.ts";
  import {
    TICK_SECONDS,
    coldStart,
    healthOf,
    initialState,
    measure,
    normalizeConfig,
    step,
  } from "$lib/playground/model.ts";
  import { PRESETS, PRESET_IDS, matchPreset } from "$lib/playground/presets.ts";
  import Panel from "./Panel.svelte";
  import PlaygroundControls from "./PlaygroundControls.svelte";
  import PlaygroundDiagram from "./PlaygroundDiagram.svelte";
  import PlaygroundMetrics from "./PlaygroundMetrics.svelte";
  import Tag from "./Tag.svelte";
  import "$lib/css/playground.css";

  /** Config del simulador; los presets la reemplazan entera. */
  let config = PRESETS.naive;
  /** Estado que evoluciona con el tiempo (calor de caché y backlog de cola). */
  let sim = initialState();

  $: metrics = measure(config, sim);
  $: health = healthOf(metrics);
  $: presetId = matchPreset(config);

  /** @type {HTMLDivElement} */
  let root;
  let running = false;
  let reduced = false;
  let liveText = "";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let liveTimer = null;
  /** Último health ya anunciado (para no escribir al montar). @type {import("$lib/playground/model.ts").Health | null} */
  let announced = null;

  /** Texto vivo con debounce: lo llaman las acciones y el watcher de `health`. */
  function scheduleLive() {
    if (liveTimer !== null) clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      liveTimer = null;
      writeLive();
    }, 900);
  }

  /** Arma el resumen con las plantillas del contenido y el formato de números. */
  function writeLive() {
    const healthText = copy.health[health];
    liveText =
      metrics.p50 === null
        ? fill(copy.live.outage, { health: healthText })
        : fill(copy.live.summary, {
            health: healthText,
            p50: formatMs(/** @type {number} */ (metrics.p50)),
            p95: formatMs(/** @type {number} */ (metrics.p95)),
            throughput: String(Math.round(metrics.throughput)),
            errors: formatPercent(metrics.errorRate),
            dbLoad: metrics.dbLoad === null ? copy.live.dbDown : `${formatPercent(metrics.dbLoad)}%`,
          });
  }

  /** Un preset reemplaza la config y reinicia el estado de la simulación. */
  /** @param {import("$lib/playground/presets.ts").PresetId} id */
  function applyPreset(id) {
    config = PRESETS[id];
    sim = initialState();
    scheduleLive();
  }

  /** `change` de los controles: normaliza y pulso si una falla recién se prendió. */
  /** @param {CustomEvent<Partial<import("$lib/playground/model.ts").Config>>} event */
  function onChange(event) {
    const next = normalizeConfig({ ...config, ...event.detail });
    if ((next.dbDown && !config.dbDown) || (next.apiDown && !config.apiDown)) {
      requestPulse("observe");
    }
    config = next;
    scheduleLive();
  }

  /** Cold start: la caché arranca fría y el fondo 3D avisa con un pulso. */
  function onColdstart() {
    sim = coldStart(sim);
    requestPulse("observe");
    scheduleLive();
  }

  // La región viva se reescribe cuando cambia la salud entre ticks (no al montar ni por tick)
  $: if (health !== announced) {
    if (announced !== null) scheduleLive();
    announced = health;
  }

  onMount(() => {
    // Reduced motion: los valores siguen actualizándose; solo se apagan los paquetes
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = motion.matches;
    /** @param {MediaQueryListEvent} event */
    const onMotion = (event) => {
      reduced = event.matches;
    };
    motion.addEventListener("change", onMotion);

    // Tick fijo solo mientras la sección está en pantalla y la pestaña visible
    let onScreen = false;
    /** @type {ReturnType<typeof setInterval> | null} */
    let timer = null;
    const sync = () => {
      const active = onScreen && !document.hidden;
      running = active;
      if (active && timer === null) {
        timer = setInterval(() => {
          const next = step(config, sim, TICK_SECONDS);
          if (next !== sim) sim = next;
        }, TICK_SECONDS * 1000);
      } else if (!active && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(root);
    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
      if (timer !== null) clearInterval(timer);
      if (liveTimer !== null) clearTimeout(liveTimer);
    };
  });
</script>

<div class="n0-pg-root" bind:this={root} data-sim={running ? "running" : "paused"}>
  <Panel label={copy.panelLabel}>
    <Tag slot="status" tone={health === "ok" ? "green" : "amber"}>{copy.health[health]}</Tag>
    <div class="n0-pg-grid">
      <div class="n0-pg-presets" role="group" aria-label={copy.presetsLabel}>
        {#each PRESET_IDS as id (id)}
          <button
            type="button"
            class="n0-pg-preset"
            class:is-active={presetId === id}
            aria-pressed={presetId === id}
            on:click={() => applyPreset(id)}
          >
            {copy.presets[id].label}
          </button>
        {/each}
        <p class="n0-pg-preset-hint">{presetId ? copy.presets[presetId].hint : copy.customHint}</p>
      </div>
      <div class="n0-pg-stage">
        <PlaygroundMetrics {metrics} {config} />
        <PlaygroundDiagram {config} {metrics} animate={running && !reduced} />
      </div>
      <PlaygroundControls {config} on:change={onChange} on:coldstart={onColdstart} />
    </div>
    <p class="n0-sr" role="status" aria-live="polite">{liveText}</p>
  </Panel>
</div>
