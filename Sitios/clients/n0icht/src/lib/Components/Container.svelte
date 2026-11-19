<script>
  /**
   * Contenedor: centra el contenido y le da el ancho máximo del sitio (`.site-wrap` en site.css).
   */

  /** Columna angosta, para texto corrido. */
  export let narrow = false;

  /** Clases extra. */
  let className = "";
  export { className as class };
</script>

<div class="site-wrap {className}" class:is-narrow={narrow}>
  <slot />
</div>
