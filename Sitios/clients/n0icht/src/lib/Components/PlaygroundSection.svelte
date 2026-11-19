<script>
  /**
   * Shell estático de la sección del playground: reserva el ancla, el encabezado y un panel
   * con el aviso de carga en el bundle inicial. El simulador (`Playground.svelte`) entra por
   * import dinámico recién cuando la sección se acerca al viewport — IntersectionObserver con
   * `rootMargin: "800px"` — así su JS y su CSS (`playground.css`) viajan en un chunk lazy.
   *
   * Sin `IntersectionObserver` (SSR o navegador viejo) carga de una. Si el import falla se
   * muestra `loadError` con un botón que reintenta.
   */
  import { onMount } from "svelte";
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import Button from "./Button.svelte";
  import Panel from "./Panel.svelte";
  import Section from "./Section.svelte";
  import StatusDot from "./StatusDot.svelte";

  /** Número de la micro-etiqueta (`03`). */
  export let index = "";

  /** @type {HTMLDivElement} */
  let root;
  /** @type {any} */
  let Sim = null;
  let failed = false;

  /** Importa el simulador; si falla, queda el panel de error con reintento. */
  async function load() {
    failed = false;
    try {
      const module = await import("./Playground.svelte");
      Sim = module.default;
    } catch {
      failed = true;
    }
  }

  onMount(() => {
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        load();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  });
</script>

<Section id={copy.id} {index} title={copy.title} lead={copy.lead} class="n0-pg">
  <div class="n0-pg-shell" bind:this={root}>
    {#if Sim}
      <svelte:component this={Sim} />
    {:else}
      <Panel label={copy.panelLabel}>
        {#if failed}
          <p>{copy.loadError}</p>
          <Button variant="ghost" on:click={load}>{copy.retry}</Button>
        {:else}
          <StatusDot state="pending" pulse label={copy.loading} />
          <noscript><p>{copy.noscript}</p></noscript>
        {/if}
      </Panel>
    {/if}
  </div>
</Section>
