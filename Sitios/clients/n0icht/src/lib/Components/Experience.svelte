<script>
  /**
   * Experiencia: una línea de tiempo con un riel vertical y una celda por entrada.
   * La celda es verde solo en el trabajo en curso (el que no tiene `end`); las demás,
   * apagadas. Cada entrada es un panel con período en monoespaciada, empresa (y cliente),
   * rol, resumen, resultados y stack.
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { experience as copy } from "$lib/content/experience.js";
  import { ui } from "$lib/content/site.js";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import Tag from "./Tag.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** Período: "2025 – 2026", un solo año si coinciden, "2025 – present" si sigue. */
  /** @param {import("$lib/content/types.js").ExperienceEntry} entry */
  function period(entry) {
    if (!entry.end) return `${entry.start} – ${copy.presentLabel}`;
    return entry.start === entry.end ? entry.start : `${entry.start} – ${entry.end}`;
  }
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-xp-section">
  <ol class="n0-xp">
    {#each copy.entries as entry (entry.id)}
      <li class="n0-xp-item" class:is-current={!entry.end}>
        <span class="n0-xp-cell" aria-hidden="true"></span>
        <div class="fx-reveal" use:reveal>
          <Panel class="n0-xp-panel">
            <p class="n0-xp-meta">
              <span class="n0-xp-period n0-micro">{period(entry)}</span>
              {#if entry.todo}<Tag tone="amber">{ui.placeholderTag}</Tag>{/if}
            </p>
            <h3>
              {entry.company}
              {#if entry.client}<span class="n0-xp-client">{copy.forLabel} {entry.client}</span>{/if}
            </h3>
            <p class="n0-xp-role">{entry.role}</p>
            <p class="n0-xp-summary">{entry.summary}</p>
            <p class="n0-micro">{copy.outcomesLabel}</p>
            <ul class="n0-xp-outcomes">
              {#each entry.outcomes as outcome}
                <li>{outcome}</li>
              {/each}
            </ul>
            <p class="n0-micro">{copy.stackLabel}</p>
            <ul class="n0-xp-stack">
              {#each entry.stack as item}
                <li><Tag>{item}</Tag></li>
              {/each}
            </ul>
          </Panel>
        </div>
      </li>
    {/each}
  </ol>
</Section>
