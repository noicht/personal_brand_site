<script>
  /**
   * Controles del playground: tráfico, arquitectura (toggles con su trade-off), ratio de hits,
   * instancias de API y las fallas inyectables. Totalmente controlado — recibe `config` y avisa
   * con `change` (`Partial<Config>`) o `coldstart`; no guarda copia local.
   *
   * Solo elementos nativos: ranges, checkboxes `role="switch"` con su pastilla decorativa,
   * radios y botones. Cada control tiene nombre accesible y `aria-describedby` a su ayuda;
   * los ids llevan el prefijo `n0-pg-`.
   */
  import { createEventDispatcher } from "svelte";
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import { fill } from "$lib/terminal/commands.ts";
  import { formatPercent } from "$lib/playground/format.ts";
  import {
    HIT_MAX,
    HIT_MIN,
    HIT_STEP,
    RPS_MAX,
    RPS_MIN,
    RPS_STEP,
    TOGGLE_IDS,
  } from "$lib/playground/model.ts";

  /** Las fallas que prenden/apagan con un toggle (`coldStart` es momentánea, va aparte). */
  /** @type {readonly ("dbDown" | "apiDown")[]} */
  const FAILURE_TOGGLES = ["dbDown", "apiDown"];

  /** Config actual del simulador (la dueña es `Playground.svelte`). */
  export let config;

  const dispatch = createEventDispatcher();

  /** Valor numérico de un input de rango en el evento. */
  /** @param {Event} event */
  function num(event) {
    return Number(/** @type {HTMLInputElement} */ (event.currentTarget).value);
  }

  /** Porcentaje entero de un ratio 0..1 para las plantillas de mezcla. */
  /** @param {number} ratio */
  function pct(ratio) {
    return String(Math.round(ratio * 100));
  }
</script>

<div class="n0-pg-controls">
  <fieldset class="n0-pg-field n0-pg-traffic">
    <legend>{copy.traffic.legend}</legend>
    <div class="n0-pg-slider">
      <label for="n0-pg-rps">{copy.traffic.label}</label>
      <div class="n0-pg-slider-row">
        <input
          id="n0-pg-rps"
          class="n0-pg-range"
          type="range"
          min={RPS_MIN}
          max={RPS_MAX}
          step={RPS_STEP}
          value={config.rps}
          aria-valuetext={fill(copy.traffic.valueText, { rps: String(config.rps) })}
          on:input={(event) => dispatch("change", { rps: num(event) })}
        />
        <span class="n0-pg-slider-value" aria-hidden="true">{config.rps} {copy.metrics.throughput.unit}</span>
      </div>
      <p class="n0-pg-mix">
        {fill(copy.traffic.mix, { reads: pct(config.readRatio), writes: pct(1 - config.readRatio) })}
      </p>
    </div>
  </fieldset>

  <fieldset class="n0-pg-field n0-pg-arch">
    <legend>{copy.togglesLegend}</legend>
    {#each TOGGLE_IDS as id (id)}
      <div class="n0-pg-toggle">
        <label class="n0-pg-toggle-label">
          <input
            type="checkbox"
            role="switch"
            class="n0-pg-toggle-input"
            checked={config[id]}
            aria-describedby="n0-pg-tradeoff-{id}"
            on:change={(event) =>
              dispatch("change", { [id]: /** @type {HTMLInputElement} */ (event.currentTarget).checked })}
          />
          <span class="n0-pg-switch" aria-hidden="true"><span class="n0-pg-knob"></span></span>
          <span class="n0-pg-toggle-name">{copy.toggles[id].label}</span>
        </label>
        <p class="n0-pg-tradeoff" id="n0-pg-tradeoff-{id}">{copy.toggles[id].tradeoff}</p>

        {#if id === "cache"}
          <div class="n0-pg-sub">
            <div class="n0-pg-slider">
              <label for="n0-pg-hitrate">{copy.hitRatio.label}</label>
              <div class="n0-pg-slider-row">
                <input
                  id="n0-pg-hitrate"
                  class="n0-pg-range"
                  type="range"
                  min={HIT_MIN * 100}
                  max={HIT_MAX * 100}
                  step={HIT_STEP * 100}
                  value={Math.round(config.cacheHitRatio * 100)}
                  disabled={!config.cache}
                  aria-valuetext={fill(copy.hitRatio.valueText, {
                    hit: formatPercent(config.cacheHitRatio),
                  })}
                  on:input={(event) => dispatch("change", { cacheHitRatio: num(event) / 100 })}
                />
                <span class="n0-pg-slider-value" aria-hidden="true">{Math.round(config.cacheHitRatio * 100)}%</span>
              </div>
            </div>
          </div>
        {/if}

        {#if id === "loadBalancer"}
          <div class="n0-pg-sub">
            <fieldset class="n0-pg-instances" disabled={!config.loadBalancer}>
              <legend>{copy.instances.legend}</legend>
              {#each [2, 3] as count (count)}
                <label class="n0-pg-radio">
                  <input
                    type="radio"
                    name="n0-pg-instances"
                    checked={config.instances === count}
                    on:change={() => dispatch("change", { instances: count })}
                  />
                  {fill(copy.instances.option, { count: String(count) })}
                </label>
              {/each}
            </fieldset>
          </div>
        {/if}
      </div>
    {/each}
  </fieldset>

  <fieldset class="n0-pg-field n0-pg-failures">
    <legend>{copy.failuresLegend}</legend>
    {#each FAILURE_TOGGLES as id (id)}
      <div class="n0-pg-failure">
        <button
          type="button"
          class="n0-pg-failbtn"
          aria-pressed={config[id]}
          aria-describedby="n0-pg-failhint-{id}"
          on:click={() => dispatch("change", { [id]: !config[id] })}
        >
          {copy.failures[id].label}
        </button>
        <p class="n0-pg-failhint" id="n0-pg-failhint-{id}">{copy.failures[id].hint}</p>
      </div>
    {/each}
    <div class="n0-pg-failure">
      <button
        type="button"
        class="n0-pg-failbtn"
        disabled={!config.cache}
        aria-describedby="n0-pg-failhint-coldStart"
        on:click={() => dispatch("coldstart")}
      >
        {copy.failures.coldStart.label}
      </button>
      <p class="n0-pg-failhint" id="n0-pg-failhint-coldStart">{copy.failures.coldStart.hint}</p>
    </div>
  </fieldset>
</div>
