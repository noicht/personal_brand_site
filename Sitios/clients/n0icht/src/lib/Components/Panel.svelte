<script>
  /**
   * Panel: superficie opaca con corchetes en las cuatro esquinas. Es donde va el contenido, para
   * que se lea bien sobre el fondo. Los estilos están en site.css (`.n0-panel`).
   *
   * Con `label` (o con el slot `status`) suma una cabecera: la micro-etiqueta a la izquierda y el
   * slot a la derecha.
   *
   *   <Panel label="SYS//01">
   *     <Tag slot="status" tone="green">ONLINE</Tag>
   *     …
   *   </Panel>
   */

  /** Micro-etiqueta de la cabecera (`SYS//01`). */
  export let label = "";

  /** Sin padding: el contenido llega hasta el borde (lo usan la terminal y la paleta). */
  export let flush = false;

  /** Clases extra. */
  let className = "";
  export { className as class };
</script>

<div class="n0-panel {className}" class:is-flush={flush}>
  {#if label || $$slots.status}
    <div class="n0-panel-label">
      <span class="n0-micro">{label}</span>
      <slot name="status" />
    </div>
  {/if}
  <slot />
</div>
