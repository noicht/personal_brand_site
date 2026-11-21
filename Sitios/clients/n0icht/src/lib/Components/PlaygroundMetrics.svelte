<script>
  /**
   * Métricas vivas del playground: un `role="group"` con una `<dl>` adentro — p50, p95,
   * throughput, error rate, DB load y, solo con la cola prendida, queue lag. Cada `<dt>`
   * lleva el nombre largo y el corto: abajo de 48rem se lee el corto (el largo queda para
   * lectores de pantalla) y arriba el largo (el corto `display: none`). Los valores `null`
   * muestran el texto del contenido (`n/a`, `DOWN`, `STALLED`) sin unidad. Sin región viva:
   * el `role="status"` está en la raíz.
   */
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import { formatMs, formatPercent, formatSeconds } from "$lib/playground/format.ts";

  /** Métricas del instante (`measure` de `playground/model.ts`). */
  export let metrics;

  /** Config actual: la fila de queue lag solo aparece con la cola prendida. */
  export let config;

  /** Filas de la lista: `value` null muestra `fallback` sin unidad; si no, valor + unidad. */
  $: rows = [
    { id: "p50", value: metrics.p50 === null ? null : formatMs(metrics.p50), fallback: copy.none },
    { id: "p95", value: metrics.p95 === null ? null : formatMs(metrics.p95), fallback: copy.none },
    { id: "throughput", value: String(Math.round(metrics.throughput)) },
    { id: "errorRate", value: formatPercent(metrics.errorRate) },
    { id: "dbLoad", value: metrics.dbLoad === null ? null : formatPercent(metrics.dbLoad), fallback: copy.dbDownValue },
    ...(config.queue
      ? [{ id: "queueLag", value: metrics.queueLag === null ? null : formatSeconds(metrics.queueLag), fallback: copy.queueStalled }]
      : []),
  ];
</script>

<div class="n0-pg-metrics" role="group" aria-label={copy.metricsLabel}>
  <dl>
    {#each rows as row (row.id)}
      <div class="n0-pg-metric">
        <dt>
          <span class="n0-pg-dt-long">{copy.metrics[row.id].label}</span>
          <span class="n0-pg-dt-short" aria-hidden="true">{copy.metrics[row.id].short}</span>
        </dt>
        <dd>
          {#if row.value === null}
            {row.fallback}
          {:else}
            {row.value}<span class="n0-pg-unit">{copy.metrics[row.id].unit}</span>
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
</div>
