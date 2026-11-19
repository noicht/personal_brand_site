<script>
  /**
   * Etiqueta chica en mayúsculas, para estados y categorías. Estilos en site.css (`.n0-tag`).
   */

  /** `neutral`, `amber`, `green` o `cyan`. */
  export let tone = "neutral";
</script>

<span class="n0-tag is-{tone}"><slot /></span>
