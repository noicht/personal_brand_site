<script>
  /**
   * Encabezado de sección: micro-etiqueta numerada (`SYS//01`), título y, si se pasa, una bajada.
   * Los estilos están en site.css (`.n0-sechead`).
   */

  /** Prefijo de la micro-etiqueta. */
  export let label = "SYS";

  /** Número de la sección, en dos dígitos. */
  export let index = "";

  export let title = "";

  /** Bajada debajo del título. */
  export let lead = "";

  /** `id` del `<h2>`, para el `aria-labelledby` de la sección. */
  export let headingId = "";
</script>

<header class="n0-sechead">
  <p class="n0-micro">{label}//{index}</p>
  <h2 id={headingId || undefined}>{title}</h2>
  {#if lead}
    <p class="n0-sechead-lead">{lead}</p>
  {/if}
</header>
