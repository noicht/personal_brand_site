<script>
  /**
   * El stack como panel de instrumentos: una leyenda de estados y una grilla de grupos.
   *
   * Cada grupo es un `Panel` con un medidor de años en producción (`Gauge`) y una fila por
   * herramienta: punto de estado + nombre + el estado como texto (nunca solo color) + nota
   * opcional. No hay porcentajes ni barras de nivel — el contenido no los admite.
   *
   * El mapa de estado a punto: `active` → online (verde), `standby` → pending (ámbar),
   * `bench` → off (gris).
   */
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { stack, stackSection as copy } from "$lib/content/stack.js";
  import Gauge from "./Gauge.svelte";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import StatusDot from "./StatusDot.svelte";

  /** Número de la micro-etiqueta de la sección (`01`). */
  export let index = "";

  /** @type {Record<import("$lib/content/types.js").StackStatus, "online" | "pending" | "off">} */
  const DOT = { active: "online", standby: "pending", bench: "off" };

  const STATUS_ORDER = /** @type {import("$lib/content/types.js").StackStatus[]} */ (["active", "standby", "bench"]);
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-stack">
  <ul class="n0-stack-legend" aria-label={copy.legendLabel}>
    {#each STATUS_ORDER as status}
      <li>
        <StatusDot state={DOT[status]} label={copy.statuses[status].label} />
        <span class="n0-stack-hint">{copy.statuses[status].hint}</span>
      </li>
    {/each}
  </ul>

  <div class="n0-stack-grid">
    {#each stack as group (group.id)}
      <div class="fx-reveal" use:reveal>
        <Panel label="{copy.panelLabel}//{group.label}" class="n0-stack-panel">
          <Gauge gauge={group.gauge} />
          <ul class="n0-stack-items">
            {#each group.items as item (item.name)}
              <li class="n0-stack-item">
                <StatusDot state={DOT[item.status]} label={copy.statuses[item.status].label} />
                <span class="n0-stack-name">{item.name}</span>
                {#if item.note}<span class="n0-stack-note">{item.note}</span>{/if}
              </li>
            {/each}
          </ul>
        </Panel>
      </div>
    {/each}
  </div>
</Section>
