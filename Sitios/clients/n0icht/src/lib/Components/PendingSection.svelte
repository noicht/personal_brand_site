<script>
  /**
   * Panel provisorio de una sección que todavía no está construida: reserva el ancla del menú
   * con el resumen y un estado "IN BUILD". Cuando la sección se construye, su stub sale de
   * `pendingSections` y este componente deja de usarse para ese id.
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { ui } from "$lib/content/site.js";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import StatusDot from "./StatusDot.svelte";
  import Tag from "./Tag.svelte";

  /** El stub de `pendingSections` (`{ id, title, summary }`). */
  export let stub;

  /** Número de la micro-etiqueta (`01`), de `sections`. */
  export let index = "";
</script>

<Section id={stub.id} {index} title={stub.title} class="n0-pending">
  <div class="fx-reveal" use:reveal>
    <Panel label="{ui.pendingLabel}//{stub.id}">
      <Tag slot="status" tone="amber">{ui.pendingTag}</Tag>
      <p>{stub.summary}</p>
      <div class="n0-pending-status">
        <StatusDot state="pending" label={ui.pendingStatus} />
      </div>
    </Panel>
  </div>
</Section>
