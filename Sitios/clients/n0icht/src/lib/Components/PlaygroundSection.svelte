<script>
  /**
   * Shell estático de la sección del playground: reserva el ancla, el encabezado y un panel
   * con el aviso de carga en el bundle inicial. El simulador (`Playground.svelte`) entra por
   * un único `import()` memoizado, así su JS y su CSS (`playground.css`) viajan en un chunk
   * lazy que no está ni en el HTML prerenderizado ni en ningún `modulepreload`.
   *
   * La descarga arranca apenas hidrata la página (`requestIdleCallback`, o `setTimeout`
   * donde falte) para que el montaje sea instantáneo cuando haga falta; el montaje en sí
   * espera a que la sección esté a menos de 800 px debajo del viewport o ya haya quedado
   * arriba (un `IntersectionObserver` con margen superior enorme cubre el salto directo a
   * una sección posterior, que pasa la sección de "lejos abajo" a "arriba" sin tocar el
   * viewport). Quien se queda arriba de la página baja el chunk pero nunca corre el
   * simulador. Sin `IntersectionObserver` (SSR o navegador viejo) monta de una.
   *
   * Si el usuario saltó a un ancla debajo del playground antes de que el simulador terminara
   * de montar, la página queda corta: apenas monta se vuelve a hacer `scrollIntoView()` sobre
   * ese destino, solo si nadie scrolleó a mano y el hash sigue apuntando ahí. Si el import
   * falla se muestra `loadError` con un botón que reintenta (la promesa se limpia para que
   * el reintento reimporte).
   */
  import { onMount, tick } from "svelte";
  import { playgroundSection as copy } from "$lib/content/playground.js";
  import { SCROLL_KEYS, shouldRealign } from "$lib/playground/realign.ts";
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
  /** Si el usuario scrolleó a mano desde que cargó la página. */
  let userScrolled = false;
  /**
   * La promesa del `import()` memoizado (solo la descarga; el montaje es aparte).
   * @type {Promise<any> | null}
   */
  let pending = null;
  /** Promesa del montaje en curso: `mount()` es idempotente. @type {Promise<void> | null} */
  let mounting = null;

  const markScrolled = () => {
    userScrolled = true;
  };
  /** @param {KeyboardEvent} event */
  const onKeydown = (event) => {
    if (SCROLL_KEYS.includes(event.key)) userScrolled = true;
  };
  const onHashChange = () => {
    userScrolled = false;
  };
  const removeScrollListeners = () => {
    window.removeEventListener("wheel", markScrolled);
    window.removeEventListener("touchmove", markScrolled);
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("hashchange", onHashChange);
  };

  /**
   * Vuelve a scrollear al destino del hash si el salto por ancla quedó viejo: el destino
   * tiene que estar debajo del playground y nadie tiene que haber scrolleado a mano.
   */
  function realignToHash() {
    if (!root) return;
    /** @type {HTMLElement | null} */
    let target = null;
    try {
      target =
        location.hash.length > 1
          ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
          : null;
    } catch {
      target = null;
    }
    if (
      shouldRealign({
        userScrolled,
        hasTarget: target !== null,
        targetFollows:
          target !== null &&
          (root.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        targetInside: target !== null && root.contains(target),
      })
    ) {
      target.scrollIntoView();
    }
  }

  /**
   * Solo arranca la descarga del chunk: no monta nada ni toca estado. Si el warm-up
   * falla y nadie lo pidió para montar, el memo se limpia en silencio (el montaje
   * reintenta la descarga por su cuenta).
   */
  function warm() {
    if (pending) return;
    const p = import("./Playground.svelte");
    pending = p;
    p.catch(() => {
      if (pending === p) pending = null;
    });
  }

  /**
   * Monta el simulador sobre el import memoizado (lo arranca si nadie lo hizo). Las
   * llamadas concurrentes comparten la misma promesa; si falla, `failed` prende el panel
   * de error y el memo se limpia para que el reintento reimporte.
   * @returns {Promise<void>}
   */
  function mount() {
    if (mounting) return mounting;
    failed = false;
    mounting = (async () => {
      try {
        warm();
        const module = await /** @type {Promise<any>} */ (pending);
        Sim = module.default;
        await tick();
        removeScrollListeners();
        realignToHash();
      } catch {
        failed = true;
        pending = null;
        mounting = null;
      }
    })();
    return mounting;
  }

  onMount(() => {
    window.addEventListener("wheel", markScrolled, { passive: true });
    window.addEventListener("touchmove", markScrolled, { passive: true });
    window.addEventListener("keydown", onKeydown, { passive: true });
    window.addEventListener("hashchange", onHashChange);

    /** @type {() => void} */
    let cancelScheduled;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => warm(), { timeout: 2000 });
      cancelScheduled = () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => warm(), 300);
      cancelScheduled = () => clearTimeout(id);
    }

    /** @type {IntersectionObserver | undefined} */
    let observer;
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          io.disconnect();
          mount();
        },
        // 800 px debajo del viewport para acercarse; el margen superior gigante hace
        // que "la sección ya quedó arriba" también sea intersección: un salto instantáneo
        // al final de la página la pasa de "lejos abajo" a "arriba" sin tocar el
        // viewport y el observer igual dispara.
        { rootMargin: "1000000px 0px 800px 0px" },
      );
      observer = io;
      io.observe(root);
    } else {
      mount();
    }

    return () => {
      cancelScheduled();
      observer?.disconnect();
      removeScrollListeners();
    };
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
          <Button variant="ghost" on:click={mount}>{copy.retry}</Button>
        {:else}
          <StatusDot state="pending" pulse label={copy.loading} />
          <noscript><p>{copy.noscript}</p></noscript>
        {/if}
      </Panel>
    {/if}
  </div>
</Section>
