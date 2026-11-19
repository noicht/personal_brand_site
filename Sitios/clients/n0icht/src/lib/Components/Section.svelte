<script>
  /**
   * Envoltorio de las secciones de la página: `<section id>` con el encabezado `SYS//NN`
   * y el contenido adentro del `Container`. La usan todas las secciones construidas y el
   * panel provisorio de las pendientes.
   *
   * `tabindex="-1"` deja que la paleta les pase el foco al navegar. El reveal va solo en el
   * encabezado: es corto, así que siempre entra en viewport; el resto del contenido lo maneja
   * cada sección pieza por pieza (un contenedor alto nunca supera el umbral del observer).
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { ui } from "$lib/content/site.js";
  import Container from "./Container.svelte";
  import SectionHeader from "./SectionHeader.svelte";

  /** Id de la sección y del ancla. */
  export let id;

  /** Número de la micro-etiqueta (`01`). */
  export let index = "";

  export let title = "";

  /** Bajada debajo del título. */
  export let lead = "";

  /** Clases extra. */
  let className = "";
  export { className as class };
</script>

<section {id} class="site-section {className}" tabindex="-1" aria-labelledby="{id}-title">
  <Container>
    <div class="fx-reveal" use:reveal>
      <SectionHeader label={ui.sectionLabel} {index} {title} {lead} headingId="{id}-title" />
    </div>
    <slot />
  </Container>
</section>
