<script>
  /**
   * Medidor de medio dial: un arco, un tick por unidad entera y la aguja en el valor. El número
   * va como texto real al lado (`5 yrs` + `in production`), así que el SVG es `aria-hidden`.
   * La geometría sale de `viz/gauge.ts`.
   */
  import { arcPath, gaugeFraction, gaugeTicks, polar } from "$lib/viz/gauge.ts";

  /** El `StackGauge` del grupo (`{ value, max, unit, label }`). */
  export let gauge;

  const CX = 84;
  const CY = 84;
  const R = 72;
  const TICK = 8;

  $: fraction = gaugeFraction(gauge.value, gauge.max);
  $: needle = polar(CX, CY, R - 14, fraction);
  $: ticks = gaugeTicks(gauge.max).map((tick) => {
    const outer = polar(CX, CY, R, tick);
    const inner = polar(CX, CY, R - TICK, tick);
    return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
  });
</script>

<div class="n0-gauge">
  <svg viewBox="0 0 168 92" aria-hidden="true">
    <path class="n0-gauge-arc" d={arcPath(CX, CY, R, 0, 1)} />
    {#each ticks as tick}
      <line class="n0-gauge-tick" x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
    {/each}
    <line class="n0-gauge-needle" x1={CX} y1={CY} x2={needle.x} y2={needle.y} />
    <rect class="n0-gauge-hub" x={CX - 4} y={CY - 4} width="8" height="8" />
  </svg>
  <p class="n0-gauge-read">
    <strong>{gauge.value} {gauge.unit}</strong>
    <span class="n0-micro">{gauge.label}</span>
  </p>
</div>
