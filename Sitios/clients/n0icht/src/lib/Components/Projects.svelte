<script>
  /**
   * Proyectos: una grilla de casos de estudio como `<details>` exclusivos (el `name` compartido
   * hace que abrir uno cierre el anterior).
   *
   * - El `<summary>` es la cara de la tarjeta: micro-etiqueta, nombre, resumen, período · rol,
   *   las primeras tecnologías y la afirmación de abrir/cerrar (el CSS muestra una según `[open]`).
   *   Solo lleva contenido fraseante y un encabezado, como pide el estándar.
   * - Funciona sin JavaScript: son `<details>` nativos. Con JS, cargar con `/#project-<slug>`
   *   (o llegar con ese hash) abre el caso correspondiente.
   * - Abierto, el `<details>` ocupa todo el ancho de la grilla.
   */
  import { onMount } from "svelte";
  import { projects, projectsSection as copy } from "$lib/content/projects.js";
  import { ui } from "$lib/content/site.js";
  import ProjectCase from "./ProjectCase.svelte";
  import Section from "./Section.svelte";
  import Tag from "./Tag.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** Cuántas tecnologías muestra la cara de la tarjeta. */
  const FACE_TAGS = 4;

  /** @type {HTMLDetailsElement[]} */
  let nodes = [];

  /** @param {number} i */
  const caseNumber = (i) => String(i + 1).padStart(2, "0");

  onMount(() => {
    const openFromHash = () => {
      const id = location.hash.slice(1);
      for (const node of nodes) {
        if (node && node.id === id) node.open = true;
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  });
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-projects">
  <div class="n0-cases">
    {#each projects as project, i (project.slug)}
      <details class="n0-panel is-flush n0-case" id="project-{project.slug}" name="n0-project" bind:this={nodes[i]}>
        <summary>
          <span class="n0-micro">{copy.caseLabel}//{caseNumber(i)}</span>
          <h3>{project.name}</h3>
          <span class="n0-case-summary">{project.summary}</span>
          <span class="n0-case-meta">{project.period} · {project.role}</span>
          <span class="n0-case-tags">
            {#each project.stack.slice(0, FACE_TAGS) as item}
              <Tag>{item}</Tag>
            {/each}
            {#if project.todo}
              <Tag tone="amber">{ui.placeholderTag}</Tag>
            {/if}
          </span>
          <span class="n0-case-toggle" aria-hidden="true">
            <span class="n0-case-open">{copy.open}</span>
            <span class="n0-case-close">{copy.close}</span>
          </span>
        </summary>
        <ProjectCase {project} />
      </details>
    {/each}
  </div>
</Section>
