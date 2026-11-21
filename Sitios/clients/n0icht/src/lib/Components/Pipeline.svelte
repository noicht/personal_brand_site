<script>
  /**
   * El pipeline de 0 a producción: las seis etapas, cada una una parada del recorrido 3D.
   *
   * Cada `<li>` lleva `use:stageAnchor` con su `StageId`: mientras cruza la línea del medio de
   * la ventana, `$activeStage` (de `stores/scene.js`) apunta a esa etapa — el fondo 3D mueve la
   * cámara y destaca su cluster, el riel marca el paso y el panel prende el tag ACTIVE.
   *
   * En pantallas de 62rem o más hay un riel pegajoso a la izquierda con links a cada etapa;
   * debajo no se muestra. Los `<li>` tienen padding (no margin) vertical para que las regiones
   * del observer sean contiguas y cada etapa ocupe distancia de scroll real.
   *
   * El store arranca en 0, así que el HTML prerenderizado trae "idea" activa: es a propósito.
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { pipeline } from "$lib/content/pipeline.js";
  import { activeStage, stageAnchor } from "$lib/stores/scene.js";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import Tag from "./Tag.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** @param {number} i */
  const stageNumber = (i) => String(i + 1).padStart(2, "0");
</script>

<Section id={pipeline.id} {index} title={pipeline.title} lead={pipeline.lead} class="n0-pipe">
  <div class="n0-pipe-grid">
    <nav class="n0-pipe-rail" aria-label={pipeline.railLabel}>
      <ol>
        {#each pipeline.stages as stage, i (stage.id)}
          <li>
            <a href="#pipeline-{stage.id}" aria-current={$activeStage === i ? "step" : undefined}>
              <span class="n0-pipe-cell" aria-hidden="true"></span>
              <span class="n0-pipe-num" aria-hidden="true">{stageNumber(i)}</span>
              <span>{stage.label}</span>
            </a>
          </li>
        {/each}
      </ol>
    </nav>

    <ol class="n0-pipe-stages">
      {#each pipeline.stages as stage, i (stage.id)}
        <li id="pipeline-{stage.id}" use:stageAnchor={stage.id} class:is-active={$activeStage === i}>
          <div class="fx-reveal" use:reveal>
            <Panel label="{pipeline.stageLabel}//{stageNumber(i)}" class="n0-pipe-panel">
              <!-- El tag va siempre en el slot de cabecera y el CSS lo oculta cuando la etapa no
                   está activa: así el panel no cambia de alto al scrollear -->
              <span slot="status" class="n0-pipe-active" aria-hidden={$activeStage === i ? undefined : "true"}>
                <Tag tone="green">{pipeline.activeTag}</Tag>
              </span>
              <h3>{stage.label}</h3>
              <p class="n0-pipe-summary">{stage.summary}</p>
              <p class="n0-pipe-detail">{stage.detail}</p>
              <p class="n0-pipe-output">
                <span class="n0-micro">{pipeline.outputLabel}</span>
                {stage.output}
              </p>
              <p class="n0-micro">{pipeline.toolsLabel}</p>
              <ul class="n0-pipe-tools">
                {#each stage.tools as tool}
                  <li><Tag>{tool}</Tag></li>
                {/each}
              </ul>
            </Panel>
          </div>
        </li>
      {/each}
    </ol>
  </div>
</Section>
