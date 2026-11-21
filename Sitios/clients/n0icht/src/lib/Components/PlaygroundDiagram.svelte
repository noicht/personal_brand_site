<script>
  /**
   * Diagrama del playground: la topología simulada (cliente -> API -> base) en SVG, con el
   * estado de cada nodo (celdas, palabra de estado y stat — nunca solo color) y, cuando
   * `animate`, un pool de paquetes que viajan por las rutas con caudal.
   *
   * La geometría sale de `playground/topology.ts` (`layoutTopology`, `edgesFor`,
   * `nodeStatuses`, `routesFor`); los paquetes de `playground/packets.ts` con seed fija. Un
   * `ResizeObserver` elige la orientación (`tall` bajo 600px de ancho, si no `wide`) y el SVG
   * recién se dibuja después de la primera medida. Con `prefers-reduced-motion` el padre pasa
   * `animate={false}` y no hay rects ni loop de animación.
   *
   * Los paquetes no pasan por estado de Svelte: un `requestAnimationFrame` escribe
   * `transform` / clase / visibilidad directo en los rects; el campo se resetea solo cuando
   * cambian las aristas o la orientación (`topoKey`). El texto alternativo es la lista `.n0-sr`
   * de componentes con su estado.
   */
  import { onMount } from "svelte";
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import { fill } from "$lib/terminal/commands.ts";
  import { formatCount, formatPercent } from "$lib/playground/format.ts";
  import { PACKET_CAPACITY, createPacketField, spawnRate } from "$lib/playground/packets.ts";
  import { NODE_IDS, edgesFor, layoutTopology, nodeStatuses, routesFor } from "$lib/playground/topology.ts";

  /** Config del simulador. */
  export let config;

  /** Métricas del instante (`measure`). */
  export let metrics;

  /** `true` dibuja paquetes: la simulación corre y no hay reduced motion. */
  export let animate = false;

  /** @type {import("$lib/playground/topology.ts").TopologyLayout | null} */
  let layout = null;
  /** @type {"wide" | "tall"} */
  let orientation = "wide";
  /** @type {HTMLDivElement} */
  let wrapper;

  /** Slots del pool de paquetes (uno por rect). */
  const packetSlots = Array.from({ length: PACKET_CAPACITY }, (_, i) => i);
  /** @type {Record<number, string>} */
  const KIND_CLASS = { 1: "ok", 2: "fail", 3: "async" };

  $: edges = edgesFor(config);
  $: statuses = nodeStatuses(config, metrics);
  /** @type {any} Cajas por id (para extremos de aristas y centros de paquetes). */
  let boxes = {};
  $: boxes = layout ? Object.fromEntries(layout.nodes.map((node) => [node.id, node])) : {};
  $: edgeLines = layout
    ? edges.map((edge) => ({ ...edge, a: boxes[edge.from], b: boxes[edge.to] }))
    : [];
  /** @type {any} Centros por id para `packets.advance`. */
  let centers = {};
  $: centers = layout
    ? Object.fromEntries(layout.nodes.map((node) => [node.id, { x: node.cx, y: node.cy }]))
    : {};
  $: routes = layout ? routesFor(config, metrics) : [];
  $: topoKey = `${orientation}|${edges.map((edge) => `${edge.from}>${edge.to}:${edge.kind}`).join(",")}`;

  /** Stat al pie del nodo ("" cuando está off o down). @param {import("$lib/playground/topology.ts").NodeId} id @param {any} cfg @param {any} mets @param {Record<string, string>} stats */
  function statFor(id, cfg, mets, stats) {
    const status = stats[id];
    if (status === "off" || status === "down") return "";
    if (id === "client") return fill(copy.nodes.client.stat, { rps: String(cfg.rps) });
    if (id === "lb") {
      return fill(copy.nodes.lb.stat, { alive: String(mets.apiAlive), instances: String(mets.apiInstances) });
    }
    if (id === "api") {
      return fill(copy.nodes.api.stat, { load: mets.apiLoad === null ? copy.none : formatPercent(mets.apiLoad) });
    }
    if (id === "cache") return fill(copy.nodes.cache.stat, { hit: formatPercent(mets.hitRatio) });
    if (id === "queue") return fill(copy.nodes.queue.stat, { backlog: formatCount(mets.backlog) });
    return fill(copy.nodes[id].stat, { load: mets.dbLoad === null ? copy.none : formatPercent(mets.dbLoad) });
  }

  /** Celdas de estado: la API dibuja una por instancia (las caídas, huecas). @param {import("$lib/playground/topology.ts").NodeId} id @param {any} cfg @param {any} mets @param {Record<string, string>} stats */
  function cellsFor(id, cfg, mets, stats) {
    const hollowAll = stats[id] === "off" || stats[id] === "down";
    if (id === "api") {
      return Array.from({ length: mets.apiInstances }, (_, i) => ({ hollow: hollowAll || i >= mets.apiAlive }));
    }
    return [{ hollow: hollowAll }];
  }

  /** Nodos con su estado, stat y celdas (solo cuando hay layout). */
  $: view = layout
    ? layout.nodes.map((node) => ({
        ...node,
        status: statuses[node.id],
        stat: statFor(node.id, config, metrics, statuses),
        cells: cellsFor(node.id, config, metrics, statuses),
      }))
    : [];

  /** Filas del texto alternativo: etiqueta, palabra de estado y stat. */
  $: rows = NODE_IDS.map((id) => {
    const stat = statFor(id, config, metrics, statuses);
    const status = copy.statuses[statuses[id]];
    return { id, text: stat ? `${copy.nodes[id].label} · ${status} · ${stat}` : `${copy.nodes[id].label} · ${status}` };
  });

  onMount(() => {
    /** @param {number} width */
    const apply = (width) => {
      orientation = width < 600 ? "tall" : "wide";
      layout = layoutTopology(orientation);
    };
    // Sin lectura de clientWidth acá: medirlo fuerza un layout síncrono de toda la
    // página dentro del mount. El ResizeObserver entrega el primer ancho en el
    // próximo paso de renderizado, con el layout que el navegador ya iba a hacer.
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  });

  /**
   * Acción de la capa de paquetes: crea el campo con seed fija y un rAF que lo avanza y
   * escribe los rects. `update` guarda los parámetros nuevos y resetea el campo cuando
   * `topoKey` cambia (aristas u orientación); `destroy` cancela el frame.
   * @param {SVGGElement} node
   * @param {{ routes: any, centers: any, perSecond: number, topoKey: string }} params
   */
  function packetLayer(node, params) {
    const field = createPacketField(0x6e30);
    const els = Array.from(node.querySelectorAll("rect"));
    let raf = 0;
    let last = 0;
    let topo = params.topoKey;

    const frame = (now) => {
      const dt = last === 0 ? 0 : (now - last) / 1000;
      last = now;
      field.advance(dt, params.routes, params.centers, params.perSecond);
      for (let i = 0; i < field.capacity; i++) {
        const el = /** @type {SVGRectElement} */ (els[i]);
        const kind = field.kind[i];
        if (kind === 0) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.setAttribute("transform", `translate(${field.x[i].toFixed(1)} ${field.y[i].toFixed(1)})`);
        const name = KIND_CLASS[kind];
        if (el.dataset.kind !== name) {
          el.dataset.kind = name;
          el.setAttribute("class", `n0-pg-packet is-${name}`);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return {
      /** @param {{ routes: any, centers: any, perSecond: number, topoKey: string }} next */
      update(next) {
        params = next;
        if (next.topoKey !== topo) {
          topo = next.topoKey;
          field.reset();
        }
      },
      destroy() {
        cancelAnimationFrame(raf);
      },
    };
  }
</script>

<div class="n0-pg-diagram" role="group" aria-label={copy.diagramLabel} bind:this={wrapper}>
  {#if layout}
    <svg viewBox="0 0 {layout.width} {layout.height}" aria-hidden="true" class="n0-pg-svg is-{orientation}">
      {#each edgeLines as edge (edge.from + ">" + edge.to)}
        <line
          class="n0-pg-edge"
          class:is-async={edge.kind === "async"}
          class:is-down={statuses[edge.to] === "down"}
          x1={edge.a.cx}
          y1={edge.a.cy}
          x2={edge.b.cx}
          y2={edge.b.cy}
        />
      {/each}
      {#if animate}
        <g class="n0-pg-packets" use:packetLayer={{ routes, centers, perSecond: spawnRate(config.rps), topoKey }}>
          {#each packetSlots as slot (slot)}
            <rect class="n0-pg-packet" x="-3" y="-3" width="6" height="6" visibility="hidden" />
          {/each}
        </g>
      {/if}
      {#each view as node (node.id)}
        <g class="n0-pg-node is-{node.status}">
          <rect class="n0-pg-node-box" x={node.x} y={node.y} width={node.width} height={node.height} />
          {#each node.cells as cell, ci (ci)}
            <rect
              class="n0-pg-cell"
              class:is-hollow={cell.hollow}
              x={node.x + 6 + ci * 9}
              y={node.y + 6}
              width="6"
              height="6"
            />
          {/each}
          <text class="n0-pg-node-status" x={node.x + node.width - 6} y={node.y + 13} text-anchor="end">{copy.statuses[node.status]}</text>
          <text class="n0-pg-node-label" x={node.cx} y={node.cy - 4} text-anchor="middle">{copy.nodes[node.id].label}</text>
          {#if node.stat}
            <text class="n0-pg-node-stat" x={node.cx} y={node.y + node.height - 8} text-anchor="middle">{node.stat}</text>
          {/if}
        </g>
      {/each}
    </svg>
  {/if}
  <div class="n0-sr">
    <h3>{copy.componentsLabel}</h3>
    <ul>
      {#each rows as row (row.id)}
        <li>{row.text}</li>
      {/each}
    </ul>
  </div>
</div>
