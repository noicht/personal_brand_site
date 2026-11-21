<script>
  /**
   * Diagrama de arquitectura de un proyecto: nodos en una grilla unidos por aristas ortogonales.
   *
   * La geometría sale de `viz/diagram.ts` (nodos ubicados en su celda, paths que terminan en el
   * borde de cada nodo). El SVG es decorativo (`aria-hidden`): la información va en el texto
   * alternativo de `.n0-sr` — el resumen del diagrama y la lista de conexiones.
   *
   * El wrapper es un `role="group"` enfocable con scroll horizontal propio: en pantallas chicas
   * el SVG mantiene un ancho mínimo legible y se recorre con el teclado; la página nunca scrollea
   * en horizontal.
   */
  import { describeEdges, layoutDiagram } from "$lib/viz/diagram.ts";

  /** El `Diagram` del proyecto. */
  export let diagram;

  /** Slug del proyecto: nombra el diagrama y da ids únicos a los markers del SVG. */
  export let name;

  /** La sección (`projectsSection`): etiquetas de tipos de nodo, aria-label y el título del flujo. */
  export let copy;

  $: layout = layoutDiagram(diagram);
  $: flows = describeEdges(diagram);
  $: markerId = `n0-arrow-${name}`;
  $: label = copy.diagramLabel.replace("{name}", name);
</script>

<!-- El tabindex deja scrollear el diagrama con el teclado en pantallas chicas. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="n0-diagram" role="group" aria-label={label} tabindex="0">
  <svg class="n0-diagram-svg" viewBox="0 0 {layout.width} {layout.height}" aria-hidden="true">
    <defs>
      <marker id={markerId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path class="n0-dia-arrow" d="M 0 0.5 L 8 4 L 0 7.5 z" />
      </marker>
    </defs>
    {#each layout.edges as edge (edge.from + ">" + edge.to)}
      <path class="n0-dia-edge" d={edge.path} marker-end="url(#{markerId})" />
      {#if edge.label}
        <text class="n0-dia-edge-label" x={edge.labelX} y={edge.labelY} text-anchor={edge.labelAnchor}>{edge.label}</text>
      {/if}
    {/each}
    {#each layout.nodes as node (node.id)}
      <g class="n0-dia-node is-{node.kind}">
        <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="2" />
        <text class="n0-dia-label" x={node.x + node.width / 2} y={node.y + node.height / 2 - 2}>{node.label}</text>
        <text class="n0-dia-kind" x={node.x + node.width / 2} y={node.y + node.height - 10}>{copy.kinds[node.kind]}</text>
      </g>
    {/each}
  </svg>

  <div class="n0-sr">
    <h4>{copy.flowLabel}</h4>
    <ul>
      {#each flows as flow}
        <li>{flow}</li>
      {/each}
    </ul>
  </div>
</div>
