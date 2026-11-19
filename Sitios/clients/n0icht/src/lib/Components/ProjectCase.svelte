<script>
  /**
   * El cuerpo de un caso de estudio (lo que se ve al abrir el `<details>`): problema, diagrama
   * de arquitectura, decisiones con su trade-off, stack, resultado y links.
   *
   * Un link con `todo: true` se muestra como texto con el tag "SOON": nunca es un `<a>` a una
   * URL que todavía no existe.
   */
  import { projectsSection as copy } from "$lib/content/projects.js";
  import ArchDiagram from "./ArchDiagram.svelte";
  import Tag from "./Tag.svelte";

  /** El `Project` del contenido. */
  export let project;
</script>

<div class="n0-case-body">
  <section>
    <h4>{copy.labels.problem}</h4>
    <p>{project.problem}</p>
  </section>

  <section>
    <h4>{copy.labels.architecture}</h4>
    <figure class="n0-case-figure">
      <ArchDiagram diagram={project.architecture} name={project.slug} {copy} />
      <figcaption class="n0-case-figcap">{project.architecture.summary}</figcaption>
    </figure>
  </section>

  <section>
    <h4>{copy.labels.decisions}</h4>
    <ul class="n0-decisions">
      {#each project.decisions as decision}
        <li class="n0-decision">
          <h5>{decision.title}</h5>
          <dl>
            <dt>{copy.labels.choice}</dt>
            <dd>{decision.choice}</dd>
            <dt>{copy.labels.tradeoff}</dt>
            <dd>{decision.tradeoff}</dd>
          </dl>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h4>{copy.labels.stack}</h4>
    <ul class="n0-case-tags">
      {#each project.stack as item}
        <li><Tag>{item}</Tag></li>
      {/each}
    </ul>
  </section>

  <section>
    <h4>{copy.labels.result}</h4>
    <ul class="n0-case-result">
      {#each project.result as line}
        <li>{line}</li>
      {/each}
    </ul>
  </section>

  <section>
    <h4>{copy.labels.links}</h4>
    <ul class="n0-case-links">
      {#each project.links as link}
        <li>
          {#if link.todo}
            <span class="n0-case-pending">
              {link.label}
              <Tag tone="amber">{copy.linkPending}</Tag>
            </span>
          {:else}
            <a class="site-btn is-ghost" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
</div>
